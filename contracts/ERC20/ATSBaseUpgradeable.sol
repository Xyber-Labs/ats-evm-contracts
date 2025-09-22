// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

import "../libraries/BytesLib.sol";
import "../libraries/AddressConverter.sol";
import "../libraries/DecimalsConverter.sol"; 
import "../libraries/ATSERC20DataTypes.sol";

import "./interfaces/IATSBase.sol";
import "./interfaces/IATSRouter.sol";

/**
 * @notice Abstract contract implementing minimal and basic functionality for sending and receiving crosschain bridges 
 * of ERC20 tokens via ATS protocol. Can be used as an implementation in a various of upgradeable contracts patterns.
 *
 * @dev 
 * The {__ATSBase_init} function MUST be called before using other functions of the {ATSBase} contract.
 * The {_authorizeCall} function MUST be overridden to include access restriction to the {setRouter} and 
 * {setChainConfig} functions.
 * The {_mintTo} function MUST be overridden to implement {mint}/{transfer} underlying tokens to receiver {to} address 
 * by {_router}.
 * The {_burnFrom} function MUST be overridden to implement {burn}/{transferFrom} underlying tokens from {spender}/{from}
 * address for bridging.
 */
abstract contract ATSBaseUpgradeable is IATSBase, ERC165Upgradeable {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for address;

    /// @dev Library for converting various token amounts that have different {ERC20.decimals} values.
    using DecimalsConverter for uint256;
    
    /// @dev Library for performing various operations on the {bytes} type. 
    using BytesLib for bytes;

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSBaseUpgradeable
    struct ATSBaseUpgradeableStorage {
        /// @notice {ChainConfig} settings for the corresponding destination chain Id.
        /// @dev See the {ATSERC20DataTypes.ChainConfig} for details.
        mapping(uint256 chainId => ChainConfig dstChainConfig) _chainConfig;

        /**
        * @notice Receiver address for the corresponding {redeem} message hash.
        * @dev Mapping is filled only by {storeFailedExecution} function if the {redeem} call is unsuccessful.
        * IMPORTANT: Execution of the {_redeem} function with a {to} zero address MUST be forbidden.
        */
        mapping(bytes32 msgHash => address receiverAddress) _failedExecution;

        /// @notice Nonce used for {storeFailedExecution} executions to guarantee uniqueness.
        uint256 _retryNonce;

        /**
        * @notice Address that can execute {redeem} and {storeFailedExecution} functions.
        * @dev Should be an authorized {ATSRouter} contract address or a zero address in case of disconnection 
        * from ATS protocol.
        */
        address _router;

        /// @notice Address of the underlying ERC20 token.
        address _underlyingToken;

        /// @notice Decimals of the underlying ERC20 token.
        uint8 _decimals;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSBaseUpgradeable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ATSBASE_STORAGE_LOCATION = 0x273aab6b060581ec1968437d28c58d877f5c0add80fc4657dc0283023fbbc300;

    /// @notice Indicates an error that the {ATSBase} contract initialized already.
    error ATSBase__E0();

    /// @notice Indicates an error that the function caller is not the {_router}.
    error ATSBase__E1();

    /// @notice Indicates an error that the {to} is zero address.
    error ATSBase__E2();

    /// @notice Indicates an error that the {amount} to bridge is zero.
    error ATSBase__E3();

    /// @notice Indicates an error that lengths of {allowedChainIds} and {chainConfigs} do not match in the {_setChainConfig} function.
    error ATSBase__E4();

    /// @notice Indicates an error that the destination {peerAddress} is paused for sending and receiving crosschain messages.
    error ATSBase__E5();

    /// @notice Indicates an error that the provided {dstGasLimit} is less than the minimum required amount.
    error ATSBase__E6();

    /// @notice Indicates an error that the source {Origin.peerAddress} is unauthorized in the {ChainConfig} for corresponding {Origin.chainId}.
    error ATSBase__E7();

    /**
     * @notice Emitted when the {_router} address is updated.
     * @param caller the caller address who set the new {_router} address.
     * @param newRouter the address of the new {_router}.
     */
    event RouterSet(address indexed caller, address newRouter);

    /**
     * @notice Emitted when {ChainConfig} settings are updated.
     * @param caller the caller address who set the new destination {ChainConfig} settings.
     * @param allowedChainIds new chains Ids available for bridging in both directions.
     * @param chainConfigs array of new {ChainConfig} settings for corresponding {allowedChainIds}.
     */
    event ChainConfigUpdated(address indexed caller, uint256[] allowedChainIds, ChainConfig[] chainConfigs);

    /**
     * @notice Emitted when tokens are successfully redeemed from the source chain.
     * @param to tokens receiver on the current chain.
     * @param amount received amount.
     * @param srcPeerAddressIndexed indexed source {peerAddress}.
     * @param srcPeerAddress source {peerAddress}.
     * @param srcChainId source chain Id.
     * @param sender source chain sender's address.
     */
    event Redeemed(
        address indexed to, 
        uint256 amount, 
        bytes indexed srcPeerAddressIndexed, 
        bytes srcPeerAddress,
        uint256 indexed srcChainId,
        bytes sender
    );

    /**
     * @notice Emitted when crosschain bridge message is successfully sent to a destination chain.
     * @param spender the caller address who initiate the bridge.
     * @param from tokens holder on the current chain.
     * @param dstPeerAddressIndexed indexed destination {peerAddress}.
     * @param dstPeerAddress destination {peerAddress}.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount bridged tokens amount.
     * @param dstChainId destination chain Id.
     */
    event Bridged(
        address indexed spender, 
        address from, 
        bytes indexed dstPeerAddressIndexed, 
        bytes dstPeerAddress,
        bytes to, 
        uint256 amount,
        uint256 indexed dstChainId
    );

    /**
     * @notice Emitted when a {storeFailedExecution} executed in case of failed {redeem} call.
     * @param to tokens receiver on the current chain.
     * @param amount amount to receive.
     * @param customPayload user's additional data.
     * @param originIndexed indexed source chain data.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @param result handled error message.
     * @param nonce unique failed execution's counter.
     */
    event ExecutionFailed(
        address indexed to, 
        uint256 amount, 
        bytes customPayload, 
        Origin indexed originIndexed, 
        Origin origin,
        bytes indexed result, 
        uint256 nonce
    );

    /**
     * @notice Initializes basic settings.
     * @param underlyingToken_ underlying ERC20 token address.
     * @dev In case this contract and ERC20 are the same contract, {underlyingToken_} should be address(this).
     *
     * @param decimals_ underlying token decimals.
     * @dev Can and MUST be called only once.
     */
    function __ATSBase_init(address underlyingToken_, uint8 decimals_) internal onlyInitializing() {
        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();

        if ($._retryNonce > 0) revert ATSBase__E0();

        $._underlyingToken = underlyingToken_;
        $._decimals = decimals_;
        // {_retryNonce} counter increases here for two reasons: 
        // 1. to block repeated {__ATSBase_init} call
        // 2. initialize the {_retryNonce} variable to unify the gas limit calculation of the {storeFailedExecution} call
        $._retryNonce = 1;
    }

    /**
     * @notice Initiates the tokens bridging.
     * @param from tokens holder on the current chain.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayload user's additional data.
     * @param protocolPayload ATS protocol's additional data.
     * @return success call result.
     * @return bridgedAmount bridged tokens amount.
     */
    function bridge(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable virtual returns(bool success, uint256 bridgedAmount) {

        return _bridge(
            msg.sender, 
            from, 
            to, 
            amount, 
            dstChainId, 
            dstGasLimit, 
            customPayload, 
            protocolPayload
        );
    }

    /**
     * @notice Executes the tokens delivery from the source chain.
     * @param to tokens receiver on the current chain.
     * @param amount amount to receive.
     * @param customPayload user's additional data.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @return success call result.
     * @dev Only the {_router} can execute this function.
     */
    function redeem(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin
    ) external payable virtual returns(bool success) {
        _onlyRouter();

        return _redeem(to, amount, customPayload, origin);
    }

    /**
     * @notice Stores failed execution's data.
     * @param to tokens receiver on the current chain.
     * @param amount tokens amount to receive.
     * @param customPayload user's additional data.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @param result handled error message.
     * @dev Only the {_router} can execute this function.
     */
    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        bytes calldata result
    ) external virtual {
        _onlyRouter();

        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();

        $._failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, $._retryNonce))] = to;

        emit ExecutionFailed(to, amount, customPayload, origin, origin, result, $._retryNonce);

        $._retryNonce++;
    }

    /**
     * @notice Executes the tokens delivery after failed execution.
     * @param to tokens receiver on the current chain.
     * @param amount amount to receive.
     * @param customPayload user's additional data.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @param nonce unique failed execution's counter.
     * @return success call result.
     */
    function retryRedeem(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        uint256 nonce
    ) external virtual returns(bool success) {
        if (to == address(0)) return false;
        bytes32 _hash = keccak256(abi.encode(to, amount, customPayload, origin, nonce));

        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();

        if ($._failedExecution[_hash] != to) return false;
        delete $._failedExecution[_hash];

        return _redeem(to, amount, customPayload, origin);
    }

    /**
     * @notice Sets the destination chains settings.
     * @param allowedChainIds chains Ids available for bridging in both directions.
     * @param chainConfigs array of {ChainConfig} settings for provided {allowedChainIds}, containing:
     *        peerAddress: connected {ATSToken} or {ATSConnector} contract address on the destination chain
     *        minGasLimit: the amount of gas required to execute {redeem} function on the destination chain
     *        decimals: connected {peerAddress} decimals on the destination chain
     *        paused: flag indicating whether current contract is paused for sending/receiving messages from the connected {peerAddress}
     *
     * @return success call result.
     */
    function setChainConfig(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs
    ) external virtual returns(bool success) {
        _authorizeCall();
        _setChainConfig(allowedChainIds, chainConfigs);

        return true;
    }

    /**
     * @notice Sets the ATSRouter address.
     * @param newRouter new {_router} address.
     * @return success call result.
     * @dev {_router} address has access rights to execute {redeem} and {storeFailedExecution} functions.
     */
    function setRouter(address newRouter) external virtual returns(bool success) {
        _authorizeCall();
        _setRouter(newRouter);

        return true;
    }

    /**
     * @notice Returns the ATSRouter {_router} address.
     * @return routerAddress the {ATSRouter} address.
     */
    function router() public view returns(address routerAddress) {
        return _getRouter();
    }

    /**
     * @notice Returns the ATSBase protocol version.
     * @return version ATS protocol version.
     */
    function protocolVersion() public pure virtual returns(bytes2 version) {
        return 0xf000;
    }

    /**
     * @notice Returns the underlying ERC20 token address.
     * @return underlyingTokenAddress ERC20 {_underlyingToken} address.
     */
    function underlyingToken() public view virtual returns(address underlyingTokenAddress) {
        return _getUnderlyingToken();
    }

    /**
     * @notice Returns whether failed execution's data is stored. 
     * @param to tokens receiver on the current chain.
     * @param amount amount to receive.
     * @param customPayload user's additional data.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @param nonce unique failed execution's counter.
     * @return isFailed result.
     */
    function isExecutionFailed(
        address to, 
        uint256 amount, 
        bytes calldata customPayload, 
        Origin calldata origin,
        uint256 nonce
    ) external view virtual returns(bool isFailed) {
        if (to == address(0)) return false;

        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();

        return $._failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, nonce))] == to;
    }

    /**
     * @notice Returns estimated minimal amount to pay for bridging and minimal gas limit.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayloadLength user's additional data length.
     * @param protocolPayload ATS protocol's additional data.
     * @return paymentAmount source chain native currency amount to pay for bridging.
     * @return dstMinGasLimit destination chain minimal {redeem} call gas limit.
     */
    function estimateBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit, 
        uint16 customPayloadLength,
        bytes calldata protocolPayload
    ) public view virtual returns(uint256 paymentAmount, uint64 dstMinGasLimit) {
        dstMinGasLimit = IATSRouter(_getRouter()).dstMinGasLimit(dstChainId);
        uint64 _configMinGasLimit = _getChainConfig(dstChainId).minGasLimit;
        
        dstMinGasLimit = dstMinGasLimit >= _configMinGasLimit ? dstMinGasLimit : _configMinGasLimit;
        dstGasLimit = dstMinGasLimit >= dstGasLimit ? dstMinGasLimit : dstGasLimit;

        return (
            IATSRouter(_getRouter()).getBridgeFee(dstChainId, dstGasLimit, customPayloadLength, protocolPayload), 
            dstMinGasLimit
        );
    }

    /**
     * @notice Returns destination chain configs for sending and receiving crosschain messages.
     * @param chainIds destination chain Ids.
     * @return configs array of {ChainConfig} settings for provided {chainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     */
    function getChainConfigs(uint256[] calldata chainIds) external view returns(ChainConfig[] memory configs) {
        configs = new ChainConfig[](chainIds.length);
        for (uint256 i; chainIds.length > i; ++i) configs[i] = _getChainConfig(chainIds[i]); 
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns(bool) {
        return interfaceId == type(IATSBase).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Internal function that initiates the tokens bridging.
     * @param spender transaction sender, must be {msg.sender}.
     * @param from tokens holder on the current chain.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayload user's additional data.
     * @param protocolPayload ATS protocol's additional data.
     *
     * @return success call result.
     * @return bridgedAmount bridged tokens amount.
     *
     * @dev Implements all basic checks and calculations, containing:
     *      1. required destination gas limit check
     *      2. destination peer is not paused check
     *      3. amount conversion in accordance with destination token decimals
     *      4. bridged tokens amount is not zero check
     */
    function _bridge(
        address spender,
        address from,
        bytes memory to, 
        uint256 amount, 
        uint256 dstChainId, 
        uint64 dstGasLimit,
        bytes memory customPayload,
        bytes memory protocolPayload
    ) internal virtual returns(bool success, uint256 bridgedAmount) {
        if (from == address(0)) from = spender;

        ChainConfig memory config = _getChainConfig(dstChainId); 

        if (config.minGasLimit > dstGasLimit) revert ATSBase__E6();
        if (config.paused) revert ATSBase__E5();

        uint8 _srcDecimals = _getDecimals();
        amount = amount.convert(_srcDecimals, config.decimals).convert(config.decimals, _srcDecimals);

        amount = _burnFrom(
            spender,
            from,
            to, 
            amount, 
            dstChainId, 
            customPayload
        );

        if (amount == 0) revert ATSBase__E3();

        emit Bridged(spender, from, config.peerAddress, config.peerAddress, to, amount, dstChainId);

        return (
            _sendRequest(
                msg.value,
                config.peerAddress, 
                to, 
                amount,
                _srcDecimals, 
                dstChainId,
                dstGasLimit,
                customPayload,
                protocolPayload
            ), 
            amount
        );
    }

    /**
     * @notice Internal function that call {_router} contract to send crosschain bridge message.
     * @param payment the native currency amount that will be transfer to the {_router} as payment for sending this message.
     * @param dstToken the contract address on the {dstChainId} that will receive this message.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount amount that {to} address will receive (before decimals conversion on the destination chain).
     * @param srcDecimals source ERC20 underlying token decimals.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayload user's additional data.
     * @param protocolPayload ATS protocol's additional data.
     *
     * @return success call result.
     *
     * @dev {customPayload} can be used to send an additional data, it will be sent to the {dstToken} contract on the 
     * destination chain in accordance with {redeem} function.
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
    ) internal virtual returns(bool success) {
        return IATSRouter(_getRouter()).bridge{value: payment}( 
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
     * @notice Internal function that releases tokens to receiver by crosschain message from the source chain.
     * @param to bridged tokens receiver on the current chain.
     * @param amount amount that {to} address will receive (before decimals conversion on the current chain).
     * @param customPayload user's additional data.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @return success call result.
     *
     * @dev Implements all basic checks and calculations, containing:
     *      1. receiver address is not zero address check
     *      2. source peer address is allowed to send messages to this contract check
     *      3. source peer address is not paused check
     *      4. amount conversion in accordance with source token decimals
     */
    function _redeem(
        address to,
        uint256 amount,
        bytes memory customPayload,
        Origin memory origin
    ) internal virtual returns(bool success) {
        if (to == address(0)) revert ATSBase__E2();

        ChainConfig memory config = _getChainConfig(origin.chainId); 

        if (!config.peerAddress.equal(origin.peerAddress)) revert ATSBase__E7();
        if (config.paused) revert ATSBase__E5();
        
        amount = _mintTo(to, amount.convert(origin.decimals, _getDecimals()), customPayload, origin);

        emit Redeemed(to, amount, origin.peerAddress, origin.peerAddress, origin.chainId, origin.sender);

        return true;
    }

    /**
     * @notice Internal function that sets the destination chains settings and emits corresponding event.
     * @param allowedChainIds chains Ids available for bridging in both directions.
     * @param chainConfigs array of {ChainConfig} settings for provided {allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     */
    function _setChainConfig(uint256[] memory allowedChainIds, ChainConfig[] memory chainConfigs) internal virtual {
        if (allowedChainIds.length != chainConfigs.length) revert ATSBase__E4();

        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();

        for (uint256 i; allowedChainIds.length > i; ++i) $._chainConfig[allowedChainIds[i]] = chainConfigs[i];

        emit ChainConfigUpdated(msg.sender, allowedChainIds, chainConfigs);
    }

    /**
     * @notice Internal function that sets the ATSRouter address and emits corresponding event.
     * @param newRouter new {_router} address.
     */
    function _setRouter(address newRouter) internal virtual {
        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();
        $._router = newRouter;

        emit RouterSet(msg.sender, newRouter);
    }

    /**
     * @notice Internal view function that implement basic access check for {redeem} and {storeFailedExecution} functions.
     */
    function _onlyRouter() internal view {
        if (msg.sender != _getRouter()) revert ATSBase__E1();
    }

    /**
     * @notice Internal view function that returns destination chain config for sending and receiving crosschain messages.
     * @param dstChainId destination chain Id.
     * @return config {ChainConfig} settings for provided {dstChainId}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     */
    function _getChainConfig(uint256 dstChainId) internal view returns(ChainConfig memory config) {
        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();
        return $._chainConfig[dstChainId];
    }

    /**
     * @notice Internal view function that returns the ATSRouter {_router} address.
     * @return routerAddress the {ATSRouter} address.
     */
    function _getRouter() internal view returns(address routerAddress) {
        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();
        return $._router;
    }

    /**
     * @notice Internal view function that returns the underlying ERC20 token address.
     * @return underlyingTokenAddress ERC20 {_underlyingToken} address.
     */
    function _getUnderlyingToken() internal view returns(address underlyingTokenAddress) {
        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();
        return $._underlyingToken;
    }

    /**
     * @notice Internal view function that returns decimals value of the {ATSToken}.
     * @return {_decimals} of the {ATSToken}.
     */
    function _getDecimals() internal view returns(uint8) {
        ATSBaseUpgradeableStorage storage $ = _getATSBaseStorage();
        return $._decimals;
    }

    /**
     * @dev The function MUST be overridden to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal virtual;

    /**
     * @dev The function MUST be overridden to implement {mint}/{transfer} underlying tokens to receiver {to} address by {_router}.
     * 
     * IMPORTANT: Returned {receivedAmount} may be different from {amount}, if custom logic inside {_mintTo} function modifies it.
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory customPayload,
        Origin memory origin
    ) internal virtual returns(uint256 receivedAmount);

    /**
     * @dev The function MUST be overridden to implement {burn}/{transferFrom} underlying tokens from {spender}/{from} 
     * address for bridging.
     *
     * IMPORTANT: If this contract IS a token itself, and the {spender} and {from} addresses are different, an {ERC20.allowance} 
     * check MUST be added.
     *
     * IMPORTANT: If this contract IS NOT a token itself, the {spender} and {from} addresses MUST be the same to prevent tokens
     * stealing via third-party allowances.
     *
     * IMPORTANT: Returned {bridgedAmount} value will be actually used for crosschain message, as it may be different from {amount}, 
     * if custom logic inside {_burnFrom} function modifies it.
     */
    function _burnFrom(
        address spender,
        address from,
        bytes memory to, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory customPayload
    ) internal virtual returns(uint256 bridgedAmount);

    function _getATSBaseStorage() private pure returns(ATSBaseUpgradeableStorage storage $) {
        assembly {
            $.slot := ATSBASE_STORAGE_LOCATION
        }
    }

}