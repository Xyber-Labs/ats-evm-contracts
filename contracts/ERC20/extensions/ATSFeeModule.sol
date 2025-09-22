// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IATSFeeModule.sol";

/**
 * @notice Extension of {ATSBase} that adds basic functionality to integrate fees collecting for {bridge} and 
 * {bridgeWithSlippageCheck} functions.
 *
 * @dev
 * The {_authorizeCall} function MUST be overridden to include access restriction to the {setFeeCollector} and 
 * {setBridgeFeeRate} functions.
 * The {bridgeWithSlippageCheck} function MUST be implemented to include a check that the value {bridgeFeeRate} has 
 * not been updated before executing the {bridgeWithSlippageCheck} function.
 */
abstract contract ATSFeeModule is IATSFeeModule {

    /// @notice Basis points divisor for percentage calculations (100.00%).
    uint16 internal constant BPS = 10000;

    /// @notice Address that collects fees for bridges.
    address public feeCollector;
 
    /**
     * @notice Bridge fee rate (basis points) for the corresponding destination chain Id.
     * @dev MAX value for {bridgeFeeRate} is 9999 basis points (99.99%).
     */
    mapping(uint256 dstChainId => uint16 bridgeFeeRate) public bridgeFeeRate;
     
    /// @notice Indicates an error that a {newBridgeFeeRate} exceeds 9999 basis points (99.99%).
    error ATSFeeModule__E0();

    /// @notice Indicates an error that the {bridgeFeeRate} has been updated before executing the {bridgeWithSlippageCheck} function.
    error ATSFeeModule__E1();

    /// @notice Indicates an error that lengths of {dstChainIds} and {newBridgeFeeRates} do not match in the {setBridgeFeeRate} function.
    error ATSFeeModule__E2();

    /**
     * @notice Emitted when the {feeCollector} address is updated.
     * @param caller the caller address who set the new {feeCollector} address.
     * @param newFeeCollector the new {feeCollector} address.
     */
    event FeeCollectorSet(address indexed caller, address newFeeCollector);

    /**
     * @notice Emitted when a {bridgeFeeRate} is updated for corresponding {dstChainId}.
     * @param caller the caller address who updated the {bridgeFeeRate}.
     * @param dstChainId destination chain Id.
     * @param newBridgeFeeRate the new {bridgeFeeRate} for corresponding {dstChainId}.
     */
    event BridgeFeeRateSet(address indexed caller, uint256 indexed dstChainId, uint16 newBridgeFeeRate);

    /**
     * @notice Sets the fee collector address to which collected fees will be received.
     * @param newFeeCollector new {feeCollector} address.
     */
    function setFeeCollector(address newFeeCollector) external {
        _authorizeCall();
        feeCollector = newFeeCollector;

        emit FeeCollectorSet(msg.sender, newFeeCollector);
    }

    /**
     * @notice Sets the bridge fee rates for provided destination chain Ids.
     * @param dstChainIds destination chain Ids.
     * @param newBridgeFeeRates array of new {bridgeFeeRate} for corresponding {dstChainIds}.
     */
    function setBridgeFeeRate(uint256[] calldata dstChainIds, uint16[] calldata newBridgeFeeRates) external {
        _authorizeCall();
        if (dstChainIds.length != newBridgeFeeRates.length) revert ATSFeeModule__E2();

        for (uint256 i; dstChainIds.length > i; ++i) {
            if (newBridgeFeeRates[i] >= BPS) revert ATSFeeModule__E0();
            bridgeFeeRate[dstChainIds[i]] = newBridgeFeeRates[i];

            emit BridgeFeeRateSet(msg.sender, dstChainIds[i], newBridgeFeeRates[i]);
        }
    }

    function _authorizeCall() internal virtual;

}