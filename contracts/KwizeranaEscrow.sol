// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title KwizeranaEscrow
/// @notice Non-upgradeable ERC-20 escrow for Kwizerana P2P trades.
/// @dev The owner and arbitrator should be separate multisig wallets. The owner
///      configures future trades only and cannot withdraw active escrow funds.
contract KwizeranaEscrow is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_FEE_BPS = 100; // hard cap: 1%
    uint64 public constant CANCELLATION_GRACE_PERIOD = 30 minutes;

    enum Status { None, Funded, PaymentMarked, Released, Claimed, Refunded }

    struct Trade {
        address seller;
        address buyer;
        address token;
        uint256 amount;
        uint256 feeAmount;
        uint64 cancellationAvailableAt;
        Status status;
    }

    mapping(bytes32 tradeId => Trade) public trades;
    mapping(address token => bool allowed) public allowedTokens;
    mapping(address token => uint256 amount) public liabilities;
    mapping(address token => uint256 amount) public accruedFees;
    mapping(address token => uint256 amount) public totalFeesAccrued;
    mapping(address token => uint256 amount) public totalFeesWithdrawn;

    address public arbitrator;
    address public feeRecipient;
    uint16 public feeBps;
    bool public newLocksPaused;

    event Locked(bytes32 indexed tradeId, address indexed seller, address indexed buyer, address token, uint256 amount, uint256 feeAmount);
    event CancellationRequested(bytes32 indexed tradeId, address indexed seller, uint64 cancellationAvailableAt);
    event CancellationApproved(bytes32 indexed tradeId, address indexed buyer);
    event Released(bytes32 indexed tradeId, address indexed seller);
    event PaymentMarked(bytes32 indexed tradeId, address indexed buyer);
    event Claimed(bytes32 indexed tradeId, address indexed buyer, address indexed token, uint256 amount, uint256 feeAmount);
    event Refunded(bytes32 indexed tradeId, address indexed seller, address indexed token, uint256 amount, uint256 feeAmount);
    event Arbitrated(bytes32 indexed tradeId, address indexed arbitrator, bool releasedToBuyer);
    event TokenPermissionUpdated(address indexed token, bool allowed);
    event FeeConfigurationUpdated(uint16 feeBps, address indexed feeRecipient);
    event ArbitratorUpdated(address indexed previousArbitrator, address indexed newArbitrator);
    event NewLocksPaused(bool paused);
    event ExcessTokensRecovered(address indexed token, address indexed to, uint256 amount);
    event FeesWithdrawn(address indexed token, address indexed treasury, uint256 amount);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidTradeId();
    error InvalidFee();
    error FeeChanged();
    error TokenNotAllowed();
    error TokenTransferMismatch();
    error TradeAlreadyExists();
    error InvalidStatus();
    error CancellationNotRequested();
    error CancellationNotAvailable();
    error NewLocksArePaused();
    error InsufficientExcess();
    error InsufficientFees();

    constructor(address initialOwner, address initialArbitrator, address initialFeeRecipient, uint16 initialFeeBps, address[] memory initialAllowedTokens) Ownable(initialOwner) {
        if (initialArbitrator == address(0) || initialFeeRecipient == address(0)) revert InvalidAddress();
        if (initialFeeBps > MAX_FEE_BPS) revert InvalidFee();
        arbitrator = initialArbitrator;
        feeRecipient = initialFeeRecipient;
        feeBps = initialFeeBps;

        uint256 length = initialAllowedTokens.length;
        for (uint256 i; i < length; ++i) {
            address token = initialAllowedTokens[i];
            if (token == address(0) || token.code.length == 0) revert InvalidAddress();
            allowedTokens[token] = true;
            emit TokenPermissionUpdated(token, true);
        }
        emit FeeConfigurationUpdated(initialFeeBps, initialFeeRecipient);
    }

    function quoteFee(uint256 amount) public view returns (uint256 feeAmount, uint256 totalDeposit) {
        if (amount == 0) revert InvalidAmount();
        feeAmount = Math.mulDiv(amount, feeBps, BPS_DENOMINATOR, Math.Rounding.Ceil);
        totalDeposit = amount + feeAmount;
    }

    /// @notice Locks the buyer amount plus the successful-trade fee.
    /// @param expectedFeeBps Protects the seller from a fee change before mining.
    function lock(bytes32 tradeId, address buyer, address token, uint256 amount, uint16 expectedFeeBps) external nonReentrant {
        if (newLocksPaused) revert NewLocksArePaused();
        if (tradeId == bytes32(0)) revert InvalidTradeId();
        if (trades[tradeId].status != Status.None) revert TradeAlreadyExists();
        if (buyer == address(0) || buyer == msg.sender) revert InvalidAddress();
        if (!allowedTokens[token]) revert TokenNotAllowed();
        if (amount == 0) revert InvalidAmount();
        if (expectedFeeBps != feeBps) revert FeeChanged();

        (uint256 feeAmount, uint256 totalDeposit) = quoteFee(amount);
        IERC20 asset = IERC20(token);
        uint256 balanceBefore = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), totalDeposit);
        if (asset.balanceOf(address(this)) - balanceBefore != totalDeposit) revert TokenTransferMismatch();

        trades[tradeId] = Trade(msg.sender, buyer, token, amount, feeAmount, 0, Status.Funded);
        liabilities[token] += totalDeposit;
        emit Locked(tradeId, msg.sender, buyer, token, amount, feeAmount);
    }

    /// @notice Seller confirms fiat receipt. Anyone may then deliver to the fixed buyer.
    function release(bytes32 tradeId) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.PaymentMarked) revert InvalidStatus();
        if (msg.sender != trade.seller) revert Unauthorized();
        trade.status = Status.Released;
        emit Released(tradeId, trade.seller);
    }

    /// @notice Buyer records that fiat was sent. This permanently disables
    ///         cancellation and requires seller release or arbitration.
    function markPaymentSent(bytes32 tradeId) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Funded) revert InvalidStatus();
        if (msg.sender != trade.buyer) revert Unauthorized();
        trade.status = Status.PaymentMarked;
        emit PaymentMarked(tradeId, trade.buyer);
    }

    /// @notice Finalizes a released trade to the buyer recorded at lock time.
    function claim(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Released) revert InvalidStatus();
        _payBuyer(tradeId, trade);
    }

    /// @notice Seller begins an explicit cancellation. The trade remains payable
    ///         during the grace period so an already-paying buyer can protect it.
    function requestCancellation(bytes32 tradeId) external {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Funded) revert InvalidStatus();
        if (msg.sender != trade.seller) revert Unauthorized();
        if (trade.cancellationAvailableAt != 0) revert InvalidStatus();
        uint64 availableAt = uint64(block.timestamp + CANCELLATION_GRACE_PERIOD);
        trade.cancellationAvailableAt = availableAt;
        emit CancellationRequested(tradeId, trade.seller, availableAt);
    }

    /// @notice Buyer may consent to an immediate cancellation before marking paid.
    function approveCancellation(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Funded) revert InvalidStatus();
        if (msg.sender != trade.buyer) revert Unauthorized();
        if (trade.cancellationAvailableAt == 0) revert CancellationNotRequested();
        emit CancellationApproved(tradeId, trade.buyer);
        _refundSeller(tradeId, trade);
    }

    /// @notice Finalizes a requested cancellation after its buyer-protection window.
    ///         Callable by anyone; funds always return to the recorded seller.
    function refund(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.Funded) revert InvalidStatus();
        if (trade.cancellationAvailableAt == 0) revert CancellationNotRequested();
        if (block.timestamp < trade.cancellationAvailableAt) revert CancellationNotAvailable();
        _refundSeller(tradeId, trade);
    }

    function resolveToBuyer(bytes32 tradeId) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.PaymentMarked) revert InvalidStatus();
        emit Arbitrated(tradeId, msg.sender, true);
        _payBuyer(tradeId, trade);
    }

    function resolveToSeller(bytes32 tradeId) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        Trade storage trade = trades[tradeId];
        if (trade.status != Status.PaymentMarked) revert InvalidStatus();
        emit Arbitrated(tradeId, msg.sender, false);
        _refundSeller(tradeId, trade);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        if (token == address(0) || (allowed && token.code.length == 0)) revert InvalidAddress();
        allowedTokens[token] = allowed;
        emit TokenPermissionUpdated(token, allowed);
    }

    function setFeeConfiguration(uint16 newFeeBps, address newFeeRecipient) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();
        if (newFeeRecipient == address(0)) revert InvalidAddress();
        feeBps = newFeeBps;
        feeRecipient = newFeeRecipient;
        emit FeeConfigurationUpdated(newFeeBps, newFeeRecipient);
    }

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert InvalidAddress();
        address previous = arbitrator;
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(previous, newArbitrator);
    }

    /// @notice Pauses new deposits only; existing exits remain available.
    function setNewLocksPaused(bool paused) external onlyOwner {
        newLocksPaused = paused;
        emit NewLocksPaused(paused);
    }

    /// @notice Recovers accidental surplus only. Escrow liabilities cannot be withdrawn.
    function recoverExcessTokens(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 reserved = liabilities[token] + accruedFees[token];
        if (balance < reserved || amount > balance - reserved) revert InsufficientExcess();
        IERC20(token).safeTransfer(to, amount);
        emit ExcessTokensRecovered(token, to, amount);
    }

    /// @notice Withdraws only fees earned by completed buyer settlements.
    ///         A multisig owner provides multi-admin approval off-chain.
    function withdrawFees(address token, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 available = accruedFees[token];
        if (amount > available) revert InsufficientFees();
        accruedFees[token] = available - amount;
        totalFeesWithdrawn[token] += amount;
        IERC20(token).safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(token, feeRecipient, amount);
    }

    function _payBuyer(bytes32 tradeId, Trade storage trade) private {
        uint256 total = trade.amount + trade.feeAmount;
        trade.status = Status.Claimed;
        liabilities[trade.token] -= total;
        accruedFees[trade.token] += trade.feeAmount;
        totalFeesAccrued[trade.token] += trade.feeAmount;
        IERC20 asset = IERC20(trade.token);
        asset.safeTransfer(trade.buyer, trade.amount);
        emit Claimed(tradeId, trade.buyer, trade.token, trade.amount, trade.feeAmount);
    }

    function _refundSeller(bytes32 tradeId, Trade storage trade) private {
        uint256 total = trade.amount + trade.feeAmount;
        trade.status = Status.Refunded;
        liabilities[trade.token] -= total;
        IERC20(trade.token).safeTransfer(trade.seller, total);
        emit Refunded(tradeId, trade.seller, trade.token, trade.amount, trade.feeAmount);
    }
}
