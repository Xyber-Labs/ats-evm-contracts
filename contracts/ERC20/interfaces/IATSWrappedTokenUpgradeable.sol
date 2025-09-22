// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IATSWrappedTokenUpgradeable is IERC20 {

    function mint(address receiver, uint256 amount) external;

    function deposit(address receiver) external payable returns(bool success);

    function withdraw(address receiver, uint256 amount) external returns(bool success);

    function underlyingToken() external view returns(address underlyingTokenAddress);

    function underlyingBalance() external view returns(uint256 nativeBalance);

}