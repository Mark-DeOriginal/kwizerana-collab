import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalanche } from "viem/chains";

// ── Load .env.local / .env (same behaviour as the rest of the project) ────
const root = process.cwd();
for (const fileName of [".env.local", ".env"]) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const rpcUrl = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim() || "https://api.avax.network/ext/bc/C/rpc";
const privateKey = process.env.ESCROW_DEPLOYER_PRIVATE_KEY?.trim();
const arbitrator = process.env.ESCROW_ARBITRATOR_ADDRESS?.trim();

if (!privateKey) {
  throw new Error("Missing ESCROW_DEPLOYER_PRIVATE_KEY. Add the deployer wallet's private key to .env.local.");
}
if (!arbitrator) {
  throw new Error("Missing ESCROW_ARBITRATOR_ADDRESS. Add the platform's arbitrator wallet address to .env.local.");
}

// ── Bytecode: from the Remix artifact or the ESCROW_BYTECODE env var ───────
let bytecode = process.env.ESCROW_BYTECODE?.trim();
if (!bytecode) {
  const artifactPath = path.join(root, "contracts", "artifacts", "KwizeranaEscrow.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    bytecode = artifact.bytecode;
  }
}
if (!bytecode) {
  throw new Error(
    "Missing bytecode. Export the compiled artifact to contracts/artifacts/KwizeranaEscrow.json " +
      "(see docs/p2p-marketplace/DEPLOY-ESCROW.md) or set ESCROW_BYTECODE in .env.local."
  );
}
if (!bytecode.startsWith("0x")) bytecode = `0x${bytecode}`;

const abi = parseAbi([
  "constructor(address _arbitrator)",
  "function lock(bytes32 tradeId, address buyer, address token, uint256 amount)",
  "function release(bytes32 tradeId)",
  "function refund(bytes32 tradeId)",
  "function arbitrator() view returns (address)",
  "function trades(bytes32) view returns (address seller, address buyer, address token, uint256 amount, bool released, bool refunded)"
]);

const account = privateKeyToAccount(privateKey as `0x${string}`);

console.log(`Deploying KwizeranaEscrow on Avalanche C-Chain (RPC: ${rpcUrl})`);
console.log(`Deployer: ${account.address}`);
console.log(`Arbitrator: ${arbitrator}`);

const walletClient = createWalletClient({ account, chain: avalanche, transport: http(rpcUrl) });
const publicClient = createPublicClient({ chain: avalanche, transport: http(rpcUrl) });

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: [arbitrator]
});

console.log(`Deploy transaction: ${hash}`);
console.log("Waiting for confirmation…");

const receipt = await publicClient.waitForTransactionReceipt({ hash });
const contractAddress = receipt.contractAddress;

console.log("");
console.log("✅ KwizeranaEscrow deployed!");
console.log(`Contract address: ${contractAddress}`);
console.log("");
console.log(`Add this to your .env.local:`);
console.log(`NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${contractAddress}`);
