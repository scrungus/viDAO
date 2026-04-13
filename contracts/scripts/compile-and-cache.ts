// Builds the contracts and materializes a stable set of artifacts the
// chainpool image and pytest contract tests consume:
//
//   contracts/artifacts-cache/payout-pool.abi.json
//   contracts/artifacts-cache/mock-usdc.abi.json
//   contracts/artifacts-cache/mock-usdc.bytecode.hex
//   contracts/artifacts-cache/contracts.sha256
//
// The sha256 file hashes the Stylus Cargo.toml + src/** so Docker layer caching
// invalidates the chainpool image whenever contract source changes.

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "artifacts-cache");

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "target" || entry.name === "node_modules") continue;
      await walk(p, acc);
    } else if (entry.isFile()) {
      acc.push(p);
    }
  }
  return acc;
}

async function hashTree(dir: string): Promise<string> {
  const files = (await walk(dir)).sort();
  const h = createHash("sha256");
  for (const f of files) {
    const rel = relative(dir, f);
    const body = await readFile(f);
    h.update(rel);
    h.update("\0");
    h.update(body);
    h.update("\0");
  }
  return h.digest("hex");
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("[cache] running hardhat compile...");
  execFileSync("npx", ["hardhat", "compile"], {
    cwd: ROOT,
    stdio: "inherit",
  });

  async function cache(
    name: string,
    artifactPath: string,
    opts: { bytecode?: boolean } = {},
  ) {
    const full = join(ROOT, artifactPath);
    if (!(await exists(full))) {
      throw new Error(`missing artifact ${name} at ${full}`);
    }
    const art = JSON.parse(await readFile(full, "utf8"));
    await writeFile(
      join(OUT, `${name}.abi.json`),
      JSON.stringify(art.abi, null, 2) + "\n",
    );
    if (opts.bytecode) {
      const bc = art.bytecode.startsWith("0x")
        ? art.bytecode
        : `0x${art.bytecode}`;
      await writeFile(join(OUT, `${name}.bytecode.hex`), bc);
    }
  }

  await cache("mock-usdc", "artifacts/contracts/solidity/MockUSDC.sol/MockUSDC.json", {
    bytecode: true,
  });
  await cache("payout-pool", "artifacts/contracts/payout-pool/payout-pool.json");
  await cache(
    "malicious-erc20",
    "artifacts/contracts/solidity/test/MaliciousERC20.sol/MaliciousERC20.json",
    { bytecode: true },
  );
  await cache(
    "reentrant-receiver",
    "artifacts/contracts/solidity/test/ReentrantReceiver.sol/ReentrantReceiver.json",
    { bytecode: true },
  );

  const stylusDir = join(ROOT, "contracts/stylus/payout-pool");
  const hash = await hashTree(stylusDir);
  await writeFile(join(OUT, "contracts.sha256"), `${hash}\n`);

  console.log(`[cache] wrote artifacts-cache/ (stylus sha256=${hash.slice(0, 12)})`);
}

main().catch((err) => {
  console.error("[cache] failed:", err);
  process.exit(1);
});
