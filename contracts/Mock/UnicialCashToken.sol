// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "./interfaces/IERC2612.sol";

contract UnicialCashToken is ERC20PresetMinterPauser, Ownable, IERC2612 {
    event MintFinished();

    bool public mintingFinished = false;

    bytes32 public immutable PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
    bytes32 public immutable TRANSFER_TYPEHASH =
        keccak256(
            "Transfer(address owner,address to,uint256 value,uint256 nonce,uint256 deadline)"
        );
    bytes32 public override DOMAIN_SEPARATOR;
    string public constant version = "1";
    string internal _tokenName = "Unicial Cash Token";
    string internal _tokenSymbol = "UCC";

    mapping(address => uint256) public override nonces;

    /**
     * Implementation adapted from
     * https://github.com/albertocuestacanada/ERC20Permit/blob/master/contracts/ERC20Permit.sol.
     */
    constructor(uint256 chainId_)
        ERC20PresetMinterPauser(_tokenName, _tokenSymbol)
    {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(_tokenName)),
                keccak256(bytes(version)),
                chainId_,
                address(this)
            )
        );
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual override {
        verifyPermit(PERMIT_TYPEHASH, owner, spender, value, deadline, v, r, s);
        _approve(owner, spender, value);
    }

    function transferWithPermit(
        address owner,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual override returns (bool) {
        verifyPermit(TRANSFER_TYPEHASH, owner, to, value, deadline, v, r, s);
        _transfer(owner, to, value);
        return true;
    }

    function verifyPermit(
        bytes32 typehash,
        address owner,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        require(block.timestamp <= deadline, "UnicalCashToken: Expired permit");

        bytes32 hashStruct = keccak256(
            abi.encode(typehash, owner, to, value, nonces[owner]++, deadline)
        );

        require(
            verifyEIP712(owner, hashStruct, v, r, s) ||
                verifyPersonalSign(owner, hashStruct, v, r, s),
            "UnicalCashToken: invalid signature"
        );
    }

    function verifyEIP712(
        address owner,
        bytes32 hashStruct,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashStruct)
        );
        address signer = ecrecover(hash, v, r, s);
        return (signer != address(0) && signer == owner);
    }

    function verifyPersonalSign(
        address owner,
        bytes32 hashStruct,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal pure returns (bool) {
        bytes32 hash = prefixed(hashStruct);
        address signer = ecrecover(hash, v, r, s);
        return (signer != address(0) && signer == owner);
    }

    /**
     * @dev Builds a prefixed hash to mimic the behavior of eth_sign.
     */
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function finishMinting() public onlyOwner returns (bool) {
        mintingFinished = true;
        emit MintFinished();
        return true;
    }

    function addMinter(address newMinter) external onlyOwner {
        require(
            owner() != newMinter,
            "UnicialCashToken: Owner is already has minter role."
        );
        _setupRole(MINTER_ROLE, newMinter);
    }

    function revokeMinter(address existingMinter) external onlyOwner {
        require(
            owner() != existingMinter,
            "UnicialCashToken: Do not revoke owner's minter role."
        );
        _revokeRole(MINTER_ROLE, existingMinter);
    }
}
