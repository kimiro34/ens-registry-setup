import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../../.env" });
import hre from "hardhat";

export const getChainId = () => {
  let netowrk = process.env.NETWORK;
  const chainId = hre.network.config.chainId;
  return chainId;
};
