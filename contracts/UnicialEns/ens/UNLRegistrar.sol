pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IENSRegistry.sol";
import "../interfaces/IENSResolver.sol";
import "../interfaces/IBaseRegistrar.sol";
import "../interfaces/IERC20.sol";

contract UNLRegistrar is ERC721Enumerable, Ownable {
    using Address for address;
    bytes4 public constant ERC721_RECEIVED = 0x150b7a02;

    // The ENS registry
    IENSRegistry public registry;
    // The ENS base registrar
    IBaseRegistrar public base;

    // A map of addresses that are authorised to register and renew names.
    mapping(address => bool) public controllers;

    // Empty hash
    bytes32 public emptyNamehash = 0x00;
    // Top domain e.g: eth
    string public topdomain;
    // Domain e.g: dcl
    string public domain;
    // Top domain hash
    bytes32 public topdomainNameHash;
    // Domain hash
    bytes32 public domainNameHash;
    // Base URI
    string public baseURI;

    // A map of subdomain hashes to its string for reverse lookup
    mapping(bytes32 => string) public subdomains;

    // Emitted when a new name is registered
    event NameRegistered(
        address indexed _caller,
        address indexed _beneficiary,
        bytes32 indexed _labelHash,
        string _subdomain,
        uint256 _createdDate
    );
    // Emitted when a user reclaim a subdomain to the ENS Registry
    event Reclaimed(
        address indexed _caller,
        address indexed _owner,
        uint256 indexed _tokenId
    );
    // Emitted when the owner of the contract reclaim the domain to the ENS Registry
    event DomainReclaimed(uint256 indexed _tokenId);
    // Emitted when the domain was transferred
    event DomainTransferred(
        address indexed _newOwner,
        uint256 indexed _tokenId
    );

    // Emitted when the registry was updated
    event RegistryUpdated(
        IENSRegistry indexed _previousRegistry,
        IENSRegistry indexed _newRegistry
    );
    // Emitted when the base was updated
    event BaseUpdated(
        IBaseRegistrar indexed _previousBase,
        IBaseRegistrar indexed _newBase
    );

    // Emitted when a controller was added
    event ControllerAdded(address indexed _controller);
    // Emitted when a controller was removed
    event ControllerRemoved(address indexed _controller);

    // Emitted when base URI is was changed
    event BaseURI(string _oldBaseURI, string _newBaseURI);

    // Emit when the resolver is set to the owned domain
    event ResolverUpdated(
        address indexed _oldResolver,
        address indexed _newResolver
    );

    // Emit when a call is forwarred to the resolver
    event CallForwarwedToResolver(
        address indexed _resolver,
        bytes _data,
        bytes res
    );

    /**
     * @dev Check if the sender is an authorized controller
     */
    modifier onlyController() {
        require(
            controllers[msg.sender],
            "Only a controller can call this method"
        );
        _;
    }

    /**
     * @dev Constructor of the contract
     * @param _registry - address of the ENS registry contract
     * @param _base - address of the ENS base registrar contract
     * @param _topdomain - top domain (e.g. "eth")
     * @param _domain - domain (e.g. "dcl")
     * @param _baseURI - base URI for token URIs
     */
    constructor(
        IENSRegistry _registry,
        IBaseRegistrar _base,
        string memory _topdomain,
        string memory _domain,
        string memory _baseURI
    ) ERC721("UNL Registrar", "UNLZNS") {
        // ENS registry
        updateRegistry(_registry);
        // ENS base registrar
        updateBase(_base);

        // Top domain string
        require(bytes(_topdomain).length > 0, "Top domain can not be empty");
        topdomain = _topdomain;

        // Domain string
        require(bytes(_domain).length > 0, "Domain can not be empty");
        domain = _domain;

        // Generate namehash for the top domain
        topdomainNameHash = keccak256(
            abi.encodePacked(
                emptyNamehash,
                keccak256(abi.encodePacked(topdomain))
            )
        );
        // Generate namehash for the domain
        domainNameHash = keccak256(
            abi.encodePacked(
                topdomainNameHash,
                keccak256(abi.encodePacked(domain))
            )
        );

        // Set base URI
        updateBaseURI(_baseURI);
    }

    /**
     * @dev Allows to create a subdomain (e.g. "nacho.dcl.eth"), set its resolver, owner and target address
     * @param _subdomain - subdomain  (e.g. "nacho")
     * @param _beneficiary - address that will become owner of this new subdomain
     */
    function register(string calldata _subdomain, address _beneficiary)
        external
        onlyController
    {
        // Make sure this contract owns the domain
        _checkOwnerOfDomain();
        // Create labelhash for the subdomain
        bytes32 subdomainLabelHash = keccak256(
            abi.encodePacked(_toLowerCase(_subdomain))
        );
        // Make sure it is free
        require(_available(subdomainLabelHash), "Subdomain already owned");
        // solium-disable-next-line security/no-block-members
        _register(
            _subdomain,
            subdomainLabelHash,
            _beneficiary,
            block.timestamp
        );
    }

    /**
     * @dev Internal function to register a subdomain
     * @param _subdomain - subdomain  (e.g. "nacho")
     * @param subdomainLabelHash - hash of the subdomain
     * @param _beneficiary - address that will become owner of this new subdomain
     */
    function _register(
        string memory _subdomain,
        bytes32 subdomainLabelHash,
        address _beneficiary,
        uint256 _createdDate
    ) internal {
        // Create new subdomain and assign the _beneficiary as the owner
        registry.setSubnodeOwner(
            domainNameHash,
            subdomainLabelHash,
            _beneficiary
        );
        // Mint an ERC721 token with the sud domain label hash as its id
        _mint(_beneficiary, uint256(subdomainLabelHash));
        // Map the ERC721 token id with the subdomain for reversion.
        subdomains[subdomainLabelHash] = _subdomain;
        // Emit registered name event
        emit NameRegistered(
            msg.sender,
            _beneficiary,
            subdomainLabelHash,
            _subdomain,
            _createdDate
        );
    }

    /**
     * @dev Re-claim the ownership of a subdomain (e.g. "nacho").
     * @notice After a subdomain is transferred by this contract, the owner in the ENS registry contract
     * is still the old owner. Therefore, the owner should call `reclaim` to update the owner of the subdomain.
     * It is also useful to recreate the subdomains in case of an ENS migration.
     * @param _tokenId - erc721 token id which represents the node (subdomain).
     */
    function reclaim(uint256 _tokenId) public onlyController {
        address owner = ownerOf(_tokenId);

        registry.setSubnodeOwner(
            domainNameHash,
            bytes32(_tokenId),
            ownerOf(_tokenId)
        );

        emit Reclaimed(msg.sender, owner, _tokenId);
    }

    /**
     * @dev Re-claim the ownership of a subdomain (e.g. "nacho").
     * @notice After a subdomain is transferred by this contract, the owner in the ENS registry contract
     * is still the old owner. Therefore, the owner should call `reclaim` to update the owner of the subdomain.
     * It is also useful to recreate the subdomains in case of an ENS migration.
     * @param _tokenId - erc721 token id which represents the node (subdomain).
     * @param _owner - new owner.
     */
    function reclaim(uint256 _tokenId, address _owner) public {
        // Check if the sender is authorized to manage the subdomain
        require(
            _isApprovedOrOwner(msg.sender, _tokenId),
            "Only an authorized account can change the subdomain settings"
        );

        registry.setSubnodeOwner(domainNameHash, bytes32(_tokenId), _owner);

        emit Reclaimed(msg.sender, _owner, _tokenId);
    }

    /**
     * @dev The ERC721 smart contract calls this function on the recipient
     * after a `safetransfer`. This function MAY throw to revert and reject the
     * transfer. Return of other than the magic value MUST result in the
     * transaction being reverted.
     * Note: the contract address is always the message sender.
     * @notice Handle the receipt of an NFT. Used to re-claim ownership at the ENS registry contract
     * @param _tokenId The NFT identifier which is being transferred
     * @return `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
     */
    function onERC721Received(
        address, /* _operator */
        address, /* _from */
        uint256 _tokenId,
        bytes memory /* _data */
    ) public returns (bytes4) {
        require(
            msg.sender == address(base),
            "Only base can send NFTs to this contract"
        );

        // Re-claim to update the owner at the ENS Registry
        base.reclaim(_tokenId, address(this));
        return ERC721_RECEIVED;
    }

    /**
     * @dev Check whether a name is available to be registered or not
     * @param _subdomain - name to check
     * @return whether the name is available or not
     */
    function available(string memory _subdomain) public view returns (bool) {
        // Create labelhash for the subdomain
        bytes32 subdomainLabelHash = keccak256(
            abi.encodePacked(_toLowerCase(_subdomain))
        );
        return _available(subdomainLabelHash);
    }

    /**
     * @dev Check whether a name is available to be registered or not
     * @param _subdomainLabelHash - hash of the name to check
     * @return whether the name is available or not
     */
    function _available(bytes32 _subdomainLabelHash)
        internal
        view
        returns (bool)
    {
        // Create namehash for the subdomain (node)
        bytes32 subdomainNameHash = keccak256(
            abi.encodePacked(domainNameHash, _subdomainLabelHash)
        );
        // Make sure it is free
        return
            registry.owner(subdomainNameHash) == address(0) &&
            !_exists(uint256(_subdomainLabelHash));
    }

    /**
     * @dev Get the token id by its subdomain
     * @param _subdomain - string of the subdomain
     * @return token id mapped to the subdomain
     */
    function getTokenId(string memory _subdomain)
        public
        view
        returns (uint256)
    {
        string memory subdomain = _toLowerCase(_subdomain);
        bytes32 subdomainLabelHash = keccak256(abi.encodePacked(subdomain));
        uint256 tokenId = uint256(subdomainLabelHash);

        require(_exists(tokenId), "The subdomain is not registered");

        return tokenId;
    }

    /**
     * @dev Get the owner of a subdomain
     * @param _subdomain - string of the subdomain
     * @return owner of the subdomain
     */
    function getOwnerOf(string memory _subdomain)
        public
        view
        returns (address)
    {
        return ownerOf(getTokenId(_subdomain));
    }

    /**
     * @dev Returns an URI for a given token ID.
     * @notice that throws if the token ID does not exist. May return an empty string.
     * Also, if baseURI is empty, an empty string will be returned.
     * @param _tokenId - uint256 ID of the token queried
     * @return token URI
     */
    function tokenURI(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        if (bytes(baseURI).length == 0) {
            return "";
        }

        require(
            _exists(_tokenId),
            "ERC721Metadata: received a URI query for a nonexistent token"
        );
        return
            string(
                abi.encodePacked(
                    baseURI,
                    _toLowerCase(subdomains[bytes32(_tokenId)])
                )
            );
    }

    /**
     * @dev Re-claim the ownership of the domain (e.g. "dcl")
     * @notice After a domain is transferred by the ENS base
     * registrar to this contract, the owner in the ENS registry contract
     * is still the old owner. Therefore, the owner should call `reclaimDomain`
     * to update the owner of the domain
     * @param _tokenId - erc721 token id which represents the node (domain)
     */
    function reclaimDomain(uint256 _tokenId) public onlyOwner {
        base.reclaim(_tokenId, address(this));

        emit DomainReclaimed(_tokenId);
    }

    /**
     * @dev The contract owner can take away the ownership of any domain owned by this contract
     * @param _owner - new owner for the domain
     * @param _tokenId - erc721 token id which represents the node (domain)
     */
    function transferDomainOwnership(address _owner, uint256 _tokenId)
        public
        onlyOwner
    {
        base.transferFrom(address(this), _owner, _tokenId);
        emit DomainTransferred(_owner, _tokenId);
    }

    /**
     * @dev Update owned domain resolver
     * @param _resolver - new resolver
     */
    function setResolver(address _resolver) public onlyOwner {
        address resolver = registry.resolver(domainNameHash);

        require(_resolver.isContract(), "New resolver should be a contract");
        require(
            _resolver != resolver,
            "New resolver should be different from old"
        );

        _checkNotAllowedAddresses(_resolver);

        registry.setResolver(domainNameHash, _resolver);

        emit ResolverUpdated(resolver, _resolver);
    }

    /**
     * @dev Forward calls to resolver
     * @param _data - data to be send in the call
     */
    function forwardToResolver(bytes memory _data) public onlyOwner {
        address resolver = registry.resolver(domainNameHash);

        _checkNotAllowedAddresses(resolver);

        (bool success, bytes memory res) = resolver.call(_data);

        require(success, "Call failed");

        // Make sure this contract is still the owner of the domain
        _checkOwnerOfDomain();

        emit CallForwarwedToResolver(resolver, _data, res);
    }

    /**
     * @dev Authorises a controller, who can register subdomains
     * @param controller - address of the controller
     */
    function addController(address controller) external onlyOwner {
        require(!controllers[controller], "The controller was already added");
        controllers[controller] = true;
        emit ControllerAdded(controller);
    }

    /**
     * @dev Revoke controller permission for an address
     * @param controller - address of the controller
     */
    function removeController(address controller) external onlyOwner {
        require(controllers[controller], "The controller is already disabled");
        controllers[controller] = false;
        emit ControllerRemoved(controller);
    }

    /**
     * @dev Update to new ENS registry
     * @param _registry The address of new ENS registry to use
     */
    function updateRegistry(IENSRegistry _registry) public onlyOwner {
        require(
            registry != _registry,
            "New registry should be different from old"
        );
        require(
            address(_registry).isContract(),
            "New registry should be a contract"
        );

        emit RegistryUpdated(registry, _registry);

        registry = _registry;
    }

    /**
     * @dev Update to new ENS base registrar
     * @param _base The address of new ENS base registrar to use
     */
    function updateBase(IBaseRegistrar _base) public onlyOwner {
        require(base != _base, "New base should be different from old");
        require(address(_base).isContract(), "New base should be a contract");

        emit BaseUpdated(base, _base);

        base = _base;
    }

    /**
     * @dev Set Base URI.
     * @param _baseURI - base URI for token URIs
     */
    function updateBaseURI(string memory _baseURI) public onlyOwner {
        require(
            keccak256(abi.encodePacked((baseURI))) !=
                keccak256(abi.encodePacked((_baseURI))),
            "Base URI should be different from old"
        );
        emit BaseURI(baseURI, _baseURI);
        baseURI = _baseURI;
    }

    function _checkOwnerOfDomain() internal view {
        require(
            registry.owner(domainNameHash) == address(this) &&
                base.ownerOf(uint256(keccak256(abi.encodePacked(domain)))) ==
                address(this),
            "The contract does not own the domain"
        );
    }

    function _checkNotAllowedAddresses(address _address) internal view {
        require(
            _address != address(base) &&
                _address != address(registry) &&
                _address != address(this),
            "Invalid address"
        );
    }

    /**
     * @dev Convert bytes32 to string.
     * @param _x - to be converted to string.
     * @return string
     */
    function _bytes32ToString(bytes32 _x)
        internal
        pure
        returns (string memory)
    {
        uint256 charCount = 0;
        for (uint256 j = 0; j <= 256; j += 8) {
            bytes1 char = bytes1(_x << j);
            if (char == 0) {
                break;
            }
            charCount++;
        }

        string memory out = new string(charCount);

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            mstore(add(0x20, out), _x)
        }

        return out;
    }

    /**
     * @dev Lowercase a string.
     * @param _str - to be converted to string.
     * @return string
     */
    function _toLowerCase(string memory _str)
        internal
        pure
        returns (string memory)
    {
        bytes memory bStr = bytes(_str);
        bytes memory bLower = new bytes(bStr.length);

        for (uint256 i = 0; i < bStr.length; i++) {
            // Uppercase character...
            if ((bStr[i] >= 0x41) && (bStr[i] <= 0x5A)) {
                // So we add 0x20 to make it lowercase
                bLower[i] = bytes1(uint8(bStr[i]) + 0x20);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }
}
