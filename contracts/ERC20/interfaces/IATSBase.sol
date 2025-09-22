// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libraries/ATSERC20DataTypes.sol";

interface IATSBase {

    function protocolVersion() external view returns(bytes2 version);

    function underlyingToken() external view returns(address underlyingTokenAddress);

    function router() external view returns(address routerAddress);

    function getChainConfigs(uint256[] calldata chainIds) external view returns(ChainConfig[] memory configs);

    function isExecutionFailed(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        uint256 nonce
    ) external view returns(bool isFailed);

    function estimateBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit, 
        uint16 customPayloadLength,
        bytes calldata protocolPayload
    ) external view returns(uint256 paymentAmount, uint64 dstMinGasLimit);

    function setRouter(address newRouter) external returns(bool success);

    function setChainConfig(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs
    ) external returns(bool success);

    function bridge(
        address from,
        bytes calldata to,
        uint256 amount,
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success, uint256 bridgedAmount);

    function redeem(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin
    ) external payable returns(bool success);

    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        bytes calldata result
    ) external;

    function retryRedeem(
        address to, 
        uint256 amount, 
        bytes calldata customPayload, 
        Origin calldata origin,
        uint256 nonce
    ) external returns(bool success);

}