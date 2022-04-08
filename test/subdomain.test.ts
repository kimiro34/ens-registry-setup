import { expect } from "chai";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getChainId } from "./helpers/ChainId";
const namehash = require("eth-ens-namehash");
const utils = ethers.utils;
const labelhash = (label: string) => utils.keccak256(utils.toUtf8Bytes(label));

const TOP_DOMAIN = "znx";
const DOMAIN = "unl";
const BASE_URI = "https://unicial-api.com/v1/";

const PRICE = BigNumber.from("100000000000000000000");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_32_BYTES =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const MAX_GAS_PRICE = "20000000000";
const ONE_DAY = 60 * 60 * 24;
const MAX_UINT256 = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);
const ethLabelHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(TOP_DOMAIN)
);
const unlLabelHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(DOMAIN));

const ethTopdomainHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32"],
    [ZERO_32_BYTES, ethLabelHash]
  )
);

const unlDomainHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32"],
    [ethTopdomainHash, unlLabelHash]
  )
);
const chainId = Number(getChainId());

async function setupResolver(ens: Contract, resolver: Contract, owner: string) {
  const resolverNode = namehash.hash("resolver");
  const resolverLabel = labelhash("resolver");
  await ens.setSubnodeOwner(ZERO_32_BYTES, resolverLabel, owner);
  await ens.setResolver(resolverNode, resolver.address);
  await resolver["setAddr(bytes32,address)"](resolverNode, resolver.address);
}

describe("UNL Names Contract", function () {
  let UNLRegistrar,
    UNLController,
    ENSRegistry,
    BaseRegistrarImplementation,
    PublicResolver,
    UccContract;

  let unlRegistrar: Contract,
    unlController: Contract,
    ens: Contract,
    baseRegistrarImplementation: Contract,
    resolver: Contract,
    uccContract: Contract;

  let deployer: Signer,
    user: Signer,
    userController: Signer,
    hacker: Signer,
    anotherUser: Signer;

  let deployerAddr: string,
    userAddr: string,
    userControllerAddr: string,
    hackerAddr: string,
    anotherUserAddr: string;

  beforeEach(async function () {
    [deployer, user, userController, hacker, anotherUser] =
      await ethers.getSigners();
    [deployerAddr, userAddr, userControllerAddr, hackerAddr, anotherUserAddr] =
      await Promise.all([
        deployer.getAddress(),
        user.getAddress(),
        userController.getAddress(),
        hacker.getAddress(),
        anotherUser.getAddress(),
      ]);

    ENSRegistry = await ethers.getContractFactory("ENSRegistry");
    PublicResolver = await ethers.getContractFactory("PublicResolver");
    BaseRegistrarImplementation = await ethers.getContractFactory(
      "BaseRegistrarImplementation"
    );

    ens = await ENSRegistry.deploy();
    await ens.deployed();

    baseRegistrarImplementation = await BaseRegistrarImplementation.deploy(
      ens.address,
      namehash.hash(TOP_DOMAIN)
    );
    await baseRegistrarImplementation.deployed();

    expect(await ens.owner(ZERO_32_BYTES)).to.be.eq(deployerAddr);

    // Register eth top domain
    await ens.setSubnodeOwner(
      ZERO_32_BYTES,
      ethLabelHash,
      baseRegistrarImplementation.address
    );

    // Add controller to base
    await baseRegistrarImplementation.addController(deployerAddr);
    // Register unl
    await baseRegistrarImplementation.register(
      unlLabelHash,
      deployerAddr,
      60 * 60 * 24 * 30
    );

    resolver = await PublicResolver.deploy(ens.address, ZERO_ADDRESS);
    await resolver.deployed();
    await setupResolver(ens, resolver, deployerAddr);

    UNLRegistrar = await ethers.getContractFactory("UNLRegistrar");
    unlRegistrar = await UNLRegistrar.deploy(
      ens.address,
      baseRegistrarImplementation.address,
      TOP_DOMAIN,
      DOMAIN,
      BASE_URI
    );

    await unlRegistrar.deployed();

    UNLController = await ethers.getContractFactory("UNLController");

    UccContract = await ethers.getContractFactory("UnicialCashToken");
    uccContract = await UccContract.deploy(chainId);

    unlController = await UNLController.deploy(
      uccContract.address,
      unlRegistrar.address
    );

    await unlController.deployed();
    await unlRegistrar.addController(unlController.address);

    // Transfer DCL domain
    await baseRegistrarImplementation[
      "safeTransferFrom(address,address,uint256)"
    ](deployerAddr, unlRegistrar.address, unlLabelHash);

    uccContract.approve(unlController.address, MAX_UINT256);

    console.log("==============CONTRACTS DEPLOYED================");
    console.log("ENS Registry", ens.address);
    console.log("ENS BaseRegistrar", baseRegistrarImplementation.address);
    console.log("ENS Public Resolver", resolver.address);
    console.log("UNL Registrar", unlRegistrar.address);
    console.log("UNL Controller", unlController.address);
    console.log("UCC Token", uccContract.address);
    console.log("================================================");
  });
  describe("UNLRegistrar", function () {
    describe("Constructor", function () {
      it("should be depoyed with valid arguments", async function () {
        const registry = await unlRegistrar.registry();
        expect(registry).to.be.equal(ens.address);

        const base = await unlRegistrar.base();
        expect(base).to.be.equal(baseRegistrarImplementation.address);

        const topdomain = await unlRegistrar.topdomain();
        expect(topdomain).to.be.equal(TOP_DOMAIN);

        const domain = await unlRegistrar.domain();
        expect(domain).to.be.equal(DOMAIN);

        const topdomainHash = await unlRegistrar.topdomainNameHash();
        expect(topdomainHash).to.be.equal(ethTopdomainHash);

        const domainHash = await unlRegistrar.domainNameHash();
        expect(domainHash).to.be.equal(unlDomainHash);

        const userController = await unlRegistrar.owner();
        expect(userController).to.be.equal(deployerAddr);

        const userControllerOfUNL = await ens.owner(unlDomainHash);
        expect(userControllerOfUNL).to.be.equal(unlRegistrar.address);
      });
    });
  });
});
