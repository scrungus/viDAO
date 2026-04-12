import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatArbitrumStylus from "@cobuilders/hardhat-arbitrum-stylus";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin, hardhatArbitrumStylus],
  solidity: "0.8.24",
  networks: {
    localStylus: {
      type: "http",
      url: process.env.ARB_RPC_URL ?? "http://localhost:8547",
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY ??
          "0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659",
      ],
    },
  },
};

export default config;
