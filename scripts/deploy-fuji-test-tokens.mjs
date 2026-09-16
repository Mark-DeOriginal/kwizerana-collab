import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from "viem";
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

const privateKey = process.env.ESCROW_DEPLOYER_PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("ESCROW_DEPLOYER_PRIVATE_KEY must be a test-only Fuji private key.");
}

const rpcUrl = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim() || avalancheFuji.rpcUrls.default.http[0];
const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
if (await publicClient.getChainId() !== avalancheFuji.id) {
  throw new Error("Refusing deployment: this helper is restricted to Avalanche Fuji (43113).");
}

const artifactPath = path.join(root, "contracts", "artifacts", "contracts", "mocks", "FujiTestToken.sol", "FujiTestToken.json");
if (!fs.existsSync(artifactPath)) throw new Error("Missing contract artifact. Run npm run contract:compile first.");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const abi = parseAbi([
  "constructor(string name_, string symbol_, address initialOwner)",
  "function mint(address recipient, uint256 amount)"
]);
const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

async function deploy(name, symbol) {
  const hash = await walletClient.deployContract({ abi, bytecode: artifact.bytecode, args: [name, symbol, account.address] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${symbol} deployment failed.`);
  const mintHash = await walletClient.writeContract({
    address: receipt.contractAddress,
    abi,
    functionName: "mint",
    args: [account.address, parseUnits("10000", 6)]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash, confirmations: 1 });
  return receipt.contractAddress;
}

console.log("Deploying test-only tokens to Avalanche Fuji…");
const usdt = await deploy("Kwizerana Test USDT", "kUSDT");
const usdc = await deploy("Kwizerana Test USDC", "kUSDC");
console.log(`NEXT_PUBLIC_ESCROW_USDT_ADDRESS=${usdt}`);
console.log(`NEXT_PUBLIC_ESCROW_USDC_ADDRESS=${usdc}`);
console.log(`Minted 10,000 of each token to ${account.address}. These tokens have no monetary value.`);
