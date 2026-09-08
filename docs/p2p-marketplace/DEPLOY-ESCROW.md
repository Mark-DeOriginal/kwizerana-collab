# Escrow Deployment Guide

## Warning

The current `KwizeranaEscrow.sol` is a prototype. Deploy it only to development or Avalanche testnet with valueless test tokens. Do not deploy it for real user funds. Read `ESCROW-SECURITY.md` first.

## Current environment variables

```env
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...
ESCROW_DEPLOYER_PRIVATE_KEY=0x...
ESCROW_ARBITRATOR_ADDRESS=0x...
```

`npm run deploy:escrow` is a prototype utility, not production approval.

## Development/testnet procedure

1. Use a dedicated test-only deployer with no mainnet value.
2. Use an Avalanche testnet RPC and test token addresses.
3. Use a test multisig or clearly identified test arbitrator.
4. Compile with a clean, pinned toolchain and record compiler settings.
5. Record chain ID, transaction, address, bytecode, constructor arguments, and commit SHA.
6. Verify source on the explorer.
7. Configure the address only in the intended test environment.
8. Exercise successful and failing lock, release, claim, refund, authorization, and duplicate-ID cases.
9. Confirm the app separates submitted and confirmed transactions.
10. Remove or archive the test environment after use.

## Production prerequisites

- Approved escrow v2 specification and trust model.
- Hardened contract using reviewed libraries.
- Unit, integration, fuzz, and invariant tests.
- Server-side event verification and reconciliation.
- Safe multisig governance and key procedures.
- On-chain deadlines and recovery.
- Independent audit with remediated findings.
- Testnet incident/recovery exercises.
- Launch limits, monitoring, and legal/operational approval.

## Key policy

- Do not store arbitrator/deployer private keys in the web application environment.
- Prefer a hardware-backed multisig.
- Separate deployer, arbitrator, application, and operator identities.
- Document signer rotation, loss, compromise, and emergency procedures.
- Never paste keys into logs, documentation, issue trackers, or AI prompts.

Production startup must fail closed if escrow is enabled but contract, chain, tokens, RPC verification, or reconciliation is missing. Demo settlement must be unavailable in production.

