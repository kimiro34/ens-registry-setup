import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { getDeployParams } from "./scripts/utils";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      gas: 12000000,
      chainId: 31337,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
    },
    deploy: getDeployParams(),
    testnet: {
      url:
        process.env[`RPC_URL_${process.env["NETWORK"]}`] ||
        "https://testrpc1.znxscan.com",
      accounts: process.env["MNEMONIC"]
        ? {
            mnemonic: process.env["MNEMONIC"]
              ? process.env["MNEMONIC"].replace(/,/g, " ")
              : "test test test test test test test test test test test junk",

            initialIndex: 0,
            count: 10,
            path: `m/44'/60'/0'/0`,
          }
        : [
            process.env["PRIV_KEY"]
              ? process.env["PRIV_KEY"]
              : "0x12345678911111111111111111111111111111111111111111111111111111",
          ],
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
