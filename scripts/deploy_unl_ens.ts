import { ethers } from "hardhat";

async function main() {
  // We get the contract to deploy
  const Infura = await ethers.getContractFactory("Infura");
  const infura = await Infura.deploy();

  await infura.deployed();

  console.log("ENS Registry deployed to:", await infura.ens());
  console.log("FifsRegistrar deployed to:", await infura.fifsRegistrar());
  console.log(
    "Reverse Registrar deployed to:",
    await infura.reverseRegistrar()
  );
  console.log(
    "Base Registrar Implementation deployed to:",
    await infura.BaseRegistrarImplementation()
  );
  console.log("Public Resolver deployed to:", await infura.publicResolver());
  console.log("Infura deployed to:", infura.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
