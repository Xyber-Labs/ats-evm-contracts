// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "./ERC20Token.sol";

import "../libraries/ATSUpgradeChecker.sol";

import "./interfaces/ISingletonFactory.sol";

contract SingletonFactory is ISingletonFactory, ATSUpgradeChecker, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address public immutable SINGLETON_ROUTER;

    error SingletonFactory__E0();

    event Deployed(bytes32 indexed tokenId, address indexed newToken, string name, string symbol);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address singletonRouter) ATSUpgradeChecker(hex'06') {
        _disableInitializers();

        SINGLETON_ROUTER = singletonRouter;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function deploy(
        bytes32 tokenId,
        string calldata name,
        string calldata symbol,
        uint256 totalSupply
    ) external returns(address newToken) {
        if (msg.sender != SINGLETON_ROUTER) revert SingletonFactory__E0();

        newToken = address(new ERC20Token(SINGLETON_ROUTER, name, symbol, totalSupply));

        emit Deployed(tokenId, newToken, name, symbol);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(ISingletonFactory).interfaceId || super.supportsInterface(interfaceId);
    }

    function paused() public view override(ISingletonFactory, PausableUpgradeable) returns(bool) {
        return PausableUpgradeable.paused();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

}