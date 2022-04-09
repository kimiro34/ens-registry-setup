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

const ethLabelHash = labelhash(TOP_DOMAIN);
const unlLabelHash = labelhash(DOMAIN);

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

const subdomain1 = "kimiro";
const subdomain1WithLocale = "Kimiro";
const subdomain1LabelHash = labelhash(subdomain1);
const subdomain1Hash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32"],
    [unlDomainHash, subdomain1LabelHash]
  )
);

const subdomain2 = "dotfund";
const subdomain2LabelHash = labelhash(subdomain2);

const subdomain3 = "kimiro1";
const subdomain3LabelHash = labelhash(subdomain3);
const subdomain3Hash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32"],
    [unlDomainHash, subdomain3LabelHash]
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
  let UNLRegistrar: any,
    UNLController: any,
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

    // console.log("==============CONTRACTS DEPLOYED================");
    // console.log("ENS Registry", ens.address);
    // console.log("ENS BaseRegistrar", baseRegistrarImplementation.address);
    // console.log("ENS Public Resolver", resolver.address);
    // console.log("UNL Registrar", unlRegistrar.address);
    // console.log("UNL Controller", unlController.address);
    // console.log("UCC Token", uccContract.address);
    // console.log("================================================");
  });
  describe("UNLRegistrar", function () {
    describe("constructor", function () {
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
      it("reverts if registry is not a contract", async function () {
        await expect(
          UNLRegistrar.deploy(
            userAddr,
            baseRegistrarImplementation.address,
            TOP_DOMAIN,
            DOMAIN,
            BASE_URI
          )
        ).to.be.revertedWith("New registry should be a contract");
      });
      it("reverts if base is not a contract", async function () {
        await expect(
          UNLRegistrar.deploy(
            ens.address,
            userAddr,
            TOP_DOMAIN,
            DOMAIN,
            BASE_URI
          )
        ).to.be.revertedWith("New base should be a contract");
      });
      it("reverts if top domain is empty", async function () {
        await expect(
          UNLRegistrar.deploy(
            ens.address,
            baseRegistrarImplementation.address,
            "",
            DOMAIN,
            BASE_URI
          )
        ).to.be.revertedWith("Top domain can not be empty");
      });
      it("reverts if domain is empty", async function () {
        await expect(
          UNLRegistrar.deploy(
            ens.address,
            baseRegistrarImplementation.address,
            TOP_DOMAIN,
            "",
            BASE_URI
          )
        ).to.be.revertedWith("Domain can not be empty");
      });
    });
    describe("register", function () {
      it("should register a name by an authorized account", async function () {
        let balanceOfUser = await unlRegistrar.balanceOf(anotherUserAddr);
        expect(balanceOfUser).to.eq(0);
        let subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(ZERO_ADDRESS);
        let currentResolver = await ens.resolver(subdomain1Hash);
        expect(currentResolver).to.be.equal(ZERO_ADDRESS);
        await unlRegistrar.addController(userControllerAddr);
        await expect(
          unlRegistrar
            .connect(userController)
            .register(subdomain1, anotherUserAddr)
        )
          .to.emit(ens, "NewOwner")
          .withArgs(unlDomainHash, subdomain1LabelHash, anotherUserAddr)
          .to.emit(unlRegistrar, "Transfer")
          .withArgs(
            ZERO_ADDRESS,
            anotherUserAddr,
            BigNumber.from(subdomain1LabelHash).toString()
          )
          .to.emit(unlRegistrar, "NameRegistered")
          .withArgs(
            userControllerAddr,
            anotherUserAddr,
            subdomain1LabelHash,
            subdomain1,
            (await ethers.provider.getBlock("latest")).timestamp + 1
          );
        balanceOfUser = await unlRegistrar.balanceOf(anotherUserAddr);
        expect(balanceOfUser).to.eq(1);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(
          anotherUserAddr,
          0
        );
        const subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(subdomain1);
        subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
        currentResolver = await ens.resolver(subdomain1Hash);
        expect(currentResolver).to.be.equal(ZERO_ADDRESS);
      });
      it("should register a name with numbers by an authorized account", async function () {
        let balanceOfUser = await unlRegistrar.balanceOf(anotherUserAddr);
        expect(balanceOfUser).to.eq(0);
        let subdomainOwner = await ens.owner(subdomain3Hash);
        expect(subdomainOwner).to.be.equal(ZERO_ADDRESS);
        let currentResolver = await ens.resolver(subdomain3Hash);
        expect(currentResolver).to.be.equal(ZERO_ADDRESS);
        await unlRegistrar.addController(userControllerAddr);
        await expect(
          unlRegistrar
            .connect(userController)
            .register(subdomain3, anotherUserAddr)
        )
          .to.emit(ens, "NewOwner")
          .withArgs(unlDomainHash, subdomain3LabelHash, anotherUserAddr)
          .to.emit(unlRegistrar, "Transfer")
          .withArgs(
            ZERO_ADDRESS,
            anotherUserAddr,
            BigNumber.from(subdomain3LabelHash).toString()
          )
          .to.emit(unlRegistrar, "NameRegistered")
          .withArgs(
            userControllerAddr,
            anotherUserAddr,
            subdomain3LabelHash,
            subdomain3,
            (await ethers.provider.getBlock("latest")).timestamp + 1
          );
        balanceOfUser = await unlRegistrar.balanceOf(anotherUserAddr);
        expect(balanceOfUser).to.eq(1);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(
          anotherUserAddr,
          0
        );
        const subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(subdomain3);
        subdomainOwner = await ens.owner(subdomain3Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
        currentResolver = await ens.resolver(subdomain3Hash);
        expect(currentResolver).to.be.equal(ZERO_ADDRESS);
      });
      it("should own more than one name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, anotherUserAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain2, anotherUserAddr);
        const balanceOfUser = await unlRegistrar.balanceOf(anotherUserAddr);
        expect(balanceOfUser).to.eq(2);
      });
      it("reverts when trying to register a name by an unauthorized address", async function () {
        await expect(
          unlRegistrar.connect(hacker).register(subdomain1, userAddr)
        ).to.be.revertedWith("Only a controller can call this method");
      });
      it("reverts when trying to register a name for a not owned domain", async function () {
        const contract = await UNLRegistrar.deploy(
          ens.address,
          baseRegistrarImplementation.address,
          TOP_DOMAIN,
          "unl2",
          BASE_URI
        );
        await contract.addController(userControllerAddr);
        await expect(
          contract.connect(userController).register(subdomain1, userAddr)
        ).to.be.revertedWith("The contract does not own the domain");
      });
      it("reverts when trying to register a name already used", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlController.connect(userController).register(subdomain1, userAddr)
        ).to.be.revertedWith("Subdomain already owned");
        const subdomainWithUppercase = subdomain1.toLocaleUpperCase();
        await expect(
          unlController
            .connect(userController)
            .register(subdomainWithUppercase, userAddr)
        ).to.be.revertedWith("Subdomain already owned");
        await expect(
          unlController
            .connect(userController)
            .register(subdomain1WithLocale, userAddr)
        ).to.be.revertedWith("Subdomain already owned");
      });
    });
    describe("transfer", function () {
      it("should transfer a name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        let userControllerOfTokenId = await unlRegistrar.ownerOf(tokenId);
        expect(userControllerOfTokenId).to.be.equal(userAddr);
        await unlRegistrar
          .connect(user)
          .transferFrom(userAddr, anotherUserAddr, tokenId);
        userControllerOfTokenId = await unlRegistrar.ownerOf(tokenId);
        expect(userControllerOfTokenId).to.be.equal(anotherUserAddr);
        const subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(subdomain1);
        const subdomainHash = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [unlDomainHash, subdomain1LabelHash]
          )
        );
        const subdomainOwner = await ens.owner(subdomainHash);
        expect(subdomainOwner).to.be.equal(userAddr);
      });
      it("should safe transfer a name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        let userControllerOfTokenId = await unlRegistrar.ownerOf(tokenId);
        expect(userControllerOfTokenId).to.be.equal(userAddr);
        await unlRegistrar
          .connect(user)
          ["safeTransferFrom(address,address,uint256)"](
            userAddr,
            anotherUserAddr,
            tokenId
          );
        userControllerOfTokenId = await unlRegistrar.ownerOf(tokenId);
        expect(userControllerOfTokenId).to.be.equal(anotherUserAddr);
      });
      it("should revert when transferring a not owned name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        await expect(
          unlRegistrar
            .connect(hacker)
            ["safeTransferFrom(address,address,uint256)"](
              userAddr,
              anotherUserAddr,
              tokenId
            )
        ).to.be.revertedWith("");
      });
    });
    describe("reclaim :: by controller", function () {
      it("should reclaim an owned name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlRegistrar
            .connect(userController)
            ["reclaim(uint256)"](subdomain1LabelHash)
        )
          .to.emit(ens, "NewOwner")
          .withArgs(unlDomainHash, subdomain1LabelHash, userAddr)
          .to.emit(unlRegistrar, "Reclaimed")
          .withArgs(
            userControllerAddr,
            userAddr,
            BigNumber.from(subdomain1LabelHash).toString()
          );
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(userAddr);
      });
      it("should reclaim a name previously transferred", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await unlRegistrar
          .connect(user)
          .transferFrom(userAddr, anotherUserAddr, subdomain1LabelHash);
        await unlRegistrar
          .connect(userController)
          ["reclaim(uint256)"](subdomain1LabelHash);
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
      });
      it("reverts when trying to reclaim by an unauthorized user", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlRegistrar.connect(hacker)["reclaim(uint256)"](subdomain1LabelHash)
        ).to.be.revertedWith("Only a controller can call this method");
      });
      it("reverts when trying to reclaim an non-exist name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await expect(
          unlRegistrar
            .connect(userController)
            ["reclaim(uint256)"](subdomain1LabelHash)
        ).to.be.revertedWith("ERC721: owner query for nonexistent token");
      });
    });
    describe("reclaim :: by owner", function () {
      it("should reclaim an owned name", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlRegistrar
            .connect(user)
            ["reclaim(uint256,address)"](subdomain1LabelHash, userAddr)
        )
          .to.emit(ens, "NewOwner")
          .withArgs(unlDomainHash, subdomain1LabelHash, userAddr)
          .to.emit(unlRegistrar, "Reclaimed")
          .withArgs(
            userAddr,
            userAddr,
            BigNumber.from(subdomain1LabelHash).toString()
          );
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(userAddr);
      });
      it("should reclaim a name by an operator", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await unlRegistrar
          .connect(user)
          .approve(anotherUserAddr, subdomain1LabelHash);
        await unlRegistrar
          .connect(anotherUser)
          ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr);
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
      });
      it("should reclaim a name by an approval for all", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await unlRegistrar
          .connect(user)
          .setApprovalForAll(anotherUserAddr, true);
        await unlRegistrar
          .connect(anotherUser)
          ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr);
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
      });
      it("should reclaim a name previously transferred", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await unlRegistrar
          .connect(user)
          .transferFrom(userAddr, anotherUserAddr, subdomain1LabelHash);
        await unlRegistrar
          .connect(anotherUser)
          ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr);
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
      });
      it("should assign ownership to an account other than the sender", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlRegistrar
            .connect(user)
            ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr)
        )
          .to.emit(ens, "NewOwner")
          .withArgs(unlDomainHash, subdomain1LabelHash, anotherUserAddr)
          .to.emit(unlRegistrar, "Reclaimed")
          .withArgs(
            userAddr,
            anotherUserAddr,
            BigNumber.from(subdomain1LabelHash).toString()
          );
        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(anotherUserAddr);
      });
      it("reverts when trying to reclaim by an unauthorized user", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlRegistrar
            .connect(hacker)
            ["reclaim(uint256,address)"](subdomain1LabelHash, hackerAddr)
        ).to.be.revertedWith(
          "Only an authorized account can change the subdomain settings"
        );
      });
      it("reverts when trying to reclaim an non-exist name", async function () {
        await expect(
          unlRegistrar
            .connect(user)
            ["reclaim(uint256,address)"](subdomain1LabelHash, userAddr)
        ).to.be.revertedWith("ERC721: operator query for nonexistent token");
      });
    });
    describe("onERC721Received", function () {
      it("reverts when transferring a token to the registrar by an unauthorized account", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        await expect(
          unlRegistrar
            .connect(user)
            ["safeTransferFrom(address,address,uint256)"](
              userAddr,
              unlRegistrar.address,
              subdomain1LabelHash
            )
        ).to.be.revertedWith("Only base can send NFTs to this contract");
      });
    });
    describe("tokenURI", function () {
      it("should return the token URI", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        let tokenURI = await unlRegistrar.tokenURI(subdomain1LabelHash);
        expect(tokenURI).to.be.equal(`${BASE_URI}${subdomain1}`);
        await unlRegistrar
          .connect(userController)
          .register(subdomain2, userAddr);
        tokenURI = await unlRegistrar.tokenURI(subdomain2LabelHash);
        expect(tokenURI).to.be.equal(`${BASE_URI}${subdomain2}`);
      });
      it("should return the token URI at lowercase for uppercase", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1WithLocale, userAddr);
        let tokenURI = await unlRegistrar.tokenURI(subdomain1LabelHash);
        expect(tokenURI).to.be.equal(`${BASE_URI}${subdomain1}`);
      });
      it("should return an empty string if base URI is not set", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        let tokenURI = await unlRegistrar.tokenURI(subdomain1LabelHash);
        expect(tokenURI).to.be.equal(`${BASE_URI}${subdomain1}`);
        await unlRegistrar.updateBaseURI("");
        tokenURI = await unlRegistrar.tokenURI(subdomain1LabelHash);
        expect(tokenURI).to.be.equal("");
      });
      it("reverts when trying to return a token URI for an unexisting token", async function () {
        await expect(unlRegistrar.tokenURI(subdomain1LabelHash)).to.be.reverted;
      });
    });
    describe("available", function () {
      it("should return whether a name is available or not", async function () {
        let isAvailable = await unlRegistrar.available(subdomain1);
        expect(isAvailable).to.be.equal(true);
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        isAvailable = await unlRegistrar.available(subdomain1);
        expect(isAvailable).to.be.equal(false);
        isAvailable = await unlRegistrar.available(subdomain1WithLocale);
        expect(isAvailable).to.be.equal(false);
        isAvailable = await unlRegistrar.available(subdomain2);
        expect(isAvailable).to.be.equal(true);
      });
    });
    describe("reclaimDomain", function () {
      it("should reclaim a domain previously transferred to the registrar contract", async function () {
        const labelHash = labelhash("unl2");
        const hash = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [ethTopdomainHash, labelHash]
          )
        );
        let subdomainOwner = await ens.owner(hash);
        expect(subdomainOwner).to.be.equal(ZERO_ADDRESS);
        // Register unl2
        await baseRegistrarImplementation.register(
          labelhash("unl2"),
          deployerAddr,
          60 * 60 * 24 * 30
        );
        subdomainOwner = await ens.owner(hash);
        expect(subdomainOwner).to.be.equal(deployerAddr);
        // Transfer unl2 domain to registrar
        await baseRegistrarImplementation.transferFrom(
          deployerAddr,
          unlRegistrar.address,
          labelHash
        );
        subdomainOwner = await ens.owner(hash);
        expect(subdomainOwner).to.be.equal(deployerAddr);
        await expect(unlRegistrar.reclaimDomain(labelHash))
          .to.emit(ens, "NewOwner")
          .withArgs(ethTopdomainHash, labelHash, unlRegistrar.address)
          .to.emit(unlRegistrar, "DomainReclaimed")
          .withArgs(BigNumber.from(labelHash).toString());
        subdomainOwner = await ens.owner(hash);
        expect(subdomainOwner).to.be.equal(unlRegistrar.address);
      });
      it("should allow to claim a domain already owned", async function () {
        await unlRegistrar.reclaimDomain(unlLabelHash);
      });
      it("reverts when trying to reclaim a domain by an unauthorized user", async function () {
        await expect(
          unlRegistrar.connect(hacker).reclaimDomain(unlLabelHash)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("transferDomainOwnership", function () {
      it("should transfer an owned domain", async function () {
        let domainOwner = await baseRegistrarImplementation.ownerOf(
          unlLabelHash
        );
        expect(domainOwner).to.be.equal(unlRegistrar.address);
        let subdomainOwner = await ens.owner(unlDomainHash);
        expect(subdomainOwner).to.be.equal(unlRegistrar.address);
        await expect(
          unlRegistrar.transferDomainOwnership(userAddr, unlLabelHash)
        )
          .to.emit(baseRegistrarImplementation, "Transfer")
          .withArgs(unlRegistrar.address, userAddr, unlLabelHash)
          .to.emit(unlRegistrar, "DomainTransferred")
          .withArgs(userAddr, BigNumber.from(unlLabelHash).toString());
        domainOwner = await baseRegistrarImplementation.ownerOf(unlLabelHash);
        expect(domainOwner).to.be.equal(userAddr);
        subdomainOwner = await ens.owner(unlDomainHash);
        expect(subdomainOwner).to.be.equal(unlRegistrar.address);
        await baseRegistrarImplementation
          .connect(user)
          ["reclaim(uint256,address)"](unlLabelHash, userAddr);
        domainOwner = await baseRegistrarImplementation.ownerOf(unlLabelHash);
        expect(domainOwner).to.be.equal(userAddr);
        subdomainOwner = await ens.owner(unlDomainHash);
        expect(subdomainOwner).to.be.equal(userAddr);
      });
      it("reverts when transferring a not owned domain", async function () {
        await expect(
          unlRegistrar.transferDomainOwnership(userAddr, labelhash("dcl2"))
        ).to.be.reverted;
      });
      it("reverts when transferring a domain by an unauthorized user", async function () {
        await expect(
          unlRegistrar
            .connect(hacker)
            .transferDomainOwnership(userAddr, unlLabelHash)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("addController", function () {
      it("should add a controller", async function () {
        let isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(false);
        await expect(unlRegistrar.addController(userAddr))
          .to.emit(unlRegistrar, "ControllerAdded")
          .withArgs(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(true);
        await unlRegistrar.removeController(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(false);
        await unlRegistrar.addController(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(true);
      });
      it("reverts when trying to add a controller by an unauthorized user", async function () {
        await expect(
          unlRegistrar.connect(hacker).addController(userAddr)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("reverts when trying to add a controller already added", async function () {
        await unlRegistrar.addController(userAddr);
        await expect(unlRegistrar.addController(userAddr)).to.be.revertedWith(
          "The controller was already added"
        );
      });
    });
    describe("removeController", function () {
      it("should remove a controller", async function () {
        let isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(false);
        await unlRegistrar.addController(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(true);
        await expect(unlRegistrar.removeController(userAddr))
          .to.emit(unlRegistrar, "ControllerRemoved")
          .withArgs(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(false);
        await unlRegistrar.addController(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(true);
        await unlRegistrar.removeController(userAddr);
        isController = await unlRegistrar.controllers(userAddr);
        expect(isController).to.be.equal(false);
      });
      it("reverts when trying to remove a controller by an unauthorized user", async function () {
        await unlRegistrar.addController(userAddr);
        await expect(
          unlRegistrar.connect(hacker).removeController(userAddr)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("reverts when trying to remove a controller already removed or unexistant", async function () {
        await expect(
          unlRegistrar.removeController(userAddr)
        ).to.be.revertedWith("The controller is already disabled");
        await unlRegistrar.addController(userAddr);
        await unlRegistrar.removeController(userAddr);
        await expect(
          unlRegistrar.removeController(userAddr)
        ).to.be.revertedWith("The controller is already disabled");
      });
    });
    describe("updateRegistry", function () {
      it("should update registry", async function () {
        let registry = await unlRegistrar.registry();
        expect(registry).to.be.equal(ens.address);
        await expect(
          unlRegistrar.updateRegistry(baseRegistrarImplementation.address)
        )
          .to.emit(unlRegistrar, "RegistryUpdated")
          .withArgs(ens.address, baseRegistrarImplementation.address);
        registry = await unlRegistrar.registry();
        expect(registry).to.be.equal(baseRegistrarImplementation.address);
      });
      it("reverts when updating the registry with the same contract", async function () {
        await expect(
          unlRegistrar.updateRegistry(ens.address)
        ).to.be.revertedWith("New registry should be different from old");
      });
      it("reverts when updating the registry with an EOA", async function () {
        await expect(unlRegistrar.updateRegistry(userAddr)).to.be.revertedWith(
          "New registry should be a contract"
        );
      });
      it("reverts when trying to update the registry by a hacker", async function () {
        await expect(
          unlRegistrar
            .connect(hacker)
            .updateRegistry(baseRegistrarImplementation.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("updateBase", function () {
      it("should update base", async function () {
        let base = await unlRegistrar.base();
        expect(base).to.be.equal(baseRegistrarImplementation.address);
        await expect(unlRegistrar.updateBase(ens.address))
          .to.emit(unlRegistrar, "BaseUpdated")
          .withArgs(baseRegistrarImplementation.address, ens.address);
        base = await unlRegistrar.base();
        expect(base).to.be.equal(ens.address);
      });
      it("reverts when updating the base with the same contract", async function () {
        await expect(
          unlRegistrar.updateBase(baseRegistrarImplementation.address)
        ).to.be.revertedWith("New base should be different from old");
      });
      it("reverts when updating the registry with an EOA", async function () {
        await expect(unlRegistrar.updateBase(userAddr)).to.be.revertedWith(
          "New base should be a contract"
        );
      });
      it("reverts when trying to update the base by a hacker", async function () {
        await expect(
          unlRegistrar.connect(hacker).updateRegistry(ens.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("updateBaseURI", function () {
      it("should update base URI", async function () {
        await unlRegistrar.addController(userControllerAddr);
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        let baseURI = await unlRegistrar.baseURI();
        expect(BASE_URI).to.be.equal(baseURI);
        let uri = await unlRegistrar.tokenURI(subdomain1LabelHash);
        expect(uri).to.be.equal(`${BASE_URI}${subdomain1}`);
        const newBaseURI = "https";
        await expect(unlRegistrar.updateBaseURI(newBaseURI))
          .to.emit(unlRegistrar, "BaseURI")
          .withArgs(BASE_URI, newBaseURI);
        baseURI = await unlRegistrar.baseURI();
        expect(newBaseURI).to.be.equal(baseURI);
        uri = await unlRegistrar.tokenURI(subdomain1LabelHash);
        expect(uri).to.be.equal(`${newBaseURI}${subdomain1}`);
      });
      it("reverts when trying to change with the same value", async function () {
        await expect(unlRegistrar.updateBaseURI(BASE_URI)).to.be.revertedWith(
          "Base URI should be different from old"
        );
      });
      it("reverts when trying to change values by hacker", async function () {
        await expect(
          unlRegistrar.connect(hacker).updateBaseURI("https")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("getTokenId", function () {
      beforeEach(async () => {
        await unlRegistrar.addController(userControllerAddr);
      });
      it("should return the token id for a subdomain", async function () {
        await unlRegistrar
          .connect(userController)
          .register(subdomain1, userAddr);
        let tokenId = await unlRegistrar.getTokenId(subdomain1);
        expect(tokenId).to.eq(BigNumber.from(subdomain1LabelHash));
        await unlRegistrar
          .connect(userController)
          .register(subdomain2, userAddr);
        tokenId = await unlRegistrar.getTokenId(subdomain2);
        expect(tokenId).to.eq(BigNumber.from(subdomain2LabelHash));
        await unlRegistrar
          .connect(userController)
          .register(subdomain3, userAddr);
        tokenId = await unlRegistrar.getTokenId(subdomain3);
        expect(tokenId).to.eq(BigNumber.from(subdomain3LabelHash));
      });
      it("should get token id of a subdomain with uppercases", async function () {
        await unlRegistrar
          .connect(userController)
          .register(subdomain1WithLocale, userAddr);
        const tokenId = await unlRegistrar.getTokenId(subdomain1WithLocale);
        expect(tokenId).to.eq(BigNumber.from(subdomain1LabelHash));
        const sameTokenId = await unlRegistrar.getTokenId(subdomain1);
        expect(tokenId).to.eq(sameTokenId);
      });
      it("reverts when trying to get a token id for a non-existing subdomain", async function () {
        await expect(unlRegistrar.getTokenId(subdomain1WithLocale)).to.be
          .reverted;
      });
    });
    describe("setResolver", function () {
      it("should set the resolver", async function () {
        await expect(unlRegistrar.setResolver(resolver.address))
          .to.emit(ens, "NewResolver")
          .withArgs(unlDomainHash, resolver.address)
          .to.emit(unlRegistrar, "ResolverUpdated")
          .withArgs(ZERO_ADDRESS, resolver.address);
      });
      it("reverts when trying to update the resolver with a non-contract addrress", async function () {
        await expect(unlRegistrar.setResolver(userAddr)).to.be.revertedWith(
          "New resolver should be a contract"
        );
      });
      it("reverts when trying to update the resolver by an unauthorized user", async function () {
        await expect(
          unlRegistrar.connect(hacker).setResolver(resolver.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("reverts when trying to update the resolver with the same address", async function () {
        await unlRegistrar.setResolver(resolver.address);
        await expect(
          unlRegistrar.setResolver(resolver.address)
        ).to.be.revertedWith("New resolver should be different from old");
      });
      it("reverts when trying to update the resolver with an invalid address", async function () {
        await expect(unlRegistrar.setResolver(ens.address)).to.be.revertedWith(
          "Invalid address"
        );
        await expect(
          unlRegistrar.setResolver(baseRegistrarImplementation.address)
        ).to.be.revertedWith("Invalid address");
        await expect(
          unlRegistrar.setResolver(unlRegistrar.address)
        ).to.be.revertedWith("Invalid address");
      });
    });
    describe("forwardToResolver", function () {
      it("should forward a call the resolver", async function () {
        let target = await resolver["addr(bytes32)"](unlDomainHash);
        expect(target).to.be.equal(ZERO_ADDRESS);
        await unlRegistrar.setResolver(resolver.address);
        // setAddr(bytes32,address)
        const data = `0xd5fa2b00${unlDomainHash.replace(
          "0x",
          ""
        )}${userAddr.replace("0x", "000000000000000000000000")}`;
        await expect(unlRegistrar.forwardToResolver(data))
          .to.emit(unlRegistrar, "CallForwarwedToResolver")
          .withArgs(resolver.address, data.toLowerCase(), "0x");
        target = await resolver["addr(bytes32)"](unlDomainHash);
        expect(target).to.be.equal(userAddr);
      });
      it("reverts if if call failed", async function () {
        await unlRegistrar.setResolver(resolver.address);
        // setAddr(bytes32,address)
        const data = `0xd5fa2b00${ethTopdomainHash.replace(
          "0x",
          ""
        )}${userAddr.replace("0x", "000000000000000000000000")}`;
        await expect(unlRegistrar.forwardToResolver(data)).to.be.revertedWith(
          "Call failed"
        );
      });
      it("reverts when trying to forward a call by an unathorized user", async function () {
        await expect(
          unlRegistrar.connect(hacker).forwardToResolver(resolver.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
      it("reverts when trying to forward to an invalid address", async function () {
        await unlRegistrar.setResolver(resolver.address);
        await unlRegistrar.updateBase(resolver.address);
        await expect(
          unlRegistrar.forwardToResolver(ZERO_32_BYTES)
        ).to.be.revertedWith("Invalid address");
      });
    });
  });
  describe("DCLController", function () {
    beforeEach(async () => {
      await uccContract.mint(userAddr, MAX_UINT256);
      await uccContract
        .connect(user)
        .approve(unlController.address, MAX_UINT256);
    });

    describe("Constructor", function () {
      it("should be depoyed with valid arguments", async function () {
        const contract = await UNLController.deploy(
          uccContract.address,
          unlRegistrar.address
        );

        const acceptedToken = await contract.acceptedToken();
        expect(acceptedToken).to.be.equal(uccContract.address);

        const registrar = await contract.registrar();
        expect(registrar).to.be.equal(unlRegistrar.address);

        const price = await unlController.PRICE();
        expect(price).to.eq(PRICE);

        const maxGasPrice = await unlController.maxGasPrice();
        expect(maxGasPrice).to.eq(MAX_GAS_PRICE);
      });

      it("reverts if acceptedToken is not a contract", async function () {
        await expect(
          UNLController.deploy(userAddr, unlRegistrar.address)
        ).to.be.revertedWith("Accepted token should be a contract");
      });

      it("reverts if registrar is not a contract", async function () {
        await expect(
          UNLController.deploy(uccContract.address, userAddr)
        ).to.be.revertedWith("Registrar should be a contract");
      });
    });

    describe("Register", function () {
      it("should register a name", async function () {
        await expect(
          unlController.connect(user).register(subdomain1, userAddr, {
            gasPrice: MAX_GAS_PRICE,
          })
        )
          .to.emit(ens, "NewOwner")
          .withArgs(unlDomainHash, subdomain1LabelHash, userAddr)
          .to.emit(unlRegistrar, "Transfer")
          .withArgs(
            ZERO_ADDRESS,
            userAddr,
            BigNumber.from(subdomain1LabelHash).toString()
          )
          .to.emit(unlRegistrar, "NameRegistered")
          .withArgs(
            unlController.address,
            unlController.address,
            subdomain1LabelHash,
            subdomain1
          )
          .to.emit(uccContract, "Burn")
          .withArgs(unlController.address, PRICE.toString())
          .to.emit(unlController, "NameBought")
          .withArgs(userAddr, userAddr, PRICE.toString(), subdomain1);

        const balanceOfUser = await unlRegistrar.balanceOf(userAddr);
        expect(balanceOfUser).to.eq(1);

        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        const subdomain = await unlRegistrar.subdomains(tokenId);

        expect(subdomain).to.be.equal(subdomain1);

        const subdomainOwner = await ens.owner(subdomain1Hash);
        expect(subdomainOwner).to.be.equal(userAddr);

        const currentResolver = await ens.resolver(subdomain1Hash);
        expect(currentResolver).to.be.equal(ZERO_ADDRESS);
      });

      it("should register a name with a-z", async function () {
        let name = "qwertyuiopasdfg";
        await unlController.connect(user).register(name, userAddr);

        let tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        let subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);

        name = "hjklzxcvbnm";
        await unlController.connect(user).register(name, userAddr);
        tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 1);
        subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);

        name = "abc";
        await unlController.connect(user).register(name, userAddr);
        tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 2);
        subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);
      });

      it("should register a name with A-Z", async function () {
        let name = "QWERTYUIOPASDFG";
        await unlController.connect(user).register(name, userAddr);

        let tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        let subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);

        name = "HJKLZXCVBNM";
        await unlController.connect(user).register(name, userAddr);
        tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 1);
        subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);

        name = "ABC";
        await unlController.connect(user).register(name, userAddr);
        tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 2);
        subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);
      });

      it("should register a name with 0-9", async function () {
        const name = "123456789";
        await unlController.connect(user).register(name, userAddr);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        const subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);
      });

      it("should register a name with a-A and 0-9", async function () {
        const name = "123456789aBcd";
        await unlController.connect(user).register(name, userAddr);
        const tokenId = await unlRegistrar.tokenOfOwnerByIndex(userAddr, 0);
        const subdomain = await unlRegistrar.subdomains(tokenId);
        expect(subdomain).to.be.equal(name);
      });

      it("reverts when trying to register a name with a gas price higher than max gas price", async function () {
        await expect(
          unlController.connect(user).register(subdomain1, userAddr, {
            gasPrice: MAX_GAS_PRICE + 1,
          })
        ).to.be.revertedWith("Maximum gas price allowed exceeded");
      });

      it("reverts when the name has invalid characters", async function () {
        let name = "the username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        name = "_username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        name = "úsername";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        name = '^"}username';
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        name = "👍username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        name = "€username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        name = "𐍈username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Edge cases on ascii table 0x2F
        name = ":username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Edge cases on ascii table 0x3A
        name = "/username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Edge cases on ascii table 0x40
        name = "@username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Edge cases on ascii table 0x5b
        name = "[username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Edge cases on ascii table 0x60
        name = "`username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Edge cases on ascii table 0x7B
        name = "{username";
        await expect(
          unlController
            .connect(user)
            .register(name, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith("Invalid Character");

        // Special characters
        // With ascii 0x1f (US)
        let tx: any = {
          from: userController,
          to: unlController.address,
          data: `0x1e59c5290000000000000000000000000000000000000000000000000000000000000040000000000000000000000000${userAddr.replace(
            "0x",
            ""
          )}00000000000000000000000000000000000000000000000000000000000000031f60600000000000000000000000000000000000000000000000000000000000`,
        };
        await expect(deployer.sendTransaction(tx)).to.be.revertedWith(
          "Invalid Character"
        );

        // With ascii 0x00 (NULL)
        tx = {
          from: userController,
          to: unlController.address,
          data: `0x1e59c5290000000000000000000000000000000000000000000000000000000000000040000000000000000000000000${userAddr.replace(
            "0x",
            ""
          )}00000000000000000000000000000000000000000000000000000000000000030060600000000000000000000000000000000000000000000000000000000000`,
        };
        await expect(deployer.sendTransaction(tx)).to.be.revertedWith(
          "Invalid Character"
        );

        // With ascii 0x08 (BACKSPACE)
        tx = {
          from: userController,
          to: unlController.address,
          data: `0x1e59c5290000000000000000000000000000000000000000000000000000000000000040000000000000000000000000${userAddr.replace(
            "0x",
            ""
          )}00000000000000000000000000000000000000000000000000000000000000030860600000000000000000000000000000000000000000000000000000000000`,
        };
        await expect(deployer.sendTransaction(tx)).to.be.revertedWith(
          "Invalid Character"
        );
      });

      it("reverts when username is lower than 2 and greather than 15 bytes", async function () {
        const bigUsername = "abignameregistry";
        await expect(
          unlController
            .connect(user)
            .register(bigUsername, userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith(
          "Name should be greather than or equal to 2 and less than or equal to 15"
        );
      });

      it("reverts when trying to register a name with a lenght < 3", async function () {
        await expect(
          unlController
            .connect(user)
            .register("", userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith(
          "Name should be greather than or equal to 2 and less than or equal to 15"
        );

        await expect(
          unlController
            .connect(user)
            .register("a", userAddr, { gasPrice: MAX_GAS_PRICE })
        ).to.be.revertedWith(
          "Name should be greather than or equal to 2 and less than or equal to 15"
        );
      });

      it("reverts when trying to register a name with no balance", async function () {
        const balance = await uccContract.balanceOf(userAddr);
        await uccContract.connect(user).burn(balance);
        await expect(
          unlController.connect(user).register(subdomain1, userAddr)
        ).to.be.revertedWith("Insufficient funds");
      });

      it("reverts when trying to register a name without approval", async function () {
        await uccContract.connect(user).approve(unlController.address, 0);
        await expect(
          unlController.connect(user).register(subdomain1, userAddr, {
            gasPrice: MAX_GAS_PRICE,
          })
        ).to.be.revertedWith(
          "The contract is not authorized to use the accepted token on sender behalf"
        );
      });
    });

    describe("updateMaxGasPrice", function () {
      it("should update the max gas price", async function () {
        let maxGasPrice = await unlController.maxGasPrice();
        expect(maxGasPrice).to.eq(MAX_GAS_PRICE);

        const newMaxGasPrice = 1000000000;
        await expect(unlController.updateMaxGasPrice(newMaxGasPrice))
          .to.emit(unlController, "MaxGasPriceChanged")
          .withArgs(MAX_GAS_PRICE, newMaxGasPrice);

        maxGasPrice = await unlController.maxGasPrice();
        expect(maxGasPrice).to.eq(newMaxGasPrice);
      });

      it("should update the max gas price to 1 gwei", async function () {
        const newMaxGasPrice = 1000000000;
        await unlController.updateMaxGasPrice(newMaxGasPrice);

        const maxGasPrice = await unlController.maxGasPrice();
        expect(maxGasPrice).to.eq(newMaxGasPrice);
      });

      it("should update the max gas price to 30 gwei", async function () {
        const newMaxGasPrice = 30000000000;
        await unlController.updateMaxGasPrice(newMaxGasPrice);

        const maxGasPrice = await unlController.maxGasPrice();
        expect(maxGasPrice).to.eq(newMaxGasPrice);
      });

      it("reverts when updating the max gas price by an unauthorized user", async function () {
        const newMaxGasPrice = 10000000000;
        await expect(
          unlController.connect(hacker).updateMaxGasPrice(newMaxGasPrice)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("reverts when updating the max gas price with lower than 1 gwei", async function () {
        await expect(unlController.updateMaxGasPrice(0)).to.be.revertedWith(
          "Max gas price should be greater than or equal to 1 gwei"
        );

        await expect(
          unlController.updateMaxGasPrice(999999999)
        ).to.be.revertedWith(
          "Max gas price should be greater than or equal to 1 gwei"
        );
      });

      it("reverts when updating the max gas price with the same value", async function () {
        await expect(
          unlController.updateMaxGasPrice(MAX_GAS_PRICE)
        ).to.be.revertedWith("Max gas price should be different");
      });
    });
  });
  describe("ENS ecosystem", function () {
    beforeEach(async () => {
      await uccContract.mint(userAddr, MAX_UINT256.div(BigNumber.from(2)));
      await uccContract
        .connect(user)
        .approve(unlController.address, MAX_UINT256);
      await uccContract.mint(
        anotherUserAddr,
        MAX_UINT256.div(BigNumber.from(2))
      );
      await uccContract
        .connect(anotherUser)
        .approve(unlController.address, MAX_UINT256);
    });
    it("should set a resolver and target address", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      const subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(userAddr);

      await ens.connect(user).setResolver(subdomain1Hash, resolver.address);

      const resolverFromENS = await ens.resolver(subdomain1Hash);
      expect(resolverFromENS).to.be.equal(resolver.address);

      await resolver
        .connect(user)
        ["setAddr(bytes32,address)"](subdomain1Hash, anotherUserAddr);

      const target = await resolver["addr(bytes32)"](subdomain1Hash);
      expect(target).to.be.equal(anotherUserAddr);
    });

    it("should change the resolver and target address if it is still the owner in the registry", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await unlRegistrar
        .connect(user)
        .transferFrom(userAddr, anotherUserAddr, subdomain1LabelHash);

      const subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(userAddr);

      await ens.connect(user).setResolver(subdomain1Hash, resolver.address);

      const resolverFromENS = await ens.resolver(subdomain1Hash);
      expect(resolverFromENS).to.be.equal(resolver.address);

      await resolver
        .connect(user)
        ["setAddr(bytes32,address)"](subdomain1Hash, anotherUserAddr);

      const target = await resolver["addr(bytes32)"](subdomain1Hash);
      expect(target).to.be.equal(anotherUserAddr);
    });

    it("should change the resolver and target address if a reclaim was made", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await unlRegistrar
        .connect(user)
        .transferFrom(userAddr, anotherUserAddr, subdomain1LabelHash);

      await unlRegistrar
        .connect(anotherUser)
        ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr);

      const subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(anotherUserAddr);

      await ens
        .connect(anotherUser)
        .setResolver(subdomain1Hash, resolver.address);

      const resolverFromENS = await ens.resolver(subdomain1Hash);
      expect(resolverFromENS).to.be.equal(resolver.address);

      await resolver
        .connect(anotherUser)
        ["setAddr(bytes32,address)"](subdomain1Hash, userAddr);

      let target = await resolver["addr(bytes32)"](subdomain1Hash);
      expect(target).to.be.equal(userAddr);

      await resolver
        .connect(anotherUser)
        ["setAddr(bytes32,address)"](subdomain1Hash, anotherUserAddr);

      target = await resolver["addr(bytes32)"](subdomain1Hash);
      expect(target).to.be.equal(anotherUserAddr);
    });

    it("should change the owner of the node", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await ens.connect(user).setOwner(subdomain1Hash, anotherUserAddr);

      const subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(anotherUserAddr);
    });

    it("should recover the owner after reclaim", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await ens.connect(user).setOwner(subdomain1Hash, anotherUserAddr);

      let subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(anotherUserAddr);

      await unlRegistrar
        .connect(user)
        ["reclaim(uint256,address)"](subdomain1LabelHash, userAddr);

      subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(userAddr);
    });

    it("should allow the creation of sub nodes from a subdomain", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await ens
        .connect(user)
        .setSubnodeOwner(subdomain1Hash, subdomain2LabelHash, anotherUserAddr);

      const subdomainOwner = await ens.owner(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [subdomain1Hash, subdomain2LabelHash]
          )
        )
      );
      expect(subdomainOwner).to.be.equal(anotherUserAddr);
    });

    it("reverts when trying to change the resolver by an unauthorized account [ @skip-on-coverage ]", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await expect(
        ens.connect(hacker).setResolver(subdomain1Hash, resolver.address)
      ).to.be.reverted;
    });

    it("reverts when trying to change the target address by an unauthorized account", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await unlRegistrar
        .connect(user)
        .transferFrom(userAddr, anotherUserAddr, subdomain1LabelHash);

      const subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(userAddr);

      await ens.connect(user).setResolver(subdomain1Hash, resolver.address);

      const resolverFromENS = await ens.resolver(subdomain1Hash);
      expect(resolverFromENS).to.be.equal(resolver.address);

      await unlRegistrar
        .connect(anotherUser)
        ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr);

      await expect(
        resolver
          .connect(user)
          ["setAddr(bytes32,address)"](subdomain1Hash, userAddr)
      );
    });

    it("reverts when trying to change the target address by an unauthorized account after set", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await unlRegistrar
        .connect(user)
        .transferFrom(userAddr, anotherUserAddr, subdomain1LabelHash);

      await unlRegistrar
        .connect(anotherUser)
        ["reclaim(uint256,address)"](subdomain1LabelHash, anotherUserAddr);

      const subdomainOwner = await ens.owner(subdomain1Hash);
      expect(subdomainOwner).to.be.equal(anotherUserAddr);

      await ens
        .connect(anotherUser)
        .setResolver(subdomain1Hash, resolver.address);

      const resolverFromENS = await ens.resolver(subdomain1Hash);
      expect(resolverFromENS).to.be.equal(resolver.address);

      await resolver
        .connect(anotherUser)
        ["setAddr(bytes32,address)"](subdomain1Hash, userAddr);

      const target = await resolver["addr(bytes32)"](subdomain1Hash);
      expect(target).to.be.equal(userAddr);

      await expect(
        resolver
          .connect(hacker)
          ["setAddr(bytes32,address)"](subdomain1Hash, anotherUserAddr)
      ).to.be.reverted;
    });

    it("reverts when trying to set the owner for subdomain by an unauthorized account [ @skip-on-coverage ]", async function () {
      await unlController.connect(user).register(subdomain1, userAddr);

      await expect(
        ens.connect(hacker).setOwner(subdomain1Hash, anotherUserAddr)
      ).to.be.reverted;
    });

    it("reverts when trying to set a subnode owner for a domain by an unauthorized account [ @skip-on-coverage ]", async function () {
      await expect(
        ens
          .connect(user)
          .setSubnodeOwner(unlDomainHash, subdomain2LabelHash, anotherUserAddr)
      ).to.be.reverted;
    });
  });
});
