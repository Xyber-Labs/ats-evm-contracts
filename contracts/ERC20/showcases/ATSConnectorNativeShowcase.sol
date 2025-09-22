// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../ATSBase.sol";

/**
 * @notice A showcase contract that provides functionality to use ATS protocol crosschain messaging for bridging
 * native currency.
 * 
 * @dev An {ATSConnectorNativeShowcase} contract stores and releases native currency and interacts with the ATS protocol.
 * A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * Since native currency cannot be minted or burned in general, only a lock/unlock mechanism is used here.
 *
 * IMPORTANT: This is an example contract, that uses an unaudited code. Do not use this code in production before covering by tests.
 */
contract ATSConnectorNativeShowcase is ATSBase, Ownable {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for address;

    /// @notice The gas limit for native currency transfer by low level {call} function in the {_mintTo} function.
    uint256 public immutable NATIVE_TRANSFER_GAS_LIMIT;

    /**
     * @notice Indicates an error that the provided {amount} exceeds transaction's {msg.value}.
     * @dev Since part of the {msg.value} will be sent to {_router} as payment for the bridging execution, 
     * {msg.value} should be equal to {amount} + estimated bridge fee.
     */
    error ATSConnectorNativeShowcase__E0();

    /// @notice Indicates an error that the provided {amount} exceeds native currency {address(this).balance}.
    error ATSConnectorNativeShowcase__E1();

    /// @notice Indicates an error that native currency transfer to {to} address is failed.
    error ATSConnectorNativeShowcase__E2(bytes);

    /**
     * @notice Initializes basic settings.
     * @param _router address of the authorized {ATSRouter} contract.
     * @param _allowedChainIds chains Ids available for bridging in both directions.
     * @param _chainConfigs {ChainConfig} settings for provided {_allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     * @param _nativeCurrencyDecimals decimals of the current chain native currency.
     * @param _nativeTransferGasLimit the gas limit for native currency transfer by low level {call} function in 
     * the {_mintTo} function.
     *
     * @dev Provide an {0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE} address to the {ATSBase.__ATSBase_init} function, 
     * as an identifier that the underlying token is a native currency.
     */
    constructor(
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs,
        uint8 _nativeCurrencyDecimals,
        uint256 _nativeTransferGasLimit
    ) Ownable(msg.sender) {
        __ATSBase_init(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, _nativeCurrencyDecimals);

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);

        NATIVE_TRANSFER_GAS_LIMIT = _nativeTransferGasLimit;
    }

    /**
     * @notice Provides the ability to send native currency to the current contract to replenish liquidity for bridging.
     */
    receive() external payable {

    }

    /**
     * @notice Returns decimals value of the native currency.
     * @return Decimals of the current chain native currency.
     */
    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    /**
     * @notice Returns the balance of the native currency held by this contract.
     * @return Native currency balance held by the {ATSConnectorNativeShowcase} contract.
     */
    function underlyingBalance() external view returns(uint256) {
        return address(this).balance;
    }

    /**
     * @notice Overridden function that send bridging request to the {_router}.
     * @param payment current transaction's {msg.value}, that can be used as payment for bridging execution.
     * @param dstToken the address of the {ATSToken} or {ATSConnector} on the destination chain.
     * @param to bridged native currency receiver on the destination chain.
     * @param amount native currency amount to bridge to the destination chain.
     * @param srcDecimals decimals of the current chain native currency.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayload user's additional data.
     * @param protocolPayload ATS protocol's additional data.
     * @return success call result.
     *
     * @dev By default, {payment} is equal to current transaction's {msg.value} as payment, but in this case, only 
     * part of the {msg.value} must be sent to the {_router}. Function is overriden to send to the {_router} only the 
     * difference between {payment} {msg.value} and {amount}, since {amount} is the amount of native currency that 
     * will be bridged to the destination chain and should remain on the {ATSConnectorNativeShowcase} contract 
     * balance as locked liquidity.
     */
    function _sendRequest(
        uint256 payment,
        bytes memory dstToken,
        bytes memory to,
        uint256 amount,
        uint8 srcDecimals,
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes memory customPayload,
        bytes memory protocolPayload
    ) internal override returns(bool success) {
        return IATSRouter(router()).bridge{value: payment - amount}( 
            dstToken,
            msg.sender.toBytes(),
            to,
            amount,
            srcDecimals,
            dstChainId,
            dstGasLimit,
            customPayload,
            protocolPayload
        );
    }

    /**
     * @notice Overridden function that just checks {msg.value} is greater than the {amount}.
     * @param amount native currency amount to bridge to the destination chain.
     * @return bridgedNativeAmount bridged native currency amount, that will be released on the destination chain.
     * @dev {bridgedNativeAmount} value may be different from {amount}, in case amount modifies by fee collecting 
     * or any other custom logic. Returned {bridgedNativeAmount} value will be actually used for crosschain message.
     */
    function _burnFrom(
        address /* spender */,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override returns(uint256 bridgedNativeAmount) {
        if (amount >= msg.value) revert ATSConnectorNativeShowcase__E0();

        return amount;
    }

    /**
     * @notice Overridden function that transfer native currency {amount} from this contract to receiver {to} address.
     * @param to native currency receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @return receivedNativeAmount amount that {to} address received.
     * @dev {receivedNativeAmount} value may be different from {amount}, in case amount modifies by fee collecting or 
     * any other custom logic.
     *
     * @dev Some checks are added to ensure that the {to} address has received the native currency {amount}:
     *     1. {address(this).balance} is greater than the {amount} to transfer
     *     2. native currency transfer by low level {call} function is successful
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256 receivedNativeAmount) {
        if (amount > address(this).balance) revert ATSConnectorNativeShowcase__E1();

        (bool _success, bytes memory _response) = to.call{value: amount, gas: NATIVE_TRANSFER_GAS_LIMIT}("");

        if (!_success) revert ATSConnectorNativeShowcase__E2(_response);

        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal override onlyOwner() {

    }

}