import fs from "node:fs";
import path from "node:path";
import { createPublicClient, getAddress, http, isAddress } from "viem";
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

const address = requiredAddress("NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS");
const expectedOwner = requiredAddress("ESCROW_OWNER_ADDRESS");
const expectedArbitrator = requiredAddress("ESCROW_ARBITRATOR_ADDRESS");
const expectedFeeRecipient = requiredAddress("ESCROW_FEE_RECIPIENT_ADDRESS");
const expectedTokens = [requiredAddress("NEXT_PUBLIC_ESCROW_USDT_ADDRESS"), requiredAddress("NEXT_PUBLIC_ESCROW_USDC_ADDRESS")];
const expectedFeeBps = Number(process.env.ESCROW_FEE_BPS ?? 20);
const artifactPath = path.join(root, "contracts", "artifacts", "contracts", "KwizeranaEscrow.sol", "KwizeranaEscrow.json");
if (!fs.existsSync(artifactPath)) throw new Error("Missing contract artifact. Run npm run contract:compile first.");
const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim() || avalancheFuji.rpcUrls.default.http[0])
});

const bytecode = await client.getCode({ address });
if (!bytecode || bytecode === "0x") throw new Error(`No contract bytecode found at ${address}.`);

const [owner, arbitrator, feeRecipient, feeBps, gracePeriod, ...tokenAllowed] = await Promise.all([
  client.readContract({ address, abi, functionName: "owner" }),
  client.readContract({ address, abi, functionName: "arbitrator" }),
  client.readContract({ address, abi, functionName: "feeRecipient" }),
  client.readContract({ address, abi, functionName: "feeBps" }),
  client.readContract({ address, abi, functionName: "CANCELLATION_GRACE_PERIOD" }),
  ...expectedTokens.map((token) => client.readContract({ address, abi, functionName: "allowedTokens", args: [token] }))
]);

const checks = [
  ["owner", getAddress(owner) === expectedOwner],
  ["arbitrator", getAddress(arbitrator) === expectedArbitrator],
  ["fee recipient", getAddress(feeRecipient) === expectedFeeRecipient],
  ["fee basis points", Number(feeBps) === expectedFeeBps],
  ["cancellation grace period", Number(gracePeriod) === 1800],
  ...tokenAllowed.map((allowed, index) => [`allowed token ${expectedTokens[index]}`, allowed === true])
];
const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failures.length) throw new Error(`Escrow configuration mismatch: ${failures.join(", ")}.`);

console.log(`Verified Fuji escrow ${address}`);
console.log("Owner, arbitrator, fee recipient, configured fee, 30-minute cancellation protection, and both test tokens match configuration.");
