# Escrow Deployment and First Trade Guide

## Current Fuji deployment

Deployed on 2026-09-16; application configuration verification is required before the next test trade:

- Escrow: `0xebfe5f4ef7731104d6ca94d892e984b1f6a8c4cf`
- Deployment transaction: `0xfdbcbc589e9cc82f1b4f337007ad23ce48c2e0162908a9a260cb0da936356cff`
- kUSDT: `0x1acb3be977eb8b963ad07f9baf0c07149f9d34fb`
- kUSDC: `0xef0ff265290aac8e0f5c496b20fc45e662f5d05a`
- Owner, arbitrator, and fee recipient: `0x616cd62d4AB4aC00629Bd60298C7caB83863CC8a`
- Settlement fee: `20` basis points (`0.20%`)
- Lifecycle: explicit cancellation request with a 30-minute buyer-protection window; no automatic trade expiry.
- Verification evidence: `npm run verify:escrow` confirmed deployed bytecode, owner, arbitrator, fee recipient, configured fee, cancellation period, and both allowlisted test tokens.

The previous escrow at `0xd5e08925ad720f187e1e7c26f33b0c83488bc30f` remains immutable and is retained only to recover pre-migration test trades. Never project one contract's events as if they came from the other address.

This is a valueless testnet deployment. It is not approved for mainnet or real assets.

## Allowed environment

The repository deployment script intentionally accepts **Avalanche Fuji only (chain ID 43113)**. Mainnet deployment is blocked until the audit and production-readiness gates in `ESCROW-SECURITY.md` are complete.

Fuji uses:

- RPC: `https://api.avax-test.network/ext/bc/C/rpc`
- chain ID: `43113`
- gas token: test AVAX
- explorer: `https://testnet.snowtrace.io`

## What you need to prepare

Use separate wallets and never send their secrets to another person, issue tracker, chat, or AI prompt:

1. **Test deployer:** a new wallet used only on Fuji, funded with test AVAX.
2. **Owner:** preferably a test 2-of-3 Safe multisig; controls future token/fee settings and new-lock pause.
3. **Arbitrator:** preferably a different test multisig; can resolve a funded dispute only to the recorded buyer or seller.
4. **Fee recipient:** a dedicated test wallet for the 0.20% successful-settlement fee.
5. **Buyer and seller:** two separate browser wallets for the end-to-end trade.
6. **Test USDT and USDC:** two Fuji ERC-20 test contracts with six decimals. Do not use mainnet token addresses on Fuji. If you do not already have suitable tokens, the repository includes a Fuji-only deployment helper.

Keep the deployer, owner, arbitrator, fee recipient, buyer, and seller conceptually separate even if a small test team temporarily controls multiple wallets.

## Local validation

```bash
npm run contract:compile
npm run contract:test
```

Expected evidence is eight passing tests. This compiles only Solidity and runs a local EVM; it does not build the Next.js application.

To create valueless six-decimal test tokens, temporarily set only the test deployer key and Fuji RPC, then run:

```bash
npm run deploy:fuji-tokens
```

The helper refuses any chain other than Fuji, deploys kUSDT and kUSDC, and mints 10,000 of each to the deployer. Copy the two printed addresses into the variables below. These tokens are for testing only and have no monetary value.

## Testnet environment

Place these values in `.env.local` locally and in the matching Vercel preview/test environment. Never commit the file.

```env
NEXT_PUBLIC_ESCROW_CHAIN_ID=43113
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
NEXT_PUBLIC_ESCROW_USDT_ADDRESS=0x_TEST_USDT
NEXT_PUBLIC_ESCROW_USDC_ADDRESS=0x_TEST_USDC

ESCROW_DEPLOYER_PRIVATE_KEY=0x_TEST_ONLY_PRIVATE_KEY
ESCROW_OWNER_ADDRESS=0x_OWNER_OR_TEST_SAFE
ESCROW_ARBITRATOR_ADDRESS=0x_ARBITRATOR_OR_TEST_SAFE
ESCROW_FEE_RECIPIENT_ADDRESS=0x_FEE_WALLET
ESCROW_FEE_BPS=20
ESCROW_CONFIRMATIONS=3
```

Only `NEXT_PUBLIC_*` values are exposed to the browser. The deployer private key must never be configured in Vercel or the running web application; it is needed only in the local shell for deployment and should be removed from `.env.local` immediately afterwards.

## Deploy and verify

1. Confirm the RPC is Fuji and every configured address is a test address.
2. Run `npm run contract:compile`.
3. Run `npm run deploy:escrow`.
4. Record the commit SHA, compiler `0.8.28`, EVM target `cancun`, optimizer runs `200`, deployment transaction, contract address, constructor arguments, and timestamp.
5. Set `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` to the returned address.
6. Remove `ESCROW_DEPLOYER_PRIVATE_KEY` from `.env.local`.
7. Verify the source and constructor arguments on the Fuji explorer.
8. Read the deployed contract and confirm owner, arbitrator, fee recipient, fee BPS, and both allowlisted tokens.

Do not proceed if any value differs from the deployment record.

## First end-to-end trade

Use a tiny amount of valueless test tokens.

1. Mint or transfer test tokens to the seller and test AVAX to both wallets.
2. Seller creates an offer; buyer creates an order and fixes their receiving wallet.
3. Seller reviews the principal, exact 0.20% fee, total deposit, token, buyer, and cancellation policy.
4. Seller approves the exact total deposit and funds escrow.
5. Wait for the application to verify the `Locked` event and required confirmations.
6. Buyer performs a simulated/off-chain fiat step only—do not send real fiat during this exercise—and marks payment sent.
7. Seller confirms receipt and calls `release`.
8. Buyer clicks receive. The call is permissionless, but the contract always sends principal to the buyer fixed at funding.
9. Confirm the buyer received the full principal, the 0.20% fee appears in `accruedFees`, active liability decreased to zero, and the database shows the matching confirmed events.
10. From the owner test multisig, call `withdrawFees(token, amount)` and confirm only the accrued amount reaches the configured fee recipient. Confirm a non-owner call and an over-withdrawal both revert.
11. Repeat with an intentionally abandoned order: request cancellation from the seller, confirm an early refund fails, wait through the 30-minute protection period, then call `refund` from a third wallet and confirm the seller receives principal plus fee. Also verify that a buyer can approve an immediate cancellation and that marking payment blocks the refund path.
12. Repeat both arbitrator outcomes and verify no arbitrary destination is possible.

Capture transaction hashes and screenshots without exposing private information. Any mismatch between chain and database is a failed test, even if wallet transactions succeeded.

## Stop conditions

Stop the test and pause new locks if:

- the app is connected to chain 43114 or an unexpected RPC;
- token, buyer, seller, amount, fee, cancellation state, or contract differs from the order;
- a transaction appears successful but its expected event is missing;
- the database advances without the required confirmed event;
- liabilities differ from the contract's supported-token balances;
- refund or claim cannot be executed in its allowed state;
- any wallet asks for unlimited approval rather than the displayed total.

## Mainnet

Do not adapt the deployment script to mainnet merely to bypass its guard. Complete every mainnet gate in `ESCROW-SECURITY.md`, then create a separately reviewed deployment procedure with hardware-backed multisig signing, independent bytecode/source verification, monitoring, and launch limits.
