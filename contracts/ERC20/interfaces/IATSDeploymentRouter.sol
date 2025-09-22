// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libraries/ATSERC20DataTypes.sol";

interface IATSDeploymentRouter {

    function MASTER_ROUTER() external view returns(address masterRouterAddress);

    function GAS_ESTIMATOR() external view returns(address gasEstimatorAddress);

    function FACTORY() external view returns(address factoryAddress);

    function REGISTRY() external view returns(address registryAddress);

    function protocolVersion() external view returns(bytes2 version);

    function dstDeployConfig(uint256 dstChainId) external view returns(DstDeployConfig memory deployConfig);

    function dstTokenDeployGas(uint256 dstChainId) external view returns(uint64 dstTokenDeployGasAmount);

    function dstConnectorDeployGas(uint256 dstChainId) external view returns(uint64 dstConnectorDeployGasAmount);

    function dstProtocolFee(uint256 dstChainId) external view returns(uint16 dstProtocolFeePoints);

    function dstFactory(uint256 dstChainId) external view returns(bytes memory dstFactoryAddress);

    function estimateDeployTotal(
        uint256[] calldata dstTokenChainIds, 
        uint256[] calldata dstConnectorChainIds
    ) external view returns(uint256 paymentTokenAmount, uint256 paymentNativeAmount);

    function estimateDeployNative(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(
        uint256[] memory tokenPaymentAmountNative, 
        uint256[] memory connectorPaymentAmountNative, 
        uint256 totalPaymentAmountNative
    );

    function sendDeployRequest(
        DeployMetadata[] calldata deployMetadata,
        address paymentToken
    ) external payable returns(uint256 paymentAmount, address currentChainDeployment);

    function getDeployTokenParams(DeployTokenData calldata deployData) external pure returns(bytes memory);

    function getDeployConnectorParams(DeployConnectorData calldata deployData) external pure returns(bytes memory);

    function setDstDeployConfig(uint256[] calldata dstChainIds, DstDeployConfig[] calldata newConfigs) external;

    function setDstDeployGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newTokenDeployGas, 
        uint64[] calldata newConnectorDeployGas
    ) external;

    function setDstProtocolFee(uint256[] calldata dstChainIds, uint16[] calldata newProtocolFees) external;

    function setDstFactory(uint256[] calldata dstChainIds, bytes[] calldata newFactory) external;

    function execute(
        uint256 srcChainId,
        address factoryAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult);

    function pause() external;

    function unpause() external;

}