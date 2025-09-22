// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../ATSBase.sol";

/**
 * @notice A showcase ERC20 compliant token contract with integrated functionality to use ATS protocol crosschain 
 * messaging for bridging this token itself.  
 *
 * @dev A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * A mint/burn mechanism is used to send and receive {ATSTokenShowcase} ERC20 token crosschain bridges.
 *
 * IMPORTANT: This is an example contract, that uses an unaudited code. Do not use this code in production before covering by tests.
 */
contract ATSTokenShowcase is ATSBase, ERC20, Ownable {

    /**
     * @notice Initializes basic settings.
     * @param _router address of the authorized {ATSRouter} contract.
     * @param _allowedChainIds chains Ids available for bridging in both directions.
     * @param _chainConfigs {ChainConfig} settings for provided {_allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     *
     * @dev Since this contract is a token itself, its underlying token address will be {address(this)}.
     */
    constructor(
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs
    ) Ownable(msg.sender) ERC20("ATS Token Showcase", "ATSTS") {
        __ATSBase_init(address(this), decimals());

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);

        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Overridden function that burn tokens from tokens holder {from} address.
     * @param spender {bridge} transaction initiator {msg.sender}.
     * @param from tokens holder on the current chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @return bridgedAmount bridged tokens amount, that will be released on the destination chain.
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
     * @notice Overridden function that mint tokens to receiver {to} address.
     * @param to tokens receiver on the current chain.
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
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal override onlyOwner() {
        
    }

}