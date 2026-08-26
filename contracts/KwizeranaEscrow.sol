// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title KwizeranaEscrow
/// @notice Non-custodial ERC-20 escrow for P2P trades on Avalanche.
///         The crypto seller locks tokens; either the seller (after confirming
///         fiat receipt) or the platform arbitrator can release to the buyer
///         or refund to the seller.
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
        bool released;
        bool refunded;
    }

    mapping(bytes32 => Trade) public trades;

    event Locked(bytes32 indexed tradeId, address seller, address buyer, address token, uint256 amount);
    event Released(bytes32 indexed tradeId, address to, uint256 amount);
    event Refunded(bytes32 indexed tradeId, address to, uint256 amount);

    constructor(address _arbitrator) {
        arbitrator = _arbitrator;
    }

    modifier onlySellerOrArbitrator(bytes32 tradeId) {
        require(msg.sender == trades[tradeId].seller || msg.sender == arbitrator, "not authorized");
        _;
    }

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
            refunded: false
        });
        emit Locked(tradeId, msg.sender, buyer, token, amount);
    }

    function release(bytes32 tradeId) external onlySellerOrArbitrator(tradeId) {
        Trade storage t = trades[tradeId];
        require(!t.released && !t.refunded, "already settled");
        t.released = true;
        require(IERC20(t.token).transfer(t.buyer, t.amount), "transfer failed");
        emit Released(tradeId, t.buyer, t.amount);
    }

    function refund(bytes32 tradeId) external onlySellerOrArbitrator(tradeId) {
        Trade storage t = trades[tradeId];
        require(!t.released && !t.refunded, "already settled");
        t.refunded = true;
        require(IERC20(t.token).transfer(t.seller, t.amount), "transfer failed");
        emit Refunded(tradeId, t.seller, t.amount);
    }
}
