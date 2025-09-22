// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libraries/ATSERC20DataTypes.sol";

interface IATSFactory {

    function MASTER_ROUTER() external view returns(address masterRouterAddress);

    function REGISTRY() external view returns(address registryAddress);

    function router() external view returns(address deploymentRouterAddress);

    function codeStorage(uint8 blueprintId) external view returns(address codeStorageAddress);

    function protocolVersion() external view returns(bytes2 version);

    function getPrecomputedAddress(
        uint8 blueprintId,
        bytes calldata deployer, 
        bytes32 salt, 
        bool isConnector
    ) external view returns(address deployment, bool hasCode);

    function deployToken(DeployTokenData calldata deployData) external returns(bool success, address newToken);

    function deployConnector(DeployConnectorData calldata deployData) external returns(bool success, address newConnector);

    function deployByRouter(
        bool isConnector, 
        bytes calldata deployer, 
        bytes calldata deployParams
    ) external returns(bool success, address newDeployment);

    function pause() external;

    function unpause() external;

    function setRouter(address newRouter) external;

    function setCodeStorage(uint8[] calldata blueprintIds, address[] calldata newCodeStorage) external;
    
}