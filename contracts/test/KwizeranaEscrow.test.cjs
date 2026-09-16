const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const amount = 100_000_000n; // 100 tokens with 6 decimals
const fee = 200_000n; // 0.20%
const total = amount + fee;

async function expectRevert(promise) {
  let reverted = false;
  try {
    await promise;
  } catch {
    reverted = true;
  }
  expect(reverted).to.equal(true);
}

async function deployFixture() {
  const [owner, arbitrator, treasury, seller, buyer, outsider] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("MockERC20");
  const token = await Token.deploy();
  const Escrow = await ethers.getContractFactory("KwizeranaEscrow");
  const escrow = await Escrow.deploy(owner.address, arbitrator.address, treasury.address, 20, [await token.getAddress()]);
  await token.mint(seller.address, 1_000_000_000n);
  await token.connect(seller).approve(await escrow.getAddress(), 1_000_000_000n);
  return { owner, arbitrator, treasury, seller, buyer, outsider, token, escrow };
}

describe("KwizeranaEscrow", function () {
  this.timeout(120_000);

  it("settles to the fixed buyer, accrues 0.20%, and protects fee withdrawal", async function () {
    const { owner, seller, buyer, outsider, treasury, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-1");
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(total);
    expect(await escrow.liabilities(await token.getAddress())).to.equal(total);

    await escrow.connect(buyer).markPaymentSent(tradeId);
    await expectRevert(escrow.connect(outsider).release(tradeId));
    await escrow.connect(seller).release(tradeId);
    await escrow.connect(outsider).claim(tradeId);

    expect(await token.balanceOf(buyer.address)).to.equal(amount);
    expect(await token.balanceOf(treasury.address)).to.equal(0n);
    expect(await escrow.liabilities(await token.getAddress())).to.equal(0n);
    expect(await escrow.accruedFees(await token.getAddress())).to.equal(fee);
    expect(await escrow.totalFeesAccrued(await token.getAddress())).to.equal(fee);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(fee);
    expect((await escrow.trades(tradeId)).status).to.equal(4n);
    await expectRevert(escrow.connect(buyer).claim(tradeId));
    await expectRevert(escrow.connect(outsider).withdrawFees(await token.getAddress(), fee));
    await expectRevert(escrow.connect(owner).withdrawFees(await token.getAddress(), fee + 1n));
    await escrow.connect(owner).withdrawFees(await token.getAddress(), fee);
    expect(await token.balanceOf(treasury.address)).to.equal(fee);
    expect(await escrow.accruedFees(await token.getAddress())).to.equal(0n);
    expect(await escrow.totalFeesWithdrawn(await token.getAddress())).to.equal(fee);
  });

  it("requires explicit cancellation and a buyer-protection window before refund", async function () {
    const { seller, buyer, outsider, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-2");
    const sellerBefore = await token.balanceOf(seller.address);
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20);
    await expectRevert(escrow.connect(seller).refund(tradeId));
    await expectRevert(escrow.connect(buyer).requestCancellation(tradeId));
    await escrow.connect(seller).requestCancellation(tradeId);
    const availableAt = (await escrow.trades(tradeId)).cancellationAvailableAt;
    await expectRevert(escrow.connect(outsider).refund(tradeId));
    await network.provider.send("evm_setNextBlockTimestamp", [Number(availableAt)]);
    await network.provider.send("evm_mine");
    await escrow.connect(outsider).refund(tradeId);

    expect(await token.balanceOf(seller.address)).to.equal(sellerBefore);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
    expect((await escrow.trades(tradeId)).status).to.equal(5n);
  });

  it("allows arbitration only to the recorded buyer or seller", async function () {
    const { arbitrator, seller, buyer, outsider, treasury, token, escrow } = await deployFixture();
    const buyerTrade = ethers.id("trade-3");
    await escrow.connect(seller).lock(buyerTrade, buyer.address, await token.getAddress(), amount, 20);
    await escrow.connect(buyer).markPaymentSent(buyerTrade);
    await expectRevert(escrow.connect(outsider).resolveToBuyer(buyerTrade));
    await escrow.connect(arbitrator).resolveToBuyer(buyerTrade);
    expect(await token.balanceOf(buyer.address)).to.equal(amount);
    expect(await escrow.accruedFees(await token.getAddress())).to.equal(fee);

    const sellerTrade = ethers.id("trade-4");
    const sellerBefore = await token.balanceOf(seller.address);
    await escrow.connect(seller).lock(sellerTrade, buyer.address, await token.getAddress(), amount, 20);
    await escrow.connect(buyer).markPaymentSent(sellerTrade);
    await escrow.connect(arbitrator).resolveToSeller(sellerTrade);
    expect(await token.balanceOf(seller.address)).to.equal(sellerBefore);
  });

  it("rejects duplicate IDs, stale fee quotes, and bad participants", async function () {
    const { owner, seller, buyer, treasury, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-5");
    await expectRevert(escrow.connect(seller).lock(tradeId, seller.address, await token.getAddress(), amount, 20));
    await escrow.connect(owner).setFeeConfiguration(25, treasury.address);
    await expectRevert(escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20));
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 25);
    await expectRevert(escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 25));
  });

  it("rejects unapproved and fee-on-transfer tokens", async function () {
    const { owner, seller, buyer, token, escrow } = await deployFixture();
    const TaxToken = await ethers.getContractFactory("TransferTaxToken");
    const tax = await TaxToken.deploy();
    await tax.mint(seller.address, 1_000_000_000n);
    await tax.connect(seller).approve(await escrow.getAddress(), 1_000_000_000n);
    await expectRevert(escrow.connect(seller).lock(ethers.id("trade-6"), buyer.address, await tax.getAddress(), amount, 20));
    await escrow.connect(owner).setAllowedToken(await tax.getAddress(), true);
    await expectRevert(escrow.connect(seller).lock(ethers.id("trade-7"), buyer.address, await tax.getAddress(), amount, 20));
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("pauses deposits without blocking exits", async function () {
    const { owner, seller, buyer, outsider, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-8");
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20);
    await escrow.connect(owner).setNewLocksPaused(true);
    await expectRevert(escrow.connect(seller).lock(ethers.id("trade-9"), buyer.address, await token.getAddress(), amount, 20));
    await escrow.connect(buyer).markPaymentSent(tradeId);
    await escrow.connect(seller).release(tradeId);
    await escrow.connect(outsider).claim(tradeId);
    expect(await token.balanceOf(buyer.address)).to.equal(amount);
  });

  it("allows recovery of accidental surplus but never active liabilities", async function () {
    const { owner, seller, buyer, outsider, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-10");
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20);
    await expectRevert(escrow.connect(owner).recoverExcessTokens(await token.getAddress(), outsider.address, 1n));
    await token.mint(await escrow.getAddress(), 500n);
    await escrow.connect(owner).recoverExcessTokens(await token.getAddress(), outsider.address, 500n);
    expect(await token.balanceOf(outsider.address)).to.equal(500n);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(total);
  });

  it("cannot cancel or refund after the buyer marks payment", async function () {
    const { arbitrator, seller, buyer, outsider, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-11");
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20);
    await escrow.connect(seller).requestCancellation(tradeId);
    await escrow.connect(buyer).markPaymentSent(tradeId);
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    await expectRevert(escrow.connect(outsider).refund(tradeId));
    await escrow.connect(arbitrator).resolveToSeller(tradeId);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("lets the buyer approve a requested cancellation immediately", async function () {
    const { seller, buyer, token, escrow } = await deployFixture();
    const tradeId = ethers.id("trade-12");
    const sellerBefore = await token.balanceOf(seller.address);
    await escrow.connect(seller).lock(tradeId, buyer.address, await token.getAddress(), amount, 20);
    await escrow.connect(seller).requestCancellation(tradeId);
    await escrow.connect(buyer).approveCancellation(tradeId);
    expect(await token.balanceOf(seller.address)).to.equal(sellerBefore);
    expect((await escrow.trades(tradeId)).status).to.equal(5n);
  });
});
