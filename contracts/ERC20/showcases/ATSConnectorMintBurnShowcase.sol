// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../ATSBase.sol";

/**
 * @dev An example of an underlying token contract interface via which a {ATSConnectorMintBurnShowcase} contract can
 * interact it to mint and burn tokens at the {bridge} and {redeem} calls. Any required interface can be used in this case.
 */
interface IERC20Extended {
    
    function mint(address to, uint256 amount) external;

    function burnFrom(address from, uint256 amount) external;

}

/**
 * @notice A showcase contract that provides functionality to use ATS protocol crosschain messaging for bridging
 * existing ERC20 token.
 * 
 * @dev An {ATSConnectorMintBurnShowcase} contract burns and mints underlying ERC20 tokens and interacts with the ATS protocol.
 * A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * Mint/burn mechanism means that this contract can interact with the token via custom interface containing various functions 
 * for token minting and burning. This contract must have access rights to mint and burn underlying ERC20 tokens.
 * This contract is suitable for the case an existing underlying ERC20 token has any functions for minting and burning.
 *
 * IMPORTANT: This is an example contract, that uses an unaudited code. Do not use this code in production before covering by tests.
 */
contract ATSConnectorMintBurnShowcase is ATSBase, Ownable, Pausable {

    /**
     * @notice Initializes basic settings.
     * @param underlyingToken_ underlying ERC20 token address.
     * @param _router address of the authorized {ATSRouter} contract.
     * @param _allowedChainIds chains Ids available for bridging in both directions.
     * @param _chainConfigs {ChainConfig} settings for provided {_allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     */
    constructor(
        address underlyingToken_,
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs
    ) Ownable(msg.sender) {
        __ATSBase_init(underlyingToken_, IERC20Metadata(underlyingToken_).decimals());

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);
    }

    /**
     * @notice Returns decimals value of the underlying ERC20 token.
     * @return {ERC20.decimals} of the {_underlyingToken}.
     */
    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    /**
     * @notice Pauses the {_burnFrom} and {_mintTo} functions.
     * @dev Only {owner} address can execute this function.
     */
    function pause() external onlyOwner() {
        _pause();
    }

    /**
     * @notice Unpauses the {_burnFrom} and {_mintTo} functions.
     * @dev Only {owner} address can execute this function.
     * An example of including an access restriction by {_authorizeCall} function.
     */
    function unpause() external {
        _authorizeCall();
        _unpause();
    }

    /**
     * @notice Overridden function that burn tokens from {spender} {msg.sender} address.
     * @param spender tokens holder on the current chain, must be {msg.sender} to prevent tokens stealing via third-party
     * allowances or direct burning.
     * @param amount tokens amount to bridge to the destination chain.
     * @return bridgedAmount bridged tokens amount, that will be released on the destination chain.
     * @dev {bridgedAmount} value may be different from {amount}, in case amount modifies by fee collecting or any other 
     * custom logic. Returned {bridgedAmount} value will be actually used for crosschain message.
     */
    function _burnFrom(
        address spender,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override whenNotPaused() returns(uint256 bridgedAmount) {
        IERC20Extended(_underlyingToken).burnFrom(spender, amount);

        return amount;
    }

    /**
     * @notice Overridden function that mint tokens to receiver {to} address.
     * @param to tokens receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @return receivedAmount amount that {to} address received.
     * @dev {receivedAmount} value may be different from {amount}, in case amount modifies by fee collecting or any other
     * custom logic.
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override whenNotPaused() returns(uint256 receivedAmount) {
        IERC20Extended(_underlyingToken).mint(to, amount);

        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal override onlyOwner() {

    }

}