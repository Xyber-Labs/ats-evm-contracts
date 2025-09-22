// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ATSToken.sol";
import "../extensions/ATSFeeModule.sol";

/**
 * @notice Extends ATSToken to implement fee collecting for crosschain ERC20 token bridging.  
 */
contract ATSTokenWithFee is ATSToken, ATSFeeModule {

    /**
     * @notice Initiates the tokens bridging with a check the fee rate has not updated to prevent unexpected deducting.
     * @param from tokens holder on the current chain.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param expectedFeeRate expected {bridgeFeeRate}.
     * @param customPayload user's additional data.
     * @param protocolPayload ATS protocol's additional data.
     * @return success call result.
     * @return afterFeeBridgedAmount bridged tokens amount after deducting fee.
     */
    function bridgeWithSlippageCheck(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 dstGasLimit,
        uint16 expectedFeeRate,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success, uint256 afterFeeBridgedAmount) {
        if (expectedFeeRate != bridgeFeeRate[dstChainId]) revert ATSFeeModule__E1();

        return _bridge(msg.sender, from, to, amount, dstChainId, dstGasLimit, customPayload, protocolPayload);
    }

    /**
     * @notice Overridden function that burn ERC20 underlying token {amount} from {from} address.
     * @param spender transaction sender.
     * @param from tokens holder on the current chain.
     * @param amount ERC20 underlying token amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @return afterFeeAmount bridged ERC20 underlying token amount(after fee deducting), that will be released on 
     * the destination chain.
     * @dev The {afterFeeAmount} differs from the initial {amount} as in this case the {bridgeFeeRate} fee is deducting.
     * Returned {afterFeeAmount} value will be actually used for crosschain message.
     */
    function _burnFrom(
        address spender,
        address from,
        bytes memory /* to */, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory /* customPayload */
    ) internal virtual override returns(uint256 afterFeeAmount) {
        if (from != spender) _spendAllowance(from, spender, amount);

        uint256 _feeAmount = amount * bridgeFeeRate[dstChainId] / BPS;

        if (_feeAmount > 0) ERC20Modified._update(from, feeCollector, _feeAmount);

        ERC20Modified._update(from, address(0), amount - _feeAmount);

        return amount - _feeAmount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter}, {setChainConfig}, 
     * {setFeeCollector}, and {setBridgeFeeRate} functions.
     */
    function _authorizeCall() internal virtual override(ATSToken, ATSFeeModule) onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

}