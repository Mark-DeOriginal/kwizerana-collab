import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, getAddress, http, isAddress, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const root = process.cwd();
for (const fileName of [".env.local", ".env"]) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function requiredAddress(name) {
  const value = process.env[name]?.trim();
  if (!value || !isAddress(value)) throw new Error(`${name} must be a valid address.`);
  return getAddress(value);
}

const rpcUrl = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim() || avalancheFuji.rpcUrls.default.http[0];
const privateKey = process.env.ESCROW_DEPLOYER_PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("ESCROW_DEPLOYER_PRIVATE_KEY must be a test-only Fuji private key.");
}

const owner = requiredAddress("ESCROW_OWNER_ADDRESS");
const arbitrator = requiredAddress("ESCROW_ARBITRATOR_ADDRESS");
const feeRecipient = requiredAddress("ESCROW_FEE_RECIPIENT_ADDRESS");
const allowedTokens = [requiredAddress("NEXT_PUBLIC_ESCROW_USDT_ADDRESS"), requiredAddress("NEXT_PUBLIC_ESCROW_USDC_ADDRESS")];
const feeBps = Number(process.env.ESCROW_FEE_BPS ?? 20);
if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 100) throw new Error("ESCROW_FEE_BPS must be an integer from 0 to 100.");

const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
const actualChainId = await publicClient.getChainId();
if (actualChainId !== avalancheFuji.id) {
  throw new Error(`Refusing deployment: expected Avalanche Fuji chain ${avalancheFuji.id}, RPC returned ${actualChainId}. Mainnet deployment is intentionally disabled until audit approval.`);
}

const artifactPath = path.join(root, "contracts", "artifacts", "contracts", "KwizeranaEscrow.sol", "KwizeranaEscrow.json");
if (!fs.existsSync(artifactPath)) throw new Error("Missing Hardhat artifact. Run npm run contract:compile first.");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const abi = parseAbi([
  "constructor(address initialOwner, address initialArbitrator, address initialFeeRecipient, uint16 initialFeeBps, address[] initialAllowedTokens)"
]);
const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

console.log("Deploying KwizeranaEscrow to Avalanche Fuji (chain 43113)");
console.log(`Deployer: ${account.address}`);
console.log(`Owner: ${owner}`);
console.log(`Arbitrator: ${arbitrator}`);
console.log(`Fee recipient: ${feeRecipient}`);
console.log(`Fee: ${feeBps} bps (${feeBps / 100}%)`);
console.log(`Allowed tokens: ${allowedTokens.join(", ")}`);

const hash = await walletClient.deployContract({
  abi,
  bytecode: artifact.bytecode,
  args: [owner, arbitrator, feeRecipient, feeBps, allowedTokens]
});
console.log(`Deployment transaction: ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 });
if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Escrow deployment failed.");

console.log(`Escrow deployed: ${receipt.contractAddress}`);
console.log("Set NEXT_PUBLIC_ESCROW_CHAIN_ID=43113 and NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS to this address, then verify the source before testing a trade.");
