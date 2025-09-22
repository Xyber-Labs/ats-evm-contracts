// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IATSUpgradeChecker {

    function SYSTEM_CONTRACT_TYPE() external view returns(bytes1);

}