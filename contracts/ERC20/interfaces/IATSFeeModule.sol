// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IATSFeeModule {

    function feeCollector() external view returns(address);

    function bridgeFeeRate(uint256 dstChainId) external view returns(uint16);

    function bridgeWithSlippageCheck(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 dstGasLimit,
        uint16 expectedFeeRate,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success, uint256 afterFeeBridgedAmount);

    function setFeeCollector(address newFeeCollector) external;

    function setBridgeFeeRate(uint256[] calldata dstChainIds, uint16[] calldata newBridgeFeeRates) external;

}