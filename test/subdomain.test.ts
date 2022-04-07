import { expect } from "chai";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getChainId } from "./helpers/ChainId";

describe("CollectionManager", function () {
  let UNLRegistrar,
    UNLController,
    ENSFactory,
    ENSRegistry,
    ENSBaseRegistrar,
    ENSPublicResolver,
    UccContract;

  let unlRegistrar: Contract,
    unlController: Contract,
    ensFactory: Contract,
    ensRegistry: Contract,
    ensBaseRegistrar: Contract,
    ensPublicResolver: Contract,
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

  const chainId = Number(getChainId());

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

    ENSFactory = await ethers.getContractFactory("ENSFactory");
    ensFactory = await ENSFactory.deploy();

    await ensFactory.deployed();

    const ensAddr = await ensFactory.ens();
    const baseRegistrarImplementationAddr =
      await ensFactory.baseRegistrarImplementation();
    const publicResolverAddr = await ensFactory.publicResolver();

    ENSRegistry = await ethers.getContractFactory("ENSRegistry");
    ensRegistry = ENSRegistry.attach(ensAddr);

    ENSBaseRegistrar = await ethers.getContractFactory(
      "BaseRegistrarImplementation"
    );
    ensBaseRegistrar = ENSBaseRegistrar.attach(baseRegistrarImplementationAddr);

    ENSPublicResolver = await ethers.getContractFactory("PublicResolver");
    ensPublicResolver = ENSPublicResolver.attach(publicResolverAddr);

    const topDomain = "znx";
    const domain = "unl";
    const baseURI = "https://unicial-api.com/v1/";

    const UNLRegistrar = await ethers.getContractFactory("UNLRegistrar");
    const unlRegistrar = await UNLRegistrar.deploy(
      ensAddr,
      baseRegistrarImplementationAddr,
      topDomain,
      domain,
      baseURI
    );

    await unlRegistrar.deployed();

    const UNLController = await ethers.getContractFactory("UNLController");

    UccContract = await ethers.getContractFactory("UnicialCashToken");
    uccContract = await UccContract.deploy(chainId);

    const unlController = await UNLController.deploy(
      uccContract.address,
      unlRegistrar.address
    );

    await unlController.deployed();

    console.log("==============CONTRACTS DEPLOYED================");
    console.log("UCC Token", uccContract.address);
    console.log("ENS Factory", ensFactory.address);
    console.log("ENS Registry", ensAddr);
    console.log("ENS BaseRegistrar", baseRegistrarImplementationAddr);
    console.log("ENS Public Resolver", publicResolverAddr);
    console.log("UNL Registrar", unlRegistrar.address);
    console.log("UNL Controller", unlController.address);
    console.log("================================================");
  });
  describe("UNL Names", function () {
    it("UNLRegistrar", async function () {
      console.log("Test started");
    });
  });
});
