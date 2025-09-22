// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "../libraries/ATSERC20DataTypes.sol";
import "../libraries/ATSUpgradeChecker.sol";
import "../libraries/ATSCoreDataTypes.sol";
import "../libraries/AddressConverter.sol";
import "../libraries/SafeCall.sol";

import "./interfaces/IATSRouter.sol";
import "./interfaces/IATSBaseExtended.sol";
import "../interfaces/IATSMasterRouter.sol";
import "../mock/crosschain/interfaces/IGasEstimator.sol";

/**
 * @notice A contract manages the sending and receiving of bridge crosschain messages for ATSTokens and ATSConnectors 
 * via ATS protocol.
 *
 * @dev It is an implementation of {ATSRouter} for UUPS.
 * The {ATSRouter} contract has specific access rights in target deployments to execute {redeem} and other required functions.
 */
contract ATSRouter is IATSRouter, ATSUpgradeChecker, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeCall for address;

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for *;

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice {AccessControl} role identifier for manager addresses.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Internal ATS protocol identifier for crosschain bridge messages.
    bytes1 private constant BRIDGE_MESSAGE_TYPE = 0x01;

    /// @notice Internal ATS protocol identifier for crosschain config update messages.
    bytes1 private constant UPDATE_MESSAGE_TYPE = 0x03;

    /// @notice {bytes32} type length.
    uint8 private constant BYTES32_LENGTH = 32;

    uint64 private constant DEFAULT_DST_MIN_GAS_LIMIT_AMOUNT = 285000;
    uint64 private constant DEFAULT_DST_UPDATE_GAS_AMOUNT = 70000;

    /// @notice Address of the {ATSMasterRouter} contract.
    address public immutable MASTER_ROUTER;

    /// @notice Address of the {GasEstimator} contract
    address public immutable GAS_ESTIMATOR;

    /// @notice The amount of gas required to execute {IATSBase.storeFailedExecution} function.
    uint64 private immutable STORE_GAS_LIMIT;

    /// @notice The amount of gas required to execute {execute} function without {IATSBase.redeem} call.
    uint64 private immutable SERVICE_GAS;

    /// @notice The amount of gas per one {ChainConfig} required to execute {IATSBase.setChainConfigByRouter} function.
    uint64 private immutable UPDATE_GAS_LIMIT;

    /// @notice The gas limit for native currency transfer by low level {call} function.
    uint64 private immutable ETH_CALL_GAS_LIMIT;

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64 dstChainIdMinGasLimit) _dstMinGasLimit;
        mapping(uint256 chainId => uint64 dstChainIdUpdateGas) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xedc98a2881838e40a1872dba8b254f08f263ac4d9e6727950729f5aaa76eef00;

    /// @notice Indicates an error that the provided {msg.value} is insufficient to pay for the sending message.
    error ATSRouter__E0();

    /// @notice Indicates an error that the provided {dstChainId} is invalid.
    error ATSRouter__E1();

    /// @notice Indicates an error that the function caller has an incompatible {protocolVersion}.
    error ATSRouter__E2();

    /// @notice Indicates an error that the function caller is not the {MASTER_ROUTER}.
    error ATSRouter__E3();
    
    /// @notice Indicates an error that the provided {to} address is empty or zero address.
    error ATSRouter__E4();
    
    /// @notice Indicates an error that the provided {dstToken} address is empty or zero address.
    error ATSRouter__E5();
    
    /// @notice Indicates an error that the provided {gasLimit} is below the required minimum value.
    error ATSRouter__E6();

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error ATSRouter__E7();

    /**
     * @notice Emitted when the {_dstMinGasLimit} is updated.
     * @param dstChainId destination chain Id.
     * @param newDstMinGasLimit new {_dstMinGasLimit} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstMinGasLimit} value.
     */
    event DstMinGasLimitSet(uint256 indexed dstChainId, uint256 newDstMinGasLimit, address indexed caller);

    /**
     * @notice Emitted when the {_dstUpdateGas} is updated.
     * @param dstChainId destination chain Id.
     * @param newDstUpdateGas new {_dstUpdateGas} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstUpdateGas} value.
     */
    event DstUpdateGasSet(uint256 indexed dstChainId, uint256 newDstUpdateGas, address indexed caller);

    /**
     * @notice Initializes immutable variables.
     * @param masterRouter address of the {ATSMasterRouter} contract.
     * @param gasEstimator address of the {GasEstimator} contract.
     * @param storeGasLimit amount of gas required to execute {storeFailedExecution} function.
     * @param serviceGas amount of gas required to execute {execute} function without {IATSBase.redeem} call.
     * @param updateGasLimit amount of gas required to execute {setChainConfigByRouter} function.
     * @param ethCallGasLimit gas limit for native currency transfer by low level {call} function.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(
        address masterRouter, 
        address gasEstimator,
        uint64 storeGasLimit,
        uint64 serviceGas,
        uint64 updateGasLimit,
        uint64 ethCallGasLimit
    ) ATSUpgradeChecker(hex'02') {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        GAS_ESTIMATOR = gasEstimator;
        STORE_GAS_LIMIT = storeGasLimit;
        SERVICE_GAS = serviceGas;
        UPDATE_GAS_LIMIT = updateGasLimit;
        ETH_CALL_GAS_LIMIT = ethCallGasLimit;
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     * @param defaultAdmin initial {DEFAULT_ADMIN_ROLE} address.
     */
    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Sends tokens bridge message by {ATSToken} or {ATSConnector} to the destination chain.
     * @param dstToken the address of the {ATSToken} or {ATSConnector} on the destination chain.
     * @param sender {msg.sender} address of {ATSToken} or {ATSConnector} call.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param srcDecimals decimals of the source underlying ERC20 token.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayload user's additional data.
     * @param protocolPayload ATS protocol's additional data.
     * @return success call result.
     *
     * @dev The {ATSToken} or {ATSConnector} peer contract on source and destination chains MUST follow requirements:
     *      1. Supporting and following the logic and interface of {ATSBase} contract
     *      2. ATS {protocolVersion} compatibility
     *      3. The {ATSRouter} contract must have specific access rights to execute {redeem} and {storeFailedExecution} functions
     *      4. The destination peer's {ChainConfig} must contain a source peer address
     */
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
    ) external payable whenNotPaused() returns(bool success) {
        if (IATSBase(msg.sender).protocolVersion() != protocolVersion()) revert ATSRouter__E2();
        if (dstMinGasLimit(dstChainId) > dstGasLimit) revert ATSRouter__E6();
        if (dstChainId == block.chainid) revert ATSRouter__E1();
        if (_isZeroAddress(to)) revert ATSRouter__E4();
        if (_isZeroAddress(dstToken)) revert ATSRouter__E5();

        uint256 _bridgeFee = getBridgeFee(dstChainId, dstGasLimit, customPayload.length, protocolPayload);

        if (_bridgeFee > msg.value) revert ATSRouter__E0();

        IATSMasterRouter(MASTER_ROUTER).sendProposal{value: _bridgeFee}(
            dstGasLimit, 
            dstChainId, 
            abi.encode(
                dstToken,
                BRIDGE_MESSAGE_TYPE,
                abi.encode(
                    sender,
                    to, 
                    amount, 
                    block.chainid, 
                    msg.sender.toBytes(),
                    srcDecimals,
                    dstGasLimit,
                    customPayload
                )
            )
        );

        if (msg.value > _bridgeFee) msg.sender.call{value: msg.value - _bridgeFee, gas: ETH_CALL_GAS_LIMIT}("");
        
        return true;
    }

    /**
     * @notice Sends a crosschain message to update {ATSToken} or {ATSConnector} destination chain settings to the provided chain.
     * @param sender {msg.sender} address of {ATSToken} or {ATSConnector} call.
     * @param dstChainIds destination chain Ids where the configuration updates should be applied.
     * @param dstPeers {ATSToken} or {ATSConnector} peer addresses on the {dstChainIds}.
     * @param newConfigs array of {ChainConfigUpdate} chain settings should be applied, containing:
     *        allowedChainIds: chains Ids available for bridging in both directions
     *        chainConfigs: {ChainConfig} settings for provided {ChainConfigUpdate.allowedChainIds}
     * @dev See the {ATSERC20DataTypes.ChainConfigUpdate} and {ATSERC20DataTypes.ChainConfig} for details
     * @return success call result.
     *
     * @dev {ATSToken} or {ATSConnector} peer contract on the destination chain must inherit from the {ATSBaseExtended} 
     * extension or implement its' logic and interface otherwise.
     */
    function requestToUpdateConfig(
        bytes calldata sender,
        uint256[] calldata dstChainIds,
        bytes[] calldata dstPeers,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable whenNotPaused() returns(bool success) {
        if (IATSBase(msg.sender).protocolVersion() != protocolVersion()) revert ATSRouter__E2();
        
        if (dstChainIds.length != dstPeers.length) revert ATSRouter__E7();
        if (dstChainIds.length != newConfigs.length) revert ATSRouter__E7();

        uint256 _paymentAmountTotal;

        for (uint256 i; dstChainIds.length > i; ++i) {
            if (dstChainIds[i] == block.chainid) revert ATSRouter__E1();
            if (_isZeroAddress(dstPeers[i])) revert ATSRouter__E5();

            (uint256 _paymentAmount, uint256 _dstGasLimit) = _getUpdateFee(dstChainIds[i], newConfigs[i].allowedChainIds.length);

            _paymentAmountTotal += _paymentAmount;

            IATSMasterRouter(MASTER_ROUTER).sendProposal{value: _paymentAmount}(
                _dstGasLimit,
                dstChainIds[i], 
                abi.encode(
                    dstPeers[i],
                    UPDATE_MESSAGE_TYPE,
                    abi.encode(
                        sender, 
                        block.chainid, 
                        msg.sender.toBytes(),
                        newConfigs[i]
                    )
                )
            );
        }

        if (_paymentAmountTotal > msg.value) revert ATSRouter__E0();

        return true;
    }

    /**
     * @notice Executes a crosschain message received from {ATSToken} or {ATSConnector} on source chain.
     * @param srcChainId source chain Id of crosschain message.
     * @param peerAddress {ATSToken} or {ATSConnector} contract address on current chain.
     * @param messageType internal ATS protocol identifier for crosschain messages.
     * @param localParams abi.encoded execution parameters depending on the {messageType}.
     * @return opResult the execution result code, represented as a uint8(ATSCoreDataTypes.OperationResult).
     * @dev Only {MASTER_ROUTER} can execute this function.
     */
    function execute(
        uint256 srcChainId,
        address peerAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult) {
        if (msg.sender != MASTER_ROUTER) revert ATSRouter__E3();

        if (paused()) return uint8(OperationResult.RouterPaused);
        if (srcChainId == block.chainid) return uint8(OperationResult.InvalidSrcChainId);

        if (messageType == UPDATE_MESSAGE_TYPE) return _executeUpdateConfigs(srcChainId, peerAddress, localParams);

        if (messageType == BRIDGE_MESSAGE_TYPE) return _executeRedeem(srcChainId, peerAddress, localParams);

        return uint8(OperationResult.InvalidMessageType);
    }

    /**
     * @notice Pauses the {bridge}, {requestToUpdateConfig}, and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {bridge}, {requestToUpdateConfig}, and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sets the amounts of gas required to execute {redeem} function on the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newDstMinGasLimits the amounts of gas required to execute {redeem} on the provided {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstMinGasLimit(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstMinGasLimits
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstMinGasLimits.length) revert ATSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstMinGasLimit(dstChainIds[i], newDstMinGasLimits[i]);
    }

    /**
     * @notice Sets the amounts of gas per one {ChainConfig} required to execute {setChainConfigByRouter} function on 
     * destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newDstUpdateGas amounts of gas per one {ChainConfig} required to execute {setChainConfigByRouter} function
     * on the provided {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstUpdateGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstUpdateGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstUpdateGas.length) revert ATSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstUpdateGas(dstChainIds[i], newDstUpdateGas[i]);
    }

    /**
     * @notice Returns the ATSRouter protocol version.
     * @return version ATS protocol version.
     */
    function protocolVersion() public pure returns(bytes2 version) {
        return 0xf000;
    }

    /**
     * @notice Calculates the fee amount required for sending crosschain bridge message to the provided destination chain.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @custom:unused-param payloadLength user's additional data length.
     * @custom:unused-param protocolPayload ATS protocol's additional data.
     * @return bridgeFeeAmount fee amount required for sending crosschain bridge message in current native currency.
     */
    function getBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit, 
        uint256 /* payloadLength */,
        bytes calldata /* protocolPayload */
    ) public view returns(uint256 bridgeFeeAmount) {
        if (dstGasLimit == 0) dstGasLimit = 1;
        return IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(dstChainId, dstGasLimit);
    }

    /**
     * @notice Calculates the fee amount required for sending crosschain update config message to the provided destination chains.
     * @param dstChainIds destination chain Ids.
     * @param configsLength sum of new {ChainConfig} lengths for each {dstChainId}.
     * @return updateFeeAmount total fee amount required for sending crosschain update config message in current native currency.
     */
    function getUpdateFee(
        uint256[] calldata dstChainIds, 
        uint256[] calldata configsLength
    ) external view returns(uint256 updateFeeAmount) {
        if (dstChainIds.length != configsLength.length) revert ATSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) {
            (uint256 _paymentAmount, /* uint256 _dstGasLimit */) = _getUpdateFee(dstChainIds[i], configsLength[i]);
            updateFeeAmount += _paymentAmount;
        }
    }
    
    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IATSRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the amount of gas required to execute {redeem} function on the destination chain.
     * @param dstChainId destination chain Id.
     * @return dstMinGasLimitAmount the amount of gas required to execute {redeem} function on the provided {dstChainId}.
     */
    function dstMinGasLimit(uint256 dstChainId) public view returns(uint64 dstMinGasLimitAmount) {
        Main storage $ = _getMainStorage();
        dstMinGasLimitAmount = $._dstMinGasLimit[dstChainId];
        return dstMinGasLimitAmount > 0 ? dstMinGasLimitAmount : DEFAULT_DST_MIN_GAS_LIMIT_AMOUNT;
    }

    /**
     * @notice Returns the amount of gas per {ChainConfig} required to execute {setChainConfigByRouter} function on the
     * destination chain.
     * @param dstChainId destination chain Id.
     * @return dstUpdateGasAmount the amount of gas per {ChainConfig} required to execute {setChainConfigByRouter} 
     * function on the provided {dstChainId}.
     */
    function dstUpdateGas(uint256 dstChainId) public view returns(uint64 dstUpdateGasAmount) {
        Main storage $ = _getMainStorage(); 
        dstUpdateGasAmount = $._dstUpdateGas[dstChainId];
        return dstUpdateGasAmount > 0 ? dstUpdateGasAmount : DEFAULT_DST_UPDATE_GAS_AMOUNT;
    }

    function _getUpdateFee(uint256 dstChainId, uint256 configsLength) internal view returns(uint256 updateFeeAmount, uint256 dstGasLimit) {
        dstGasLimit = (configsLength + 4) * dstUpdateGas(dstChainId);
        return (IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(dstChainId, dstGasLimit), dstGasLimit);
    }

    function _isZeroAddress(bytes calldata bytesAddress) internal pure returns(bool zeroAddress) {
        if (BYTES32_LENGTH >= bytesAddress.length) if (bytes32(bytesAddress) == bytes32(0)) return true;
    }

    function _executeRedeem(
        uint256 srcChainId, 
        address peerAddress, 
        bytes calldata localParams
    ) internal returns(uint8 opResult) {

        (
            bytes memory _srcSender,
            bytes memory _to, 
            uint256 _amount, 
            uint256 _srcChainId, 
            bytes memory _srcToken, 
            uint8 _srcDecimals,
            uint64 _gasLimit, 
            bytes memory _customPayload
        ) = abi.decode(localParams, (bytes, bytes, uint256, uint256, bytes, uint8, uint64, bytes));

        if (_srcChainId != srcChainId) return uint8(OperationResult.InvalidSrcChainId);
        if (_srcToken.length == 0) return uint8(OperationResult.InvalidSrcPeerAddress); 

        address _receiver = _to.toAddress(); 

        // the EVM receiver address must be 20 bytes long
        if (_to.length != 20) {
            return uint8(OperationResult.InvalidToAddress); 
        } else {
            if (_receiver == address(0)) return uint8(OperationResult.InvalidToAddress);
        }

        Origin memory _origin = Origin({
            sender: _srcSender,
            chainId: _srcChainId,
            peerAddress: _srcToken,
            decimals: _srcDecimals
        });

        if (_gasLimit > gasleft()) {
            if (SERVICE_GAS > gasleft()) {
                _gasLimit = 0;
            } else {
                _gasLimit = uint64(gasleft() - SERVICE_GAS);
            }
        }

        _gasLimit = _gasLimit > STORE_GAS_LIMIT ? _gasLimit - STORE_GAS_LIMIT : 0;

        (bool _redeemResult, bytes memory _redeemResponse) = peerAddress.safeCall(
            _gasLimit,
            0,   // call {value}
            150, // max {_redeemResponse} bytes length to copy
            abi.encodeCall(IATSBase.redeem, (_receiver, _amount, _customPayload, _origin))
        );

        if (_redeemResult) {
            return uint8(OperationResult.Success);
        } else {
            bool _storeResult;

            if (gasleft() > STORE_GAS_LIMIT + SERVICE_GAS) {
                (_storeResult, /* bytes memory _storeResponse */) = peerAddress.safeCall(
                    STORE_GAS_LIMIT,
                    0, // call {value}
                    0, // max {_storeResponse} bytes length to copy
                    abi.encodeCall(
                        IATSBase.storeFailedExecution, 
                        (_receiver, _amount, _customPayload, _origin, _redeemResponse)
                    )
                );
            }
            
            if (_storeResult) {
                return uint8(OperationResult.FailedAndStored);
            } else {
                return uint8(OperationResult.Failed);
            }
        }
    }

    function _executeUpdateConfigs(
        uint256 srcChainId, 
        address peerAddress,
        bytes calldata localParams
    ) internal returns(uint8 opResult) {

        (
            bytes memory _srcSender, 
            uint256 _srcChainId, 
            bytes memory _srcToken, 
            ChainConfigUpdate memory _newConfig
        ) = abi.decode(localParams, (bytes, uint256, bytes, ChainConfigUpdate));

        if (_srcChainId != srcChainId) return uint8(OperationResult.InvalidSrcChainId);
        if (_srcToken.length == 0) return uint8(OperationResult.InvalidSrcPeerAddress);

        Origin memory origin = Origin({
            sender: _srcSender,
            chainId: _srcChainId,
            peerAddress: _srcToken,
            decimals: 0 // meaningless variable in this message type
        });

        (bool _updateResult, /* bytes memory _updateResponse */) = peerAddress.safeCall(
            (_newConfig.allowedChainIds.length + 4) * UPDATE_GAS_LIMIT,
            0, // call {value}
            0, // max {_updateResponse} bytes length to copy
            abi.encodeCall(
                IATSBaseExtended.setChainConfigByRouter, 
                (_newConfig.allowedChainIds, _newConfig.chainConfigs, origin)
            )
        );

        if (_updateResult) {
            return uint8(OperationResult.Success);
        } else {
            return uint8(OperationResult.Failed);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _setDstMinGasLimit(uint256 dstChainId, uint64 newDstMinGasLimit) internal {
        Main storage $ = _getMainStorage();
        $._dstMinGasLimit[dstChainId] = newDstMinGasLimit;

        emit DstMinGasLimitSet(dstChainId, newDstMinGasLimit, msg.sender);
    }

    function _setDstUpdateGas(uint256 dstChainId, uint64 newDstUpdateGas) internal {
        Main storage $ = _getMainStorage();
        $._dstUpdateGas[dstChainId] = newDstUpdateGas;

        emit DstUpdateGasSet(dstChainId, newDstUpdateGas, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}