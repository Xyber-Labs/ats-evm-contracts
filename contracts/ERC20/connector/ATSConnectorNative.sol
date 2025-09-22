// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "../extensions/ATSBaseIndexed.sol";

import "../interfaces/IATSConnector.sol";

/**
 * @notice A contract that provides functionality to use ATS protocol crosschain messaging for bridging
 * native currency.
 * 
 * @dev An {ATSConnectorNative} contract stores and releases native currency and interacts with the ATS protocol.
 * A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * Since native currency cannot be minted or burned in general, only a lock/unlock mechanism is used here.
 */
contract ATSConnectorNative is IATSConnector, ATSBaseIndexed, AccessControl {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for address;

    /**
     * @notice Indicates an error that the provided {amount} exceeds transaction's {msg.value}.
     * @dev Since part of the {msg.value} will be sent to {_router} as payment for the bridging execution, 
     * {msg.value} should be equal to {amount} + estimated bridge fee.
     */
    error ATSConnectorNative__E0();

    /// @notice Indicates an error that the provided {amount} exceeds native currency {address(this).balance}.
    error ATSConnectorNative__E1();

    /// @notice Indicates an error that native currency transfer to {to} address is failed.
    error ATSConnectorNative__E2(bytes);

    /// @notice Indicates an error that the provided {from} address is not equal {spender(msg.sender)} address.
    error ATSConnectorNative__E3();

    /**
     * @notice Initializes basic settings with provided parameters.
     * @param _owner the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}.
     * @param underlyingToken_ placeholder address, see the {ATSFactory.NATIVE_ADDRESS()} for details.
     * @param _router the address of the authorized {ATSRouter}.
     * @param _allowedChainIds chains Ids available for bridging in both directions.
     * @param _chainConfigs array of {ChainConfig} settings for provided {_allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     * @dev Can and MUST be called only once. Reinitialization is prevented by {ATSBase.__ATSBase_init} function.
     */
    function initializeConnector(
        address _owner,
        address underlyingToken_,
        address _router,  
        uint256[] calldata _allowedChainIds,
        ChainConfig[] calldata _chainConfigs
    ) external {
        __ATSBase_init(underlyingToken_, 18);

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    /**
     * @notice Provides the ability to send native currency to the current contract to replenish liquidity for bridging.
     */
    receive() external payable {

    }

    /**
     * @notice Returns decimals value of the native currency.
     * @return decimals decimals of the current chain native currency.
     */
    function underlyingDecimals() external view returns(uint8 decimals) {
        return _decimals;
    }

    /**
     * @notice Returns the name of the underlying native token.
     * @return name name of the {_underlyingToken}.
     * @dev Must be hardcoded for a specific chain.
     */
    function underlyingName() external pure returns(string memory name) {
        return "Ether";
    }

    /**
     * @notice Returns the symbol of the underlying native token.
     * @return symbol symbol of the {_underlyingToken}.
     * @dev Must be hardcoded for a specific chain.
     */
    function underlyingSymbol() external pure returns(string memory symbol) {
        return "ETH";
    }

    /**
     * @notice Returns the balance of the native currency held by this contract.
     * @return nativeBalance native currency balance held by the {ATSConnectorNative} contract.
     */
    function underlyingBalance() external view returns(uint256 nativeBalance) {
        return address(this).balance;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ATSBase, AccessControl) returns(bool) {
        return interfaceId == type(IATSConnector).interfaceId || super.supportsInterface(interfaceId);
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
     * will be bridged to the destination chain and should remain on the {ATSConnectorNative} contract balance
     * as locked liquidity.
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
     * @notice Overridden function that checks {msg.value} is greater than or equal to the {amount}.
     * @param spender transaction sender, must be {msg.sender}.
     * @param from tokens holder on the current chain (must be msg.sender in that case).
     * @param amount native currency amount to bridge to the destination chain.
     * @return bridgedNativeAmount bridged native currency amount, that will be released on the destination chain.
     */
    function _burnFrom(
        address spender,
        address from, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override returns(uint256 bridgedNativeAmount) {
        if (amount > msg.value) revert ATSConnectorNative__E0();
        if (spender != from) revert ATSConnectorNative__E3();

        return amount;
    }

    /**
     * @notice Overridden function that transfer native currency {amount} from this contract to receiver {to} address.
     * @param to native currency receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @return receivedNativeAmount amount that {to} address received.
     *
     * @dev Some checks are added to ensure that the {to} address has received the native currency {amount}:
     *     1. {address(this).balance} is greater than or equal to the {amount} to transfer
     *     2. native currency transfer by low level {call} function is successful
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256 receivedNativeAmount) {
        if (to != address(this)) {
            if (amount > address(this).balance) revert ATSConnectorNative__E1();

            (bool _callResult, bytes memory _callResponse) = to.call{value: amount}("");
            if (!_callResult) revert ATSConnectorNative__E2(_callResponse);
        }

        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

}