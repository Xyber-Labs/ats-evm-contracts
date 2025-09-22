// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/AddressConverter.sol";
import "../libraries/ATSCoreDataTypes.sol";
import "../libraries/ATSERC20DataTypes.sol";
import "../libraries/DecimalsConverter.sol";
import "../libraries/ATSUpgradeChecker.sol";

import "../interfaces/IPausable.sol";
import "./interfaces/IATSFactory.sol";
import "../interfaces/IATSRegistry.sol";
import "../interfaces/IATSMasterRouter.sol";
import "./interfaces/IATSDeploymentRouter.sol";
import "../mock/crosschain/interfaces/IGasEstimator.sol";

/**
 * @notice A contract manages the sending and receiving of crosschain deployment requests for ATSTokens and 
 * ATSConnectors via ATS protocol.
 *
 * @dev It is an implementation of {ATSDeploymentRouter} for UUPS.
 */
contract ATSDeploymentRouter is IATSDeploymentRouter, ATSUpgradeChecker, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for address;

    /// @dev Library for converting various token amounts that have different {ERC20.decimals} values.
    using DecimalsConverter for uint256;

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice {AccessControl} role identifier for manager addresses.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Internal ATS protocol identifier for crosschain deploy messages.
    bytes1 private constant DEPLOY_MESSAGE_TYPE = 0x02;

    /// @notice Basis points divisor for percentage calculations (100.00%).
    uint16 private constant BPS = 10000;

    /// @dev Precision used for the native currency to payment token rate calculations.
    uint24 private constant PRECISION = 1000000;

    /// @notice Address of the {ATSMasterRouter} contract.
    address public immutable MASTER_ROUTER;

    /// @notice Address of the {GasEstimator} contract.
    address public immutable GAS_ESTIMATOR;

    /// @notice Address of the {ATSFactory} contract.
    address public immutable FACTORY;

    /// @notice Address of the {ATSRegistry} contract.
    address public immutable REGISTRY;

    /// @notice The maximum number of chains on which crosschain deployment is available.
    uint8 private immutable AVAILABLE_CHAINS_NUMBER; 

    /// @notice The gas limit for native currency transfer by low level {call} function.
    uint64 private immutable ETH_CALL_GAS_LIMIT; 

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xdb75208cb2e427053595417046d97ee9f6d1661578363544323ea98f9f1b6600;

    /// @notice Indicates an error that the provided {deployMetadata} array has zero length.
    error ATSDeploymentRouter__E0();

    /// @notice Indicates an error that the provided {deployMetadata.dstChainId} is not supported.
    error ATSDeploymentRouter__E1();

    /// @notice Indicates an error that the function caller is not the {MASTER_ROUTER}.
    error ATSDeploymentRouter__E2();

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error ATSDeploymentRouter__E3();

    /// @notice Indicates an error that the provided {deployMetadata.params} contains unsupported {ATSToken} configuration to deploy.
    error ATSDeploymentRouter__E4();

    /// @notice Indicates an error that the provided {msg.value} is insufficient to pay for the request.
    error ATSDeploymentRouter__E5();

    /// @notice Indicates an error that the provided {DeployTokenData.mintedAmountToOwner} exceeds the {DeployTokenData.initialSupply}.
    error ATSDeploymentRouter__E6();

    /// @notice Indicates an error that the provided {DeployMetadata.params.allowedChainIds} exceeds the {AVAILABLE_CHAINS_NUMBER}.
    error ATSDeploymentRouter__E7();

    /**
     * @notice Emitted when the {DstDeployConfig.factory} is updated.
     * @param dstChainId destination chain Id.
     * @param newFactory new {DstDeployConfig.factory} address for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.factory}.
     */
    event ConfigFactorySet(uint256 indexed dstChainId, bytes newFactory, address indexed caller);

    /**
     * @notice Emitted when the {DstDeployConfig.protocolFee} is updated.
     * @param dstChainId destination chain Id.
     * @param newProtocolFee new {DstDeployConfig.protocolFee} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.protocolFee}.
     */
    event ConfigProtocolFeeSet(uint256 indexed dstChainId, uint16 newProtocolFee, address indexed caller);

    /**
     * @notice Emitted when the {DstDeployConfig.tokenDeployGas} is updated.
     * @param dstChainId destination chain Id.
     * @param newTokenDeployGas new {DstDeployConfig.tokenDeployGas} amount for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.tokenDeployGas}.
     */
    event ConfigTokenDeployGasSet(uint256 indexed dstChainId, uint64 newTokenDeployGas, address indexed caller);

    /**
     * @notice Emitted when the {DstDeployConfig.connectorDeployGas} is updated.
     * @param dstChainId destination chain Id.
     * @param newConnectorDeployGas new {DstDeployConfig.connectorDeployGas} amount for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.connectorDeployGas}.
     */
    event ConfigConnectorDeployGasSet(uint256 indexed dstChainId, uint64 newConnectorDeployGas, address indexed caller);

    /**
     * @notice Initializes immutable variables.
     * @param masterRouter address of the {ATSMasterRouter} contract.
     * @param gasEstimator address of the {GasEstimator} contract.
     * @param factory address of the {ATSFactory} contract.
     * @param registry address of the {ATSRegistry} contract.
     * @param availableChainsNumber maximum number of chains on which crosschain deployment is available.
     * @param ethCallGasLimit gas limit for native currency transfer by low level {call} function.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */ 
    constructor(
        address masterRouter, 
        address gasEstimator, 
        address factory, 
        address registry,
        uint8 availableChainsNumber,
        uint64 ethCallGasLimit
    ) ATSUpgradeChecker(hex'04') {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        GAS_ESTIMATOR = gasEstimator;
        FACTORY = factory;
        REGISTRY = registry;
        AVAILABLE_CHAINS_NUMBER = availableChainsNumber;
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
     * @notice Sends ATSToken and ATSConnector deployment crosschain requests via ATS protocol.
     * @param deployMetadata array of {DeployMetadata} structs, containing destination chain Ids and deploy parameters:
     *        dstChainId: destination chain Id
     *        isConnector: flag indicating whether is request for deploy connector(true) or token(false)
     *        params: abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct
     * @dev See the {ATSERC20DataTypes.DeployTokenData} and {ATSERC20DataTypes.DeployConnectorData} for details.
     *
     * @custom:unused-param {paymentToken} address of the token used for payment. 
     * IMPORTANT: Payments in non-native token were deprecated.
     *
     * @return paymentAmount total native token payment required for send deployment requests.
     * @return currentChainDeployment deployment address on the current chain (if a relevant request was provided).
     */
    function sendDeployRequest(
        DeployMetadata[] calldata deployMetadata,
        address /* paymentToken */
    ) external payable whenNotPaused() returns(uint256 paymentAmount, address currentChainDeployment) {
        if (deployMetadata.length == 0) revert ATSDeploymentRouter__E0();

        for (uint256 i; deployMetadata.length > i; ++i) {
            if (deployMetadata[i].dstChainId != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(deployMetadata[i].dstChainId);

                if (config.factory.length == 0) revert ATSDeploymentRouter__E1();

                if (deployMetadata[i].isConnector) {
                    DeployConnectorData memory _params = abi.decode(deployMetadata[i].params, (DeployConnectorData));

                    if (_params.allowedChainIds.length != _params.chainConfigs.length) revert ATSDeploymentRouter__E3();
                    if (_params.allowedChainIds.length > AVAILABLE_CHAINS_NUMBER) revert ATSDeploymentRouter__E7();
                } else {
                    DeployTokenData memory _params = abi.decode(deployMetadata[i].params, (DeployTokenData));

                    if (_params.allowedChainIds.length != _params.chainConfigs.length) revert ATSDeploymentRouter__E3();
                    if (_params.allowedChainIds.length > AVAILABLE_CHAINS_NUMBER) revert ATSDeploymentRouter__E7();

                    if (_params.pureToken) {
                        if (_params.mintable || _params.globalBurnable || _params.onlyRoleBurnable || _params.feeModule) {
                            revert ATSDeploymentRouter__E4();
                        }

                        if (_params.mintedAmountToOwner > _params.initialSupply) revert ATSDeploymentRouter__E6();
                    } else {
                        if (_params.mintedAmountToOwner != _params.initialSupply) revert ATSDeploymentRouter__E6();
                    }
                }

                uint256 _paymentAmount = IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(
                    deployMetadata[i].dstChainId, 
                    deployMetadata[i].isConnector ? config.connectorDeployGas : config.tokenDeployGas
                );

                IATSMasterRouter(MASTER_ROUTER).sendProposal{value: _paymentAmount}(
                    deployMetadata[i].isConnector ? config.connectorDeployGas : config.tokenDeployGas,
                    deployMetadata[i].dstChainId,
                    abi.encode(
                        config.factory,
                        DEPLOY_MESSAGE_TYPE,
                        abi.encode(
                            deployMetadata[i].isConnector, 
                            msg.sender.toBytes(), 
                            deployMetadata[i].params
                        )
                    )
                );

                paymentAmount += _paymentAmount;
            } else {
                (, currentChainDeployment) = IATSFactory(FACTORY).deployByRouter(
                    deployMetadata[i].isConnector, 
                    msg.sender.toBytes(), 
                    deployMetadata[i].params
                );
            }
        }

        if (paymentAmount > msg.value) revert ATSDeploymentRouter__E5();
        if (msg.value > paymentAmount) msg.sender.call{value: msg.value - paymentAmount, gas: ETH_CALL_GAS_LIMIT}("");
    }

    /**
     * @notice Executes a deployment request received from source chain via ATS protocol.
     * @param srcChainId source chain Id of crosschain message.
     * @param factoryAddress {ATSFactory} address on current chain.
     * @param messageType internal ATS protocol identifier for crosschain messages. Must match {DEPLOY_MESSAGE_TYPE}.
     * @param localParams abi.encoded deploy parameters, containing:
     *        isConnector: flag indicating whether is request for deploy connector(true) or token(false)
     *        deployer: source chain {msg.sender} address
     *        deployParams: abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct
     * @return opResult the execution result code, represented as a uint8(ATSCoreDataTypes.OperationResult).
     * @dev Only {MASTER_ROUTER} can execute this function.
     */
    function execute(
        uint256 srcChainId,
        address factoryAddress, 
        bytes1 messageType,
        bytes calldata localParams
    ) external payable returns(uint8 opResult) {
        if (msg.sender != MASTER_ROUTER) revert ATSDeploymentRouter__E2();

        if (srcChainId == block.chainid) return uint8(OperationResult.InvalidSrcChainId);
        if (paused()) return uint8(OperationResult.RouterPaused); 
        if (messageType != DEPLOY_MESSAGE_TYPE) return uint8(OperationResult.InvalidMessageType); 
        if (!IATSRegistry(REGISTRY).validateFactory(factoryAddress)) return uint8(OperationResult.UnauthorizedRouter);
        if (IPausable(factoryAddress).paused()) return uint8(OperationResult.RouterPaused);

        ( 
            bool _isConnector, 
            bytes memory _deployer,
            bytes memory _deployParams
        ) = abi.decode(localParams, (bool, bytes, bytes));

        (bool _deployResult, bytes memory _deployResponse) = factoryAddress.call(
            abi.encodeCall(IATSFactory.deployByRouter, (_isConnector, _deployer, _deployParams))
        );

        if (_deployResult && _deployResponse.length > 0) {
            return uint8(OperationResult.Success);
        } else {
            return uint8(OperationResult.DeployFailed);
        }
    }

    /**
     * @notice Pauses the {sendDeployRequest} and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {sendDeployRequest} and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sets the destination chains settings.
     * @param dstChainIds destination chain Ids.
     * @param newConfigs {DstDeployConfig} structs array containing destination chains settings: 
     *        factory: destination {ATSFactory} address
     *        tokenDeployGas: the amount of gas required to deploy the {ATSToken} on the destination chain
     *        connectorDeployGas: the amount of gas required to deploy the {ATSConnector} on the destination chain
     *        protocolFee: protocol fee (basis points) for crosschain deployment on the destination chain
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setDstDeployConfig(
        uint256[] calldata dstChainIds,
        DstDeployConfig[] calldata newConfigs
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newConfigs.length) revert ATSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) {
            _setFactory(dstChainIds[i], newConfigs[i].factory);
            _setTokenDeployGas(dstChainIds[i], newConfigs[i].tokenDeployGas);
            _setConnectorDeployGas(dstChainIds[i], newConfigs[i].connectorDeployGas);
            _setProtocolFee(dstChainIds[i], newConfigs[i].protocolFee);
        }
    }

    /**
     * @notice Sets the amounts of gas required to deploy on the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newTokenDeployGas the amounts of gas required to deploy the {ATSToken} on the corresponding {dstChainId}.
     * @param newTokenDeployGas the amounts of gas required to deploy the {ATSConnector} on the corresponding {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstDeployGas(
        uint256[] calldata dstChainIds,
        uint64[] calldata newTokenDeployGas,
        uint64[] calldata newConnectorDeployGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newTokenDeployGas.length) revert ATSDeploymentRouter__E3();
        if (dstChainIds.length != newConnectorDeployGas.length) revert ATSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) {
            _setTokenDeployGas(dstChainIds[i], newTokenDeployGas[i]);
            _setConnectorDeployGas(dstChainIds[i], newConnectorDeployGas[i]);
        }
    }

    /**
     * @notice Sets the protocol fees for deploy on the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newProtocolFees protocol fees (basis points) for crosschain deployment on the corresponding {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstProtocolFee(
        uint256[] calldata dstChainIds, 
        uint16[] calldata newProtocolFees
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newProtocolFees.length) revert ATSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setProtocolFee(dstChainIds[i], newProtocolFees[i]);
    }

    /**
     * @notice Sets the destination {ATSFactory} addresses.
     * @param dstChainIds destination chain Ids.
     * @param newFactory {ATSFactory} addresses on the corresponding {dstChainId}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setDstFactory(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newFactory
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newFactory.length) revert ATSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setFactory(dstChainIds[i], newFactory[i]);
    }

    /**
     * @notice Estimates the total payment required for send crosschain deployment requests.
     * @param dstTokenChainIds destination chain Ids for {ATSToken} deployments.
     * @param dstConnectorChainIds destination chain Ids for {ATSConnector} deployments.
     * @return paymentTokenAmount returns 0.
     * IMPORTANT: Payments in non-native token were deprecated.
     * @return paymentNativeAmount estimated total payment amount in native currency.
     */
    function estimateDeployTotal(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(uint256 paymentTokenAmount, uint256 paymentNativeAmount) {
        for (uint256 i; dstTokenChainIds.length > i; ++i) {
            if (dstTokenChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstTokenChainIds[i]);

                paymentNativeAmount += 
                    IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(
                        dstTokenChainIds[i], 
                        config.tokenDeployGas
                    );
            }
        }

        for (uint256 i; dstConnectorChainIds.length > i; ++i) {
            if (dstConnectorChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstConnectorChainIds[i]);

                paymentNativeAmount += 
                    IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(
                        dstConnectorChainIds[i], 
                        config.connectorDeployGas
                    );
            }
        }
    }

    /**
     * @notice Estimates the separated payments required for send crosschain deployment requests in native currency.
     * @param dstTokenChainIds destination chain Ids for {ATSToken} deployments.
     * @param dstConnectorChainIds destination chain Ids for {ATSConnector} deployments.
     * @return tokenPaymentAmountNative array of estimated payment amount in native currency for each {dstChainId}.
     * @return connectorPaymentAmountNative array of estimated payment amount in native currency for each {dstChainId}.
     * @return totalPaymentAmountNative estimated total payment amount in native currency.
     */
    function estimateDeployNative(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(
        uint256[] memory tokenPaymentAmountNative, 
        uint256[] memory connectorPaymentAmountNative, 
        uint256 totalPaymentAmountNative
    ) {
        tokenPaymentAmountNative = new uint256[](dstTokenChainIds.length);
        connectorPaymentAmountNative = new uint256[](dstConnectorChainIds.length);

        for (uint256 i; dstTokenChainIds.length > i; ++i) {
            if (dstTokenChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstTokenChainIds[i]);

                uint256 _paymentAmount = 
                    IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(
                        dstTokenChainIds[i], 
                        config.tokenDeployGas
                    );

                tokenPaymentAmountNative[i] = _paymentAmount;
                totalPaymentAmountNative += _paymentAmount;
            } else {
                tokenPaymentAmountNative[i] = 0;
            }
        }

        for (uint256 i; dstConnectorChainIds.length > i; ++i) {
            if (dstConnectorChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstConnectorChainIds[i]);

                uint256 _paymentAmount = 
                    IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(
                        dstConnectorChainIds[i], 
                        config.connectorDeployGas
                    );

                connectorPaymentAmountNative[i] = _paymentAmount;
                totalPaymentAmountNative += _paymentAmount;
            } else {
                connectorPaymentAmountNative[i] = 0;
            }
        }
    }

    /**
     * @notice Returns the abi.encoded {DeployTokenData} struct as a parameter for the {sendDeployRequest} function.
     * @param deployData see the {ATSERC20DataTypes.DeployTokenData} for details.
     * @return abi.encoded {DeployTokenData} struct.
     */
    function getDeployTokenParams(DeployTokenData calldata deployData) external pure returns(bytes memory) {
        return abi.encode(deployData);
    }

    /**
     * @notice Returns the abi.encoded {DeployConnectorData} struct as a parameter for the {sendDeployRequest} function.
     * @param deployData see the {ATSERC20DataTypes.DeployConnectorData} for details.
     * @return abi.encoded {DeployConnectorData} struct.
     */
    function getDeployConnectorParams(DeployConnectorData calldata deployData) external pure returns(bytes memory) {
        return abi.encode(deployData);
    }

    /**
     * @notice Returns the ATSDeploymentRouter protocol version.
     * @return version ATS protocol version.
     */
    function protocolVersion() public pure returns(bytes2 version) {
        return 0xf000;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IATSDeploymentRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns destination chain settings.
     * @param dstChainId destination chain Id.
     * @return deployConfig {DstDeployConfig} struct.
     * @dev See the {ATSERC20DataTypes.DstDeployConfig} for details.
     */
    function dstDeployConfig(uint256 dstChainId) public view returns(DstDeployConfig memory deployConfig) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId];
    }

    /**
     * @notice Returns the amount of gas required to deploy the {ATSToken}.
     * @param dstChainId destination chain Id.
     * @return dstTokenDeployGasAmount the amount of gas required to deploy the {ATSToken} on the provided {dstChainId}.
     */
    function dstTokenDeployGas(uint256 dstChainId) external view returns(uint64 dstTokenDeployGasAmount) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    /**
     * @notice Returns the amount of gas required to deploy the {ATSConnector}.
     * @param dstChainId destination chain Id.
     * @return dstConnectorDeployGasAmount the amount of gas required to deploy the {ATSConnector} on the provided {dstChainId}.
     */
    function dstConnectorDeployGas(uint256 dstChainId) external view returns(uint64 dstConnectorDeployGasAmount) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    /**
     * @notice Returns the protocol fee for deploy on the destination chains.
     * @param dstChainId destination chain Id.
     * @return dstProtocolFeePoints protocol fees (basis points) for crosschain deployment on the provided {dstChainId}.
     */
    function dstProtocolFee(uint256 dstChainId) external view returns(uint16 dstProtocolFeePoints) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].protocolFee;
    }

    /**
     * @notice Returns the destination {ATSFactory} contract address.
     * @param dstChainId destination chain Id.
     * @return dstFactoryAddress {ATSFactory} address on the provided {dstChainId}.
     */
    function dstFactory(uint256 dstChainId) external view returns(bytes memory dstFactoryAddress) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].factory;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _setTokenDeployGas(uint256 dstChainId, uint64 newTokenDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].tokenDeployGas = newTokenDeployGas;

        emit ConfigTokenDeployGasSet(dstChainId, newTokenDeployGas, msg.sender);
    }

    function _setConnectorDeployGas(uint256 dstChainId, uint64 newConnectorDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].connectorDeployGas = newConnectorDeployGas;

        emit ConfigConnectorDeployGasSet(dstChainId, newConnectorDeployGas, msg.sender);
    }

    function _setProtocolFee(uint256 dstChainId, uint16 newProtocolFee) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].protocolFee = newProtocolFee;

        emit ConfigProtocolFeeSet(dstChainId, newProtocolFee, msg.sender);
    }

    function _setFactory(uint256 dstChainId, bytes memory newFactory) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].factory = newFactory;

        emit ConfigFactorySet(dstChainId, newFactory, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}