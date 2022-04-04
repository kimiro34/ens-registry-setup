import { BigNumber } from "ethers";
export function getDeployParams() {
  console.log(process.env["NETWORK"]);
  return {
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
  };
}
