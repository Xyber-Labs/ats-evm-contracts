// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISingletonRouter {

    function MASTER_ROUTER() external view returns(address);

    function GAS_ESTIMATOR() external view returns(address);

    function SINGLETON_FACTORY() external view returns(address);

    function getBridgeFees(
        uint256[] calldata dstChainIds, 
        bytes calldata protocolPayload
    ) external view returns(uint256[] memory bridgeFeeAmounts, uint256 totalBridgeFeeAmount);

    function getDeployFees(
        uint256[] calldata dstChainIds, 
        bytes calldata protocolPayload
    ) external view returns(uint256[] memory deployFeeAmounts, uint256 totalDeployFeeAmount);

    function getDeployAndBridgeFees(
        uint256[] calldata dstChainIds, 
        bytes calldata protocolPayload
    ) external view returns(uint256[] memory deployAndBridgeFeeAmounts, uint256 totalDeployAndBridgeFeeAmounts);

    function isExecutionFailed(
        bytes32 underlyingTokenId, 
        address receiver, 
        uint256 amount,
        uint256 retryNonce
    ) external view returns(bool isFailed);

    function generateTokenId(address tokenAddress) external view returns(bytes32 underlyingTokenId);

    function router() external view returns(address routerAddress);

    function tokenId(address tokenAddress) external view returns(bytes32 tokenIdByAddress);

    function token(bytes32 underlyingTokenId) external view returns(address tokenAddressById);

    function dstSingletonRouter(uint256 dstChainId) external view returns(bytes memory dstSingletonRouterAddress);

    function dstRedeemGas(uint256 dstChainId) external view returns(uint64 dstRedeemGasAmount);

    function dstDeployGas(uint256 dstChainId) external view returns(uint64 dstDeployGasAmount);

    struct BridgeRequest {
        uint256 dstChainId;
        uint256 amount;
        bytes receiver;
    }

    function bridge(
        address tokenAddress, 
        bytes calldata protocolPayload, 
        BridgeRequest[] calldata requests
    ) external payable returns(uint256 bridgedAmount, uint256 paymentAmount);

    function deployAndBridge(
        address tokenAddress, 
        bytes calldata protocolPayload, 
        BridgeRequest[] calldata requests
    ) external payable returns(uint256 bridgedAmount, uint256 paymentAmount);

    function retryRedeem(
        bytes32 underlyingTokenId, 
        address receiver, 
        uint256 amount, 
        uint256 nonce
    ) external returns(bool success);

    function execute(
        uint256 srcChainId,
        address singletonRouterAddress, 
        bytes1 messageType,
        bytes calldata localParams
    ) external payable returns(uint8 opResult);

    function addExistingToken(address tokenAddress) external returns(bytes32 underlyingTokenId);

    function setDstSingletonRouter(uint256[] calldata dstChainIds, bytes[] calldata newDstSingletonRouter) external;

    function setDstRedeemGas(uint256[] calldata dstChainIds, uint64[] calldata newDstRedeemGas) external;

    function setDstDeployGas(uint256[] calldata dstChainIds, uint64[] calldata newDstDeployGas) external;

    function pause() external;

    function unpause() external;

}