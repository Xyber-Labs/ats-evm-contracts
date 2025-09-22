// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ATSTokenWithFee.sol";
import "./ATSTokenMintable.sol";

/**
 * @notice Extends ATSTokenMintable to implement fee collecting for crosschain ERC20 token bridging.  
 */
contract ATSTokenMintableWithFee is ATSTokenMintable, ATSTokenWithFee {

    /**
     * @notice Overridden function that burn ERC20 underlying token {amount} from {from} address.
     * @param spender transaction sender.
     * @param from tokens holder on the current chain.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount ERC20 underlying token amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @param customPayload user's additional data.
     * @return bridgedAmount bridged ERC20 underlying token amount(after fee deducting), that will be released on 
     * the destination chain.
     * @dev The {bridgedAmount} differs from the initial {amount} as in this case the {bridgeFeeRate} fee is deducting.
     * Returned {bridgedAmount} value will be actually used for crosschain message.
     */
    function _burnFrom(
        address spender,
        address from,
        bytes memory to, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory customPayload
    ) internal override(ATSToken, ATSTokenWithFee) returns(uint256 bridgedAmount) {
        return super._burnFrom(
            spender,
            from,
            to, 
            amount, 
            dstChainId, 
            customPayload
        );
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter}, {setChainConfig}, 
     * {setFeeCollector}, and {setBridgeFeeRate} functions.
     */
    function _authorizeCall() internal override(ATSToken, ATSTokenWithFee) onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }
    
}