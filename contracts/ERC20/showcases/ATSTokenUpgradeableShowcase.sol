// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../extensions/ATSBaseExtendedUpgradeable.sol";

/**
 * @notice A showcase ERC20 compliant token contract implementation for UUPS with integrated functionality to use ATS protocol
 * crosschain messaging for bridging this token itself.  
 *
 * @dev A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * A mint/burn mechanism is used to send and receive {ATSTokenUpgradeableShowcase} ERC20 token crosschain bridges.
 *
 * IMPORTANT: This is an example contract, that uses an unaudited code. Do not use this code in production before covering by tests.
 */
contract ATSTokenUpgradeableShowcase is ATSBaseExtendedUpgradeable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    
    /// @custom:oz-upgrades-unsafe-allow constructor 
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param owner the address of the initial {OwnableUpgradeable.owner}.
     * @param name the {ERC20.name} of the {ATSTokenUpgradeableShowcase} token.
     * @param symbol the {ERC20.symbol} of the {ATSTokenUpgradeableShowcase} token.
     * @param initialSupply initial {ATSTokenUpgradeableShowcase} token supply to mint.
     * @param newAllowedChainIds chains Ids available for bridging in both directions.
     * @param newChainConfigs {ChainConfig} settings for provided {newAllowedChainIds}.
     * @param newRouter the address of the authorized {ATSRouter}.
     */
    function initialize(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        uint256[] calldata newAllowedChainIds,
        ChainConfig[] calldata newChainConfigs,
        address newRouter
    ) external initializer() {
        __ERC165_init();
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        __ERC20_init(name, symbol);
        __ATSBase_init(address(this), decimals());
        
        _setRouter(newRouter);
        _setChainConfig(newAllowedChainIds, newChainConfigs);

        _mint(owner, initialSupply);
    }

    /**
     * @notice Overridden function that burn ERC20 underlying token {amount} from {from} address.
     * @param spender transaction sender, must be {msg.sender}.
     * @param from tokens holder on the current chain.
     * @param amount ERC20 underlying token amount to bridge to the destination chain.
     * @return bridgedAmount bridged ERC20 underlying token amount, that will be released on the destination chain.
     * @dev {bridgedAmount} value may be different from {amount}, in case amount modifies by fee collecting or any 
     * other custom logic. Returned {bridgedAmount} value will be actually used for crosschain message.
     *
     * @dev To ensure that the {spender} is not using someone else's tokens to bridge to itself, an {ERC20.allowance} 
     * check MUST be added.
     */
    function _burnFrom(
        address spender,
        address from,
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override returns(uint256 bridgedAmount) {
        if (from != spender) _spendAllowance(from, spender, amount);

        _update(from, address(0), amount);

        return amount;
    }

    /**
     * @notice Overridden function that mint ERC20 underlying token {amount} to receiver {to} address.
     * @param to {_underlyingToken} receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @return receivedAmount amount that {to} address received.
     * @dev {receivedAmount} value may be different from {amount}, in case amount modifies by fee collecting or any 
     * other custom logic.
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256 receivedAmount) {
        _update(address(0), to, amount);

        return amount;
    }

    /**
     * @notice The function is overridden to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal override onlyOwner() {
        
    }

    /**
     * @notice The function is overridden to include access restriction to the {UUPSUpgradeable.upgradeToAndCall} function.
     */
    function _authorizeUpgrade(address /* newImplementation */) internal override onlyOwner() {

    }

}