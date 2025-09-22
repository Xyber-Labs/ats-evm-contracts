// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IATSCodeStorage {

    function getCode(bool isConnector) external pure returns(bytes memory bytecode);

}