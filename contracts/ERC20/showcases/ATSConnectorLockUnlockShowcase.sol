// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../ATSBase.sol";

/**
 * @notice A showcase contract that provides functionality to use ATS protocol crosschain messaging for bridging
 * existing ERC20 token.
 * 
 * @dev An {ATSConnectorLockUnlockShowcase} contract stores and releases underlying ERC20 tokens and interacts with the ATS protocol.
 * A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * Lock/unlock mechanism means that this contract interacts with the token via {IERC20} interface and should not have special rights. 
 * Such a {ATSconnector} can be used with any existing ERC20 token.
 *
 * IMPORTANT: This is an example contract, that uses an unaudited code. Do not use this code in production before covering by tests.
 */
contract ATSConnectorLockUnlockShowcase is ATSBase, Ownable {
    using SafeERC20 for IERC20;

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
     * @notice Overridden function that transfer tokens from {spender} {msg.sender} address to this contract.
     * @param spender tokens holder on the current chain, must be {msg.sender} to prevent tokens stealing via third-party
     * allowances.
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
    ) internal override returns(uint256 bridgedAmount) {
        IERC20(_underlyingToken).safeTransferFrom(spender, address(this), amount);

        return amount;
    }

    /**
     * @notice Overridden function that transfer tokens from this contract to receiver {to} address.
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
    ) internal override returns(uint256 receivedAmount) {
        IERC20(_underlyingToken).safeTransfer(to, amount);

        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal override onlyOwner() {

    }

}