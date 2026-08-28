// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title KwizeranaEscrow
/// @notice Non-custodial ERC-20 escrow for P2P trades on Avalanche.
///         Flow:
///           1. The crypto seller calls lock(tradeId, buyer, token, amount) — their
///              USDt/USDC is pulled into this contract (the only time funds are held).
///           2. Once fiat is received, the seller (or arbitrator) calls release(tradeId)
///              to *confirm* — no tokens move yet.
///           3. The recorded buyer wallet then calls claim(tradeId, to) to receive the
///              crypto at any destination (`to` = their own wallet or another address).
///         On cancel/expiry the seller (or arbitrator) calls refund(tradeId).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract KwizeranaEscrow {
    address public arbitrator;

    struct Trade {
        address seller;
        address buyer;
        address token;
        uint256 amount;
        bool released;    // seller confirmed fiat received
        bool claimed;     // buyer withdrew
        bool refunded;    // funds returned to seller
    }

    mapping(bytes32 => Trade) public trades;

    event Locked(bytes32 indexed tradeId, address seller, address buyer, address token, uint256 amount);
    event Released(bytes32 indexed tradeId, address seller);
    event Claimed(bytes32 indexed tradeId, address to, uint256 amount);
    event Refunded(bytes32 indexed tradeId, address to, uint256 amount);

    constructor(address _arbitrator) {
        arbitrator = _arbitrator;
    }

    modifier onlySellerOrArbitrator(bytes32 tradeId) {
        require(msg.sender == trades[tradeId].seller || msg.sender == arbitrator, "not authorized");
        _;
    }

    /// @notice Fund the escrow. Called by the crypto seller's wallet.
    function lock(bytes32 tradeId, address buyer, address token, uint256 amount) external {
        Trade storage t = trades[tradeId];
        require(t.seller == address(0), "trade already locked");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trades[tradeId] = Trade({
            seller: msg.sender,
            buyer: buyer,
            token: token,
            amount: amount,
            released: false,
            claimed: false,
            refunded: false
        });
        emit Locked(tradeId, msg.sender, buyer, token, amount);
    }

    /// @notice Confirm fiat received. Does NOT transfer — the buyer then claims.
    function release(bytes32 tradeId) external onlySellerOrArbitrator(tradeId) {
        Trade storage t = trades[tradeId];
        require(!t.released && !t.claimed && !t.refunded, "already settled");
        t.released = true;
        emit Released(tradeId, t.seller);
    }

    /// @notice Deliver the crypto to `to` (the buyer's connected wallet or any address
    ///         they choose). Callable by the recorded buyer wallet only, and only after
    ///         the seller released.
    function claim(bytes32 tradeId, address to) external {
        Trade storage t = trades[tradeId];
        require(msg.sender == t.buyer, "only buyer");
        require(t.released, "not released");
        require(!t.claimed && !t.refunded, "already settled");
        t.claimed = true;
        require(IERC20(t.token).transfer(to, t.amount), "transfer failed");
        emit Claimed(tradeId, to, t.amount);
    }

    /// @notice Return funds to the seller (cancel / expiry / dispute resolution).
    function refund(bytes32 tradeId) external onlySellerOrArbitrator(tradeId) {
        Trade storage t = trades[tradeId];
        require(!t.released && !t.claimed && !t.refunded, "already settled");
        t.refunded = true;
        require(IERC20(t.token).transfer(t.seller, t.amount), "transfer failed");
        emit Refunded(tradeId, t.seller, t.amount);
    }
}