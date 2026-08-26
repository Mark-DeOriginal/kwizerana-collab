# Deploying the Kwizerana Escrow Contract

The P2P marketplace uses a **non-custodial ERC-20 escrow** on **Avalanche C-Chain**
(`contracts/KwizeranaEscrow.sol`). The crypto seller locks USDT/USDC into the contract;
the seller (or the platform **arbitrator** key) releases it to the buyer or refunds it
to the seller.

This guide walks you through compiling the contract, deploying it with the included
script, and wiring the address into the app.

---

## 1. Prerequisites

- A wallet with a small amount of **AVAX** on Avalanche C-Chain (for gas).
  You can get AVAX from the [Avalanche Faucet](https://core.app/tools/testnet-faucet)
  (testnet) or an exchange (mainnet).
- Node.js 18+ (already required by the project).

---

## 2. Compile the contract & export the bytecode

The contract is at `contracts/KwizeranaEscrow.sol`. You need its **bytecode**.
The easiest way is Remix (no installs required):

1. Go to <https://remix.ethereum.org>.
2. Create a new file (e.g. `KwizeranaEscrow.sol`) and paste the contents of
   `contracts/KwizeranaEscrow.sol`.
3. Open the **Solidity Compiler** tab:
   - Compiler version: `0.8.24` (or later)
   - Click **Compile KwizeranaEscrow.sol**.
4. After compiling, click **ABI** and **Bytecode** (the copy buttons) at the bottom
   of the compiler tab.
5. Create the file `contracts/artifacts/KwizeranaEscrow.json` in this project with:

```json
{
  "abi": <PASTE THE ABI ARRAY HERE>,
  "bytecode": "<PASTE THE BYTECODE STRING HERE>"
}
```

> The deploy script only needs `bytecode` — the ABI is already bundled in
> `lib/web3/escrow.ts` — but keeping both is handy.

### Alternative: compile locally

If you prefer the CLI, compile with solc and copy the bytecode:

```bash
npx --yes solc@0.8.24 --bin --abi contracts/KwizeranaEscrow.sol -o contracts/artifacts
```

Then build `contracts/artifacts/KwizeranaEscrow.json` from the generated
`.bin` / `.abi` files (bytecode goes in `bytecode`, abi goes in `abi`).

---

## 3. Configure deployment env vars

Add these to your `.env.local`:

```bash
# Deployer wallet (the account that pays gas and becomes the deployer)
ESCROW_DEPLOYER_PRIVATE_KEY=0x-your-private-key

# The platform's arbitrator wallet — the ONLY key that can override a seller
# during a dispute. Use a secure wallet you control (ideally a hardware wallet
# or multisig address).
ESCROW_ARBITRATOR_ADDRESS=0x-your-arbitrator-address

# Optional: your Avalanche RPC (defaults to the public C-Chain RPC)
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

> ⚠️ Never commit `.env.local` — it's already in `.gitignore`.

---

## 4. Deploy

```bash
npm run deploy:escrow
```

The script:

1. Loads `.env.local`.
2. Sends the deployment transaction from the deployer wallet.
3. Waits for confirmation and prints the contract address.

Example output:

```
✅ KwizeranaEscrow deployed!
Contract address: 0x1234…abcd

Add this to your .env.local:
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x1234…abcd
```

---

## 5. Add the address to the project

Copy the printed address into `.env.local`:

```bash
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x1234…abcd
```

Then **restart the dev server** (`npm run dev`). The app reads this variable in
`lib/web3/escrow.ts` (`getEscrowAddress()` / `isEscrowDeployed()`).

Also add it to `.env.example` so deployments are documented:

```bash
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=your-deployed-escrow-address
```

---

## 6. Verify & test

1. Confirm the contract is deployed on an Avalanche explorer
   (e.g. <https://snowtrace.io> for mainnet or <https://testnet.snowtrace.io>
   for Fuji testnet) by searching the address.
2. The on-chain escrow uses these well-known Avalanche tokens
   (already configured in `lib/web3/escrow.ts`):
   - **USDT**: `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7`
   - **USDC**: `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`
3. Full on-chain test flow:
   - Seller approves the escrow contract for the token amount.
   - Seller calls `lock(tradeId, buyerAddress, tokenAddress, amount)`.
   - Buyer sends fiat off-platform and marks the trade paid in the app.
   - Seller confirms and calls `release(tradeId)` (or the arbitrator does).
   - On cancel/timeout, `refund(tradeId)` returns tokens to the seller.

---

## 7. Security notes

- **The arbitrator address is the most sensitive key in the system.** It can
  release or refund any trade. Store it in a hardware wallet or multisig.
- The off-chain trade state machine (statuses, receipts, ratings) works even
  before the contract is deployed — only the on-chain token movement requires
  the deployed address.
- Tokens are always held by the **contract**, never by the platform.
