// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

import "../libraries/AddressConverter.sol";
import "../libraries/ATSERC20DataTypes.sol";
import "../libraries/ATSUpgradeChecker.sol";

import "./interfaces/IATSToken.sol";
import "./interfaces/IATSFactory.sol";
import "./interfaces/IATSConnector.sol";
import "./interfaces/IATSCodeStorage.sol";
import "../interfaces/IATSRegistry.sol";
import "../interfaces/IATSMasterRouter.sol";

/**
 * @notice A contract allows to deploy ATSToken and ATSConnector contracts with various settings.
 *
 * @dev It is an implementation of {ATSFactory} for UUPS.
 * The {ATSFactory} only deploys the specified bytecode, which stores in external code storage contracts.
 */
contract ATSFactory is IATSFactory, ATSUpgradeChecker, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using Create2 for *;

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for *;

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice placeholder address used as an identifier for {ATSConnectorNative} deployment.
    address public constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Address of the {ATSMasterRouter} contract.
    address public immutable MASTER_ROUTER;

    /// @notice Address of the {ATSRegistry} contract.
    address public immutable REGISTRY;

    /**
     * @notice Enum defines the types (blueprints) of deployments supported by the {ATSFactory}.
     * @dev Various {ATSToken} or {ATSConnector} blueprints containing:
     *      Standard: basic {ATSToken} using mint/burn mechanism or {ATSConnector} using lock/unlock mechanism for bridging ERC20 token
     *      MintableToken: free-mintable by owner {ATSToken} using mint/burn mechanism for bridging
     *      TokenWithFee: {ATSToken} using mint/burn mechanism for bridging and supporting fee deducting
     *      MintableTokenWithFee: free-mintable by owner {ATSToken} using mint/burn mechanism for bridging and supporting fee deducting
     *      PureToken: non-mintable {ATSToken} using lock/unlock mechanism for bridging
     *      ConnectorWithFee: {ATSConnector} using lock/unlock mechanism for bridging and supporting fee deducting
     *      ConnectorNative: {ATSConnector} using lock/unlock mechanism for bridging native currency
     */
    enum DeploymentType {
        Standard,
        MintableToken,
        TokenWithFee,
        MintableTokenWithFee,
        PureToken,
        ConnectorWithFee,
        ConnectorNative
    }

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSFactory.Main
    struct Main {
        address _router;
        mapping(uint8 blueprintId => address codeStorageAddress) _codeStorage;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSFactory.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x1c9a212e3a4acf218e4b8b1fecccca2770c37faa0285f97b9c0e71d44b314e00;
    
    /// @notice Indicates an error that the function caller is not the {_router}.
    error ATSFactory__E0();
    
    /// @notice Indicates an error that the precalculated {deployment} address has a deployed bytecode.
    error ATSFactory__E1();
    
    /// @notice Indicates an error that the provided {DeployTokenData} contains unsupported {ATSToken} configuration to deploy.
    error ATSFactory__E2();
    
    /// @notice Indicates an error that lengths of provided arrays do not match.
    error ATSFactory__E3();
    
    /// @notice Indicates an error that the provided {DeployTokenData.mintedAmountToOwner} exceeds the {DeployTokenData.initialSupply}.
    error ATSFactory__E4();

    /**
     * @notice Emitted when the {_router} address is updated.
     * @param newRouter new {_router} address.
     * @param caller the caller address who set the new {_router} address.
     */
    event DeploymentRouterSet(address newRouter, address indexed caller);

    /**
     * @notice Emitted when the {_codeStorage} address for corresponding {blueprintId} is updated.
     * @param blueprintId {DeploymentType} blueprint Id.
     * @param newCodeStorage new {_codeStorage} address.
     * @param caller the caller address who set the new {_codeStorage} address.
     * @dev See the {DeploymentType} for details.
     */
    event CodeStorageSet(uint8 indexed blueprintId, address newCodeStorage, address indexed caller);

    /**
     * @notice Emitted when a new {ATSToken} or {ATSConnector} is deployed.
     * @param deployment newly {ATSToken} or {ATSConnector} deployed contract address.
     * @param deployerIndexed indexed source chain {msg.sender} address.
     * @param deployer source chain {msg.sender} address.
     * @param owner initial owner of deployed contract.
     * @param underlyingToken underlying ERC20 token address or {NATIVE_ADDRESS} as native currency.
     * @param salt value used for precalculation of new deployment contract address.
     * @param name the name of the {ATSToken} token (in the case of token deployment).
     * @param symbol the symbol of the {ATSToken} token (in the case of token deployment).
     * @param decimals the decimals of the {ATSToken} token (in the case of token deployment).
     */
    event Deployed(
        address deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer,
        address indexed owner, 
        address indexed underlyingToken,
        bytes32 salt,
        string name, 
        string symbol,
        uint8 decimals
    );

    /**
     * @notice Initializes immutable variables.
     * @param masterRouter address of the {ATSMasterRouter} contract.
     * @param registry address of the {ATSRegistry} contract.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(address masterRouter, address registry) ATSUpgradeChecker(hex'03') {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        REGISTRY = registry;
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
     * @notice Deploys a new {ATSToken} using the provided deployment parameters.
     * @param deployData the {DeployTokenData} struct containing deployment parameters.
     * @dev See the {ATSERC20DataTypes.DeployTokenData} for details.
     *
     * @return success call result.
     * @return newToken a newly deployed {ATSToken} contract address.
     */
    function deployToken(DeployTokenData calldata deployData) external returns(bool success, address newToken) {

        return _deployToken(deployData, msg.sender.toBytes());
    }

    /**
     * @notice Deploys a new {ATSConnector} using the provided deployment parameters.
     * @param deployData the {DeployConnectorData} struct containing deployment parameters.
     * @dev See the {ATSERC20DataTypes.DeployConnectorData} for details.
     *
     * @return success call result.
     * @return newConnector a newly deployed {ATSConnector} contract address.
     */
    function deployConnector(DeployConnectorData calldata deployData) external returns(bool success, address newConnector) {

        return _deployConnector(deployData, msg.sender.toBytes());
    }

    /**
     * @notice Deploys a new {ATSToken} or {ATSConnector} by crosschain deploy message.
     * @param isConnector flag indicating whether is connector(true) or token(false) deployment.
     * @param deployer source chain {msg.sender} address.
     * @param deployParams abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct.
     * @dev See the {ATSERC20DataTypes.DeployTokenData} and {ATSERC20DataTypes.DeployConnectorData} for details.
     *
     * @return success call result.
     * @return newDeployment a newly deployed {ATSToken} or {ATSConnector} contract address.
     * 
     * @dev Only authorized {ATSDeploymentRouter} can execute this function.
     */
    function deployByRouter(
        bool isConnector, 
        bytes calldata deployer,
        bytes calldata deployParams
    ) external returns(bool success, address newDeployment) {
        if (!IATSMasterRouter(MASTER_ROUTER).validateRouter(msg.sender)) revert ATSFactory__E0();

        if (isConnector) {
            return _deployConnector(abi.decode(deployParams, (DeployConnectorData)), deployer);
        } else {
            return _deployToken(abi.decode(deployParams, (DeployTokenData)), deployer);
        }
    }

    /**
     * @notice Pauses the {deployToken}, {deployConnector}, and {deployByRouter} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {deployToken}, {deployConnector}, and {deployByRouter} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sets the {_router} address.
     * @param newRouter new {_router} address of the {ATSDeploymentRouter} contract.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setRouter(address newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRouter(newRouter);
    } 

    /**
     * @notice Sets the code storage addresses for corresponding blueprint Ids.
     * @param blueprintIds array of {DeploymentType} blueprints.
     * @param newCodeStorage array of {_codeStorage} addresses for corresponding {blueprintIds}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setCodeStorage(
        uint8[] calldata blueprintIds, 
        address[] calldata newCodeStorage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (blueprintIds.length != newCodeStorage.length) revert ATSFactory__E3();
        for (uint256 i; blueprintIds.length > i; ++i) _setCodeStorage(blueprintIds[i], newCodeStorage[i]);
    }

    /**
     * @notice Returns the ATSFactory protocol version.
     * @return version ATS protocol version.
     */
    function protocolVersion() public pure returns(bytes2 version) {
        return 0xf000;
    }

    /**
     * @notice Precalculates the address of a {ATSToken} or {ATSConnector} contract.
     * @param blueprintId {DeploymentType} blueprint to be deployed.
     * @param deployer source chain {msg.sender} address.
     * @param salt value used for precalculation of deployment address.
     * @param isConnector flag indicating whether is connector(true) or token(false) deployment.
     * @return deployment precalculated {ATSToken} or {ATSConnector} contract address.
     * @return hasCode flag indicating whether the {deployment} address has a deployed bytecode.
     */
    function getPrecomputedAddress(
        uint8 blueprintId,
        bytes calldata deployer, 
        bytes32 salt, 
        bool isConnector
    ) external view returns(address deployment, bool hasCode) {
        bytes32 _salt = keccak256(abi.encode(deployer, salt));
        bytes32 _bytecodeHash = keccak256(IATSCodeStorage(codeStorage(blueprintId)).getCode(isConnector));

        deployment = _salt.computeAddress(_bytecodeHash);
        if (deployment.code.length > 0) hasCode = true;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IATSFactory).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the {ATSDeploymentRouter} address.
     * @return deploymentRouterAddress {ATSDeploymentRouter} {_router} address.
     */
    function router() external view returns(address deploymentRouterAddress) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    /**
     * @notice Returns the {_codeStorage} address for corresponding {DeploymentType} blueprint.
     * @param blueprintId {DeploymentType} blueprint.
     * @return codeStorageAddress {_codeStorage} address.
     */
    function codeStorage(uint8 blueprintId) public view returns(address codeStorageAddress) {
        Main storage $ = _getMainStorage();
        return $._codeStorage[blueprintId];
    }

    function _deployToken(
        DeployTokenData memory deployData, 
        bytes memory deployer
    ) internal returns(bool success, address newToken) {
        if (deployData.pureToken) {
            if (deployData.mintable || deployData.globalBurnable || deployData.onlyRoleBurnable || deployData.feeModule) {
                revert ATSFactory__E2();
            }

            if (deployData.mintedAmountToOwner > deployData.initialSupply) revert ATSFactory__E4();
        } else {
            if (deployData.mintedAmountToOwner != deployData.initialSupply) revert ATSFactory__E4();
        }

        DeploymentType _blueprintId = DeploymentType.Standard;

        if (deployData.mintable) _blueprintId = DeploymentType.MintableToken;
        if (deployData.feeModule) _blueprintId = DeploymentType.TokenWithFee;
        if (deployData.mintable && deployData.feeModule) _blueprintId = DeploymentType.MintableTokenWithFee;
        if (deployData.pureToken) _blueprintId = DeploymentType.PureToken;

        newToken = _deployAndRegister(
            uint8(_blueprintId),
            deployer,
            keccak256(abi.encode(deployer, deployData.salt)), 
            address(0)
        );

        IATSToken(newToken).initializeToken(deployData);

        emit Deployed(
            newToken, 
            deployer,
            deployer, 
            deployData.owner.toAddress(), 
            newToken,
            deployData.salt,
            deployData.name, 
            deployData.symbol,
            deployData.decimals
        );

        return (true, newToken);
    }

    function _deployConnector(
        DeployConnectorData memory deployData,
        bytes memory deployer
    ) internal returns(bool success, address newConnector) {
        address _underlyingToken = deployData.underlyingToken.toAddress();
        DeploymentType _blueprintId = DeploymentType.Standard;

        if (deployData.feeModule) _blueprintId = DeploymentType.ConnectorWithFee;
        if (_underlyingToken == NATIVE_ADDRESS) _blueprintId = DeploymentType.ConnectorNative;
        
        newConnector = _deployAndRegister(
            uint8(_blueprintId), 
            deployer,
            keccak256(abi.encode(deployer, deployData.salt)),
            _underlyingToken
        );

        IATSConnector(newConnector).initializeConnector(
            deployData.owner.toAddress(),
            _underlyingToken,
            deployData.router.toAddress(),  
            deployData.allowedChainIds,
            deployData.chainConfigs
        );

        emit Deployed(
            newConnector, 
            deployer, 
            deployer,
            deployData.owner.toAddress(), 
            _underlyingToken,
            deployData.salt,
            "", 
            "",
            0
        );

        return (true, newConnector);
    }

    function _deployAndRegister(
        uint8 blueprintId,
        bytes memory deployer, 
        bytes32 salt,  
        address underlyingToken
    ) internal whenNotPaused() returns(address deployment) {
        bytes memory _bytecode = IATSCodeStorage(codeStorage(blueprintId)).getCode(underlyingToken != address(0));

        deployment = salt.computeAddress(keccak256(_bytecode));
        
        if (deployment.code.length > 0) revert ATSFactory__E1();

        deployment = Create2.deploy(0, salt, _bytecode);

        IATSRegistry(REGISTRY).registerDeployment(
            deployment,
            deployer,
            underlyingToken == address(0) ? deployment : underlyingToken,
            protocolVersion()
        );
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _setRouter(address newRouter) internal {
        Main storage $ = _getMainStorage();
        $._router = newRouter;

        emit DeploymentRouterSet(newRouter, msg.sender);
    }

    function _setCodeStorage(uint8 blueprintId, address newCodeStorage) internal {
        Main storage $ = _getMainStorage();
        $._codeStorage[blueprintId] = newCodeStorage;

        emit CodeStorageSet(blueprintId, newCodeStorage, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }

}