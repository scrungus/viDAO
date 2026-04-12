import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatArbitrumStylus from "@cobuilders/hardhat-arbitrum-stylus";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin, hardhatArbitrumStylus],
  solidity: "0.8.24",
  networks: {
    localStylus: {
      type: "http",
      url: "http://localhost:8547",
    },
  },
};

export default config;
