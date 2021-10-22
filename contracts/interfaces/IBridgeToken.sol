// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBridgeToken is IERC20 {
    function initialize(
        string calldata _name,
        string calldata _symbol,
        uint8 _decimals
    ) external;

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    function burn(address from, uint256 amount) external;

    function mint(address to, uint256 amount) external;

    function domainSeparator() external view returns (bytes32);
}