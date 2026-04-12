import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { network } from "hardhat";
import { getAddress, type Hex } from "viem";

const OUT_PATH = process.env.ADDRESSES_OUT ?? "/out/addresses.json";

function runHardhatDeployStylus(contractName: string): Hex {
  const stdout = execFileSync(
    "npx",
    ["hardhat", "arb:deploy", "--host", "--network", "localStylus", contractName],
    { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
  );
  process.stdout.write(stdout);
  const match = stdout.match(/Address:\s*(0x[0-9a-fA-F]{40})/);
  if (!match) {
    throw new Error(`[deploy] could not parse address from arb:deploy output for ${contractName}`);
  }
  return match[1] as Hex;
}

async function main() {
  const { viem } = await network.connect("localStylus");

  const [owner] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  console.log(`[deploy] connected to chainId=${chainId} as ${owner.account.address}`);

  console.log("[deploy] deploying MockUSDC...");
  const usdc = await viem.deployContract("MockUSDC");
  console.log(`[deploy]   MockUSDC @ ${usdc.address}`);

  console.log("[deploy] deploying payout-pool via arb:deploy --host...");
  const payoutPoolAddress = runHardhatDeployStylus("payout-pool");
  console.log(`[deploy]   payout-pool @ ${payoutPoolAddress}`);

  console.log("[deploy] initializing payout-pool with USDC address...");
  const initTx = await owner.writeContract({
    address: payoutPoolAddress,
    abi: [
      {
        type: "function",
        name: "initialize",
        stateMutability: "nonpayable",
        inputs: [{ name: "usdc_token", type: "address" }],
        outputs: [],
      },
    ] as const,
    functionName: "initialize",
    args: [usdc.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: initTx });
  console.log("[deploy]   initialize() confirmed");

  const payload = {
    usdc: getAddress(usdc.address),
    payoutPool: getAddress(payoutPoolAddress),
    deployer: getAddress(owner.account.address),
    chainId,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[deploy] wrote ${OUT_PATH}`);
  console.log(JSON.stringify(payload, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[deploy] failed:", err);
    process.exit(1);
  });
