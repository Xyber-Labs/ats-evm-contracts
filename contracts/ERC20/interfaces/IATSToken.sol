// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IATSBase.sol";

interface IATSToken is IATSBase, IERC20 {

    function globalBurnable() external view returns(bool);
    
    function onlyRoleBurnable() external view returns(bool);

    function initializeToken(DeployTokenData calldata params) external;

}