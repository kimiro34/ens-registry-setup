// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IERC20 {
    function balanceOf(address from) external view returns (uint256);

    function transferFrom(
        address from,
        address to,
        uint256 tokens
    ) external returns (bool);

    function transfer(address to, uint256 tokens) external returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function burn(uint256 amount) external;
}
