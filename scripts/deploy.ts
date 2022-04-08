import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { Contract } from "ethers";
dotenv.config();
const namehash = require("eth-ens-namehash");
const baseTld = "eth";
const tld = "test";
const utils = ethers.utils;
const labelhash = (label: string) => utils.keccak256(utils.toUtf8Bytes(label));
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
  const ENSRegistry = await ethers.getContractFactory("ENSRegistry");
  const FIFSRegistrar = await ethers.getContractFactory("FIFSRegistrar");
  const ReverseRegistrar = await ethers.getContractFactory("ReverseRegistrar");
  const PublicResolver = await ethers.getContractFactory("PublicResolver");
  const BaseRegistrarImplementation = await ethers.getContractFactory(
    "BaseRegistrarImplementation"
  );
  const signers = await ethers.getSigners();
  const accounts = signers.map((s) => s.address);

  const ens = await ENSRegistry.deploy();
  await ens.deployed();
  console.log("ENSRegistry deployed to:", ens.address);

  const baseRegistrarImplementation = await BaseRegistrarImplementation.deploy(
    ens.address,
    namehash.hash(baseTld)
  );
  await baseRegistrarImplementation.deployed();
  console.log(
    "BaseRegistrarImplementation deployed to:",
    baseRegistrarImplementation.address
  );

  console.log(
    "BaseRegistrarImplementation baseNode:",
    await baseRegistrarImplementation.baseNode()
  );

  const resolver = await PublicResolver.deploy(ens.address, ZERO_ADDRESS);
  await resolver.deployed();
  await setupResolver(ens, resolver, accounts);
  console.log("Public resolver deployed to:", resolver.address);

  const registrar = await FIFSRegistrar.deploy(ens.address, namehash.hash(tld));
  await registrar.deployed();
  await setupRegistrar(ens, registrar);
  console.log("FIFSRegistrar deployed to:", registrar.address);

  const reverseRegistrar = await ReverseRegistrar.deploy(
    ens.address,
    resolver.address
  );
  await reverseRegistrar.deployed();
  await setupReverseRegistrar(ens, registrar, reverseRegistrar, accounts);
  console.log("ReverseRegistrar deployed to:", reverseRegistrar.address);
}

async function setupResolver(ens: Contract, resolver: Contract, accounts: any) {
  const resolverNode = namehash.hash("resolver");
  const resolverLabel = labelhash("resolver");
  await ens.setSubnodeOwner(ZERO_HASH, resolverLabel, accounts[0]);
  await ens.setResolver(resolverNode, resolver.address);
  await resolver["setAddr(bytes32,address)"](resolverNode, resolver.address);
}

async function setupRegistrar(ens: Contract, registrar: Contract) {
  await ens.setSubnodeOwner(ZERO_HASH, labelhash(tld), registrar.address);
}

async function setupReverseRegistrar(
  ens: Contract,
  registrar: Contract,
  reverseRegistrar: Contract,
  accounts: any
) {
  await ens.setSubnodeOwner(ZERO_HASH, labelhash("reverse"), accounts[0]);
  await ens.setSubnodeOwner(
    namehash.hash("reverse"),
    labelhash("addr"),
    reverseRegistrar.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
