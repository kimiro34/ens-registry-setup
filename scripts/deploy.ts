import { ethers } from "hardhat";

async function main() {
  // We get the contract to deploy
  const ENSDeployer = await ethers.getContractFactory("ENSDeployer");
  const ensDeployer = await ENSDeployer.deploy();

  await ensDeployer.deployed();

  console.log("ENS Registry deployed to:", await ensDeployer.ens());
  console.log("FifsRegistrar deployed to:", await ensDeployer.fifsRegistrar());
  console.log(
    "Reverse Registrar deployed to:",
    await ensDeployer.reverseRegistrar()
  );
  console.log(
    "Public Resolver deployed to:",
    await ensDeployer.publicResolver()
  );
  console.log("ENS Deployer deployed to:", ensDeployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
