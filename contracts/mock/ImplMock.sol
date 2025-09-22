// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../libraries/ATSCoreDataTypes.sol";
import "../libraries/ATSERC20DataTypes.sol";

contract RouterImplMock is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64) _dstMinGasLimit;
        mapping(uint256 chainId => uint16) _dstProtocolFee;
        mapping(uint256 chainId => uint64) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xedc98a2881838e40a1872dba8b254f08f263ac4d9e6727950729f5aaa76eef00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xf000;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract RouterImplMockTwo is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64) _dstMinGasLimit;
        mapping(uint256 chainId => uint16) _dstProtocolFee;
        mapping(uint256 chainId => uint64) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xedc98a2881838e40a1872dba8b254f08f263ac4d9e6727950729f5aaa76eef00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract RouterImplMockThree is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64) _dstMinGasLimit;
        mapping(uint256 chainId => uint16) _dstProtocolFee;
        mapping(uint256 chainId => uint64) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xedc98a2881838e40a1872dba8b254f08f263ac4d9e6727950729f5aaa76eef00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract FactoryImplMock is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSFactory.Main
    struct Main {
        address _router;
        mapping(uint256 blueprintId => address) _codeStorage;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSFactory.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x1c9a212e3a4acf218e4b8b1fecccca2770c37faa0285f97b9c0e71d44b314e00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function router() public view returns(address) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xf000;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract FactoryImplMockTwo is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSFactory.Main
    struct Main {
        address _router;
        mapping(uint256 blueprintId => address) _codeStorage;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSFactory.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x1c9a212e3a4acf218e4b8b1fecccca2770c37faa0285f97b9c0e71d44b314e00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function router() public view returns(address) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xf000;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract FactoryImplMockThree is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSFactory.Main
    struct Main {
        address _router;
        mapping(uint256 blueprintId => address) _codeStorage;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSFactory.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x1c9a212e3a4acf218e4b8b1fecccca2770c37faa0285f97b9c0e71d44b314e00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function router() public view returns(address) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0x0102;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract RegistryImplMock is UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSRegistry.Main
    struct Main {
        /// @dev registered deployments
        EnumerableSet.AddressSet _deployments;
        EnumerableSet.AddressSet _underlyingTokens;
        mapping(uint256 index => address) _deploymentByIndex;
        mapping(address deployment => DeploymentData) _deploymentData;
        mapping(address underlyingToken => EnumerableSet.AddressSet) _deploymentsByUnderlying;
        mapping(address deployer => EnumerableSet.AddressSet) _deploymentsByDeployer;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSRegistry.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xed4d23e30ca57170deda72b9aeafce0487c4708e4f9469d4ba16ec90cbbda300;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function totalDeployments() public view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._deployments.length();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract RegistryImplMockTwo is UUPSUpgradeable {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

}

contract MasterRouterImplMock is UUPSUpgradeable {

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSMasterRouter.Main
    struct Main {
        mapping(uint256 chainId => bytes) _dstMasterRouter;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSMasterRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3abf3d58cc9e55ebb44c67e01e6f624d157bd395fd4eda846af5988472e5d800;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract MasterRouterImplMockTwo is UUPSUpgradeable {

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSMasterRouter.Main
    struct Main {
        mapping(uint256 chainId => bytes) _dstMasterRouter;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSMasterRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3abf3d58cc9e55ebb44c67e01e6f624d157bd395fd4eda846af5988472e5d800;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract DeploymentRouterImplMock is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xdb75208cb2e427053595417046d97ee9f6d1661578363544323ea98f9f1b6600;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xf000;
    }

    function dstTokenDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    function dstConnectorDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    function dstProtocolFee(uint256 dstchainId) public view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstchainId].protocolFee;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract DeploymentRouterImplMockTwo is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xdb75208cb2e427053595417046d97ee9f6d1661578363544323ea98f9f1b6600;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xf000;
    }

    function dstTokenDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    function dstConnectorDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    function dstProtocolFee(uint256 dstchainId) public view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstchainId].protocolFee;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract DeploymentRouterImplMockThree is UUPSUpgradeable {

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xdb75208cb2e427053595417046d97ee9f6d1661578363544323ea98f9f1b6600;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0x0102;
    }

    function dstTokenDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    function dstConnectorDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    function dstProtocolFee(uint256 dstchainId) public view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstchainId].protocolFee;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}