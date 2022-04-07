import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

enum NETWORKS {
  "ZNX_TESTNET" = "ZNX_TESTNET",
}

enum UCC {
  "ZNX_TESTNET" = "0x8A2AA3F73402972FeBBE74a1f99390158C8802Be",
}

const network = NETWORKS[process.env["NETWORK"] as NETWORKS];
if (!network) {
  throw "Invalid network";
}

async function main() {
  // We get the contract to deploy
  const EnsFactory = await ethers.getContractFactory("EnsFactory");
  const ensFactory = await EnsFactory.deploy();

  await ensFactory.deployed();

  const ens = await ensFactory.ens();
  const fifsRegistrar = await ensFactory.fifsRegistrar();
  const reverseRegistrar = await ensFactory.reverseRegistrar();
  const baseRegistrarImplementation =
    await ensFactory.baseRegistrarImplementation();
  const publicResolver = await ensFactory.publicResolver();

  console.log("ENS Registry deployed to:", ens);
  console.log("FifsRegistrar deployed to:", fifsRegistrar);
  console.log("Reverse Registrar deployed to:", reverseRegistrar);
  console.log(
    "Base Registrar Implementation deployed to:",
    baseRegistrarImplementation
  );
  console.log("Public Resolver deployed to:", publicResolver);
  console.log("EnsFactory deployed to:", ensFactory.address);

  const topDomain = "znx";
  const domain = "unl";
  const baseURI = "https://unicial-api.com/v1/";

  const UNLRegistrar = await ethers.getContractFactory("UNLRegistrar");
  const unlRegistrar = await UNLRegistrar.deploy(
    ens,
    baseRegistrarImplementation,
    topDomain,
    domain,
    baseURI
  );

  await unlRegistrar.deployed();

  console.log("UNL Registrar deployed to:", unlRegistrar.address);
  const UNLController = await ethers.getContractFactory("UNLController");

  const unlController = await UNLController.deploy(
    UCC[network],
    unlRegistrar.address
  );

  await unlController.deployed();

  console.log("UNL Controller deployed to:", unlController.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
