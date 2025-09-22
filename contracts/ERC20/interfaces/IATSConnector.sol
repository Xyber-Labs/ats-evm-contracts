// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IATSBase.sol";

interface IATSConnector is IATSBase {

    function underlyingDecimals() external view returns(uint8);

    function underlyingBalance() external view returns(uint256);

    function underlyingName() external view returns(string memory);

    function underlyingSymbol() external view returns(string memory);

    function initializeConnector(
        address owner,
        address underlyingToken,
        address router,
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs
    ) external;

}