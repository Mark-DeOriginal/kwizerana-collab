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
    if (index < 0) continue;
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

const feeBps = Number(process.env.ESCROW_FEE_BPS ?? 100);
if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) throw new Error("ESCROW_FEE_BPS must be an integer from 0 to 10000.");

const privateKey = process.env.ESCROW_DEPLOYER_PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error("A test-only Fuji owner key is required.");

const escrow = requiredAddress("NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS");
const configuredOwner = requiredAddress("ESCROW_OWNER_ADDRESS");
const rpcUrl = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim() || avalancheFuji.rpcUrls.default.http[0];
const account = privateKeyToAccount(privateKey);
const abi = parseAbi([
  "function owner() view returns (address)",
  "function feeRecipient() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function setFeeConfiguration(uint16 newFeeBps, address newFeeRecipient)"
]);

const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
if (await publicClient.getChainId() !== avalancheFuji.id) throw new Error("Refusing to update fees outside Avalanche Fuji.");

const [owner, feeRecipient, currentFeeBps] = await Promise.all([
  publicClient.readContract({ address: escrow, abi, functionName: "owner" }),
  publicClient.readContract({ address: escrow, abi, functionName: "feeRecipient" }),
  publicClient.readContract({ address: escrow, abi, functionName: "feeBps" })
]);
if (getAddress(owner) !== configuredOwner || getAddress(owner) !== getAddress(account.address)) {
  throw new Error("The configured test key is not the deployed escrow owner.");
}
if (Number(currentFeeBps) === feeBps) {
  console.log(`Escrow fee is already ${feeBps} bps (${feeBps / 100}%).`);
  process.exit(0);
}

const { request } = await publicClient.simulateContract({
  account,
  address: escrow,
  abi,
  functionName: "setFeeConfiguration",
  args: [feeBps, feeRecipient]
});
const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });
const hash = await walletClient.writeContract(request);
const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 });
if (receipt.status !== "success") throw new Error("Fee update transaction failed.");

const updatedFeeBps = await publicClient.readContract({ address: escrow, abi, functionName: "feeBps" });
if (Number(updatedFeeBps) !== feeBps) throw new Error("Fee update could not be verified on-chain.");
console.log(`Escrow fee updated to ${feeBps} bps (${feeBps / 100}%).`);
console.log(`Transaction: ${hash}`);
