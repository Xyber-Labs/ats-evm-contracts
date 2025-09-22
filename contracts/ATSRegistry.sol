// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./libraries/BytesLib.sol";
import "./libraries/ATSCoreDataTypes.sol";
import "./libraries/ATSUpgradeChecker.sol";

import "./interfaces/IATSRegistry.sol";

/**
 * @notice A contract stores the metadata of registered ATS compatible contracts.
 *
 * @dev It is an implementation of {ATSRegistry} for UUPS.
 */
contract ATSRegistry is IATSRegistry, ATSUpgradeChecker, AccessControlUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @dev Library for performing various operations on the {bytes} type. 
    using BytesLib for bytes;

    /// @notice {AccessControl} role identifier for approver addresses.
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    /// @notice {AccessControl} role identifier for ATS factory addresses.
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSRegistry.Main
    struct Main {
        EnumerableSet.AddressSet _deployments;
        EnumerableSet.AddressSet _underlyingTokens;
        mapping(uint256 index => address deploymentAddress) _deploymentByIndex;
        mapping(address deployment => DeploymentData) _deploymentData;
        mapping(address underlyingToken => EnumerableSet.AddressSet deploymentsAddresses) _deploymentsByUnderlying;
        mapping(bytes deployer => EnumerableSet.AddressSet deploymentsAddresses) _deploymentsByDeployer;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSRegistry.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xed4d23e30ca57170deda72b9aeafce0487c4708e4f9469d4ba16ec90cbbda300;

    /// @notice Indicates an error that the provided {deployer} address is empty.
    error ATSRegistry__E0();

    /// @notice Indicates an error that the function caller is not a registered deployment.
    error ATSRegistry__E1();

    /**
     * @notice Emitted when a new ATS compatible contract is registered.
     * @param deployment newly registered ATS compatible contract address.
     * @param deployerIndexed indexed deployer address.
     * @param deployer deployer address.
     * @param underlyingToken underlying token address.
     * @param protocolVersion ATS protocol version.
     */
    event Registered(
        address deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer,
        address indexed underlyingToken, 
        bytes2 indexed protocolVersion
    );

    /**
     * @notice Emitted when a metadata of registered ATS compatible contract is updated.
     * @param deployment registered ATS compatible contract address.
     * @param deployerIndexed indexed deployer address.
     * @param deployer deployer address.
     * @param underlyingToken underlying token address.
     * @param protocolVersion new ATS protocol version.
     */
    event DeploymentUpdated(
        address indexed deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer, 
        address underlyingToken, 
        bytes2 indexed protocolVersion
    );

    /**
     * @notice Emitted when {ChainConfig} settings of registered {ATSToken} or {ATSConnector} are updated.
     * @param deployment the registered {ATSToken} or {ATSConnector} contract address.
     * @param allowedChainIds new chains Ids available for bridging in both directions.
     * @param chainConfigs array of new {ChainConfig} settings for corresponding {allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     */
    event ChainConfigUpdated(
        address indexed deployment, 
        uint256[] allowedChainIds, 
        ChainConfig[] chainConfigs
    );

    /**
     * @notice Emitted when the {_router} address of registered ATS compatible contract is updated.
     * @param deployment the registered ATS compatible contract address.
     * @param newRouter new {_router} address.
     */
    event RouterUpdated(address indexed deployment, address indexed newRouter);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() ATSUpgradeChecker(hex'01') {
        _disableInitializers();
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     * @param defaultAdmin initial {DEFAULT_ADMIN_ROLE} address.
     */
    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Registers a new ATS compatible contract with provided metadata.
     * @param deployment ATS compatible contract address.
     * @param deployer deployer address.
     * @param underlyingToken underlying token address.
     * @param protocolVersion ATS protocol version.
     * @dev Only addresses with the {FACTORY_ROLE} can execute this function.
     */
    function registerDeployment(
        address deployment, 
        bytes calldata deployer, 
        address underlyingToken,
        bytes2 protocolVersion
    ) external onlyRole(FACTORY_ROLE) {
        _addDeployment(deployment, deployer, underlyingToken, protocolVersion);
    }

    /**
     * @notice Manually registers a new ATS compatible contracts with provided metadata.
     * @param requests array of {ApproveRequestData} ATS compatible contracts metadata, containing:
     *        deployment: ATS compatible contract address
     *        deployer: deployer address
     *        underlyingToken: underlying token contract address or {ATSFactory.NATIVE_ADDRESS} as native currency
     *        protocolVersion: ATS protocol version
     * @dev See the {ATSCoreDataTypes.ApproveRequestData} for details.
     * @dev Only addresses with the {APPROVER_ROLE} can execute this function.
     */
    function approveRequestBatch(ApproveRequestData[] calldata requests) external onlyRole(APPROVER_ROLE) returns(bool) {
        for (uint256 i; requests.length > i; ++i) {
            _addDeployment(
                requests[i].deployment,
                requests[i].deployer,
                requests[i].underlyingToken,
                requests[i].protocolVersion
            );
        }

        return true;
    }

    /**
     * @notice Emits the event when {ChainConfig} settings of registered {ATSToken} or {ATSConnector} are updated.
     * @param allowedChainIds new chains Ids available for bridging in both directions.
     * @param chainConfigs array of new {ChainConfig} settings for corresponding {allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     * @dev Only registered ATS compatible contracts can execute this function.
     */
    function updateChainConfigs(uint256[] calldata allowedChainIds, ChainConfig[] calldata chainConfigs) external {
        if (deploymentData(msg.sender).deployer.length == 0) revert ATSRegistry__E1();

        emit ChainConfigUpdated(msg.sender, allowedChainIds, chainConfigs);
    }

    /**
     * @notice Emits the event when the {_router} address of registered ATS compatible contract is updated.
     * @param newRouter new {_router} address.
     * @dev Only registered ATS compatible contracts can execute this function.
     */
    function updateRouter(address newRouter) external {
        if (deploymentData(msg.sender).deployer.length == 0) revert ATSRegistry__E1();

        emit RouterUpdated(msg.sender, newRouter);
    }

    /**
     * @notice Returns whether any registered ATS compatible contract uses the provided {underlyingToken} contract.
     * @param underlyingToken {underlyingToken} contract address.
     * @return isRegistered result.
     */
    function validateUnderlyingRegistered(address underlyingToken) external view returns(bool isRegistered) {
        Main storage $ = _getMainStorage();
        return $._underlyingTokens.contains(underlyingToken);
    }

    /**
     * @notice Returns whether the provided {deployment} contract is registered ATS compatible contract.
     * @param deployment target contract address.
     * @return isRegistered result.
     */
    function validateDeploymentRegistered(address deployment) external view returns(bool isRegistered) {
        return deploymentData(deployment).deployer.length != 0;
    }

    /**
     * @notice Returns whether provided {target} address has the {AccessControl.FACTORY_ROLE}.
     * @param target target contract address.
     * @return isAuthorized result.
     */
    function validateFactory(address target) external view returns(bool isAuthorized) {
        return hasRole(FACTORY_ROLE, target);
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IATSRegistry).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns a metadata of provided registered ATS compatible contract address.
     * @param deployment registered ATS compatible contract address.
     * @return deploymentMetadata metadata {DeploymentData} of provided registered ATS compatible contract address.
     * @dev See the {ATSCoreDataTypes.DeploymentData} for details.
     */
    function deploymentData(address deployment) public view returns(DeploymentData memory deploymentMetadata) {
        Main storage $ = _getMainStorage();
        return $._deploymentData[deployment];
    }

    /**
     * @notice Returns the total number of registered ATS compatible contracts.
     * @return totalDeploymentsAmount total number of registered ATS compatible contracts.
     */
    function totalDeployments() external view returns(uint256 totalDeploymentsAmount) {
        Main storage $ = _getMainStorage();
        return $._deployments.length();
    }

    /**
     * @notice Returns all underlying tokens that used by ATS compatible contracts.
     * @return tokenAddresses array of addresses of all {underlyingToken} that used by ATS compatible contracts.
     */
    function underlyingTokens() external view returns(address[] memory tokenAddresses) {
        Main storage $ = _getMainStorage();
        return $._underlyingTokens.values();
    }

    /**
     * @notice Returns all registered ATS compatible contracts.
     * @return deploymentsAddresses array of addresses of all registered ATS compatible contracts.
     */
    function deployments() external view returns(address[] memory deploymentsAddresses) {
        Main storage $ = _getMainStorage();
        return $._deployments.values();
    }

    /**
     * @notice Returns registered ATS compatible contracts addresses for provided indexes.
     * @return deploymentsAddresses array of addresses of registered ATS compatible contracts for provided {indexes}.
     */
    function deploymentsByIndex(uint256[] calldata indexes) external view returns(address[] memory deploymentsAddresses) {
        Main storage $ = _getMainStorage();
        deploymentsAddresses = new address[](indexes.length);
        for (uint256 i; indexes.length > i; ++i) deploymentsAddresses[i] = $._deploymentByIndex[indexes[i]];
    }

    /**
     * @notice Returns registered ATS compatible contracts that uses provided underlying token contract.
     * @return deploymentsAddresses array of addresses of registered ATS compatible contracts that uses provided {underlyingToken} contract.
     */
    function deploymentsByUnderlying(address underlyingToken) external view returns(address[] memory deploymentsAddresses) {
        Main storage $ = _getMainStorage();
        return $._deploymentsByUnderlying[underlyingToken].values();
    }

    /**
     * @notice Returns registered ATS compatible contracts that deployed by provided deployer.
     * @return deploymentsAddresses array of addresses of registered ATS compatible contracts that deployed by provided {deployer} address.
     */
    function deploymentsByDeployer(bytes calldata deployer) external view returns(address[] memory deploymentsAddresses) {
        Main storage $ = _getMainStorage();
        return $._deploymentsByDeployer[deployer].values();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _addDeployment(
        address deployment, 
        bytes calldata deployer, 
        address underlyingToken, 
        bytes2 protocolVersion
    ) internal {
        if (deployer.length == 0) revert ATSRegistry__E0();
        Main storage $ = _getMainStorage();

        if ($._deploymentData[deployment].deployer.length == 0) {
            $._deploymentData[deployment].underlyingToken = underlyingToken;
            
            $._underlyingTokens.add(underlyingToken);
            $._deploymentsByUnderlying[underlyingToken].add(deployment);

            $._deploymentByIndex[$._deployments.length()] = deployment;
            $._deployments.add(deployment);

            emit Registered(deployment, deployer, deployer, underlyingToken, protocolVersion);
        } else {

            if (!$._deploymentData[deployment].deployer.equalStorage(deployer)) {
                $._deploymentsByDeployer[$._deploymentData[deployment].deployer].remove(deployment);
            }

            emit DeploymentUpdated(
                deployment, 
                deployer, 
                deployer,
                $._deploymentData[deployment].underlyingToken, 
                protocolVersion
            );
        }

        $._deploymentsByDeployer[deployer].add(deployment);
        $._deploymentData[deployment].deployer = deployer;
        $._deploymentData[deployment].initProtocolVersion = protocolVersion;
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}