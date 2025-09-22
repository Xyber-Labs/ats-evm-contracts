// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libraries/ATSERC20DataTypes.sol";

interface IATSRouter {

    function MASTER_ROUTER() external view returns(address masterRouterAddress);

    function GAS_ESTIMATOR() external view returns(address gasEstimatorAddress);

    function protocolVersion() external view returns(bytes2 version);

    function getBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit,
        uint256 payloadLength,
        bytes calldata protocolPayload
    ) external view returns(uint256 bridgeFeeAmount);

    function getUpdateFee(
        uint256[] calldata dstChainIds, 
        uint256[] calldata configsLength
    ) external view returns(uint256 updateFeeAmount);

    function dstMinGasLimit(uint256 dstChainId) external view returns(uint64 dstMinGasLimitAmount);

    function dstUpdateGas(uint256 dstChainId) external view returns(uint64 dstUpdateGasAmount);

    function setDstMinGasLimit(uint256[] calldata dstChainIds, uint64[] calldata newDstMinGasLimits) external;

    function setDstUpdateGas(uint256[] calldata dstChainIds, uint64[] calldata newDstUpdateGas) external;

    function bridge(
        bytes calldata dstToken,
        bytes calldata sender,
        bytes calldata to,
        uint256 amount,
        uint8 srcDecimals,
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success);

    function requestToUpdateConfig(
        bytes calldata sender,
        uint256[] calldata dstChainIds,
        bytes[] calldata dstPeers,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable returns(bool success);

    function execute(
        uint256 srcChainId,
        address peerAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult);

    function pause() external;

    function unpause() external;

}