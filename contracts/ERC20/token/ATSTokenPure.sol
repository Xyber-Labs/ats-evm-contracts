// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ERC20Modified.sol";
import "../extensions/ATSBaseIndexed.sol";

/**
 * @notice An ERC20 compliant token contract with integrated functionality to use ATS protocol crosschain messaging
 * for bridging this token itself.    
 *
 * @dev A lock/unlock mechanism is used to send and receive {ATSTokenPure} tokens crosschain bridges. 
 * A ATSTokenPure contract stores and releases {ATSTokenPure} tokens itself.
 * This token has a fixed total supply, {ATSTokenPure} tokens cannot be minted or burned once the contract is initialized.
 */
contract ATSTokenPure is ATSBaseIndexed, ERC20Modified, AccessControl {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for bytes;

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param params {DeployTokenData} struct containing {ATSTokenPure} initialization parameters: 
     *        owner: the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}
     *        name: the {ERC20.name} of the {ATSTokenPure} token
     *        symbol: the {ERC20.symbol} of the {ATSTokenPure} token
     *        decimals: the {ERC20.decimals} of the {ATSTokenPure} token
     *        initialSupply: total initial {ATSTokenPure} supply to mint
     *        mintedAmountToOwner: initial {ATSTokenPure} supply to mint to {owner} balance
     *        pureToken: flag indicating whether the {ATSToken} is use lock/unlock or mint/burn mechanism for bridging
     *        mintable: flag indicating whether {owner} can mint an unlimited amount of {ATSTokenPure} tokens
     *        globalBurnable: flag indicating whether the {ATSTokenPure} is globally burnable by anyone
     *        onlyRoleBurnable: flag indicating whether only addresses with the {AccessControl.BURNER_ROLE} can burn tokens
     *        feeModule: flag indicating whether the {ATSTokenPure} is supports the fee deducting for bridging
     *        router: the address of the authorized {ATSRouter}
     *        allowedChainIds: chains Ids available for bridging in both directions
     *        chainConfigs: {ChainConfig} settings for provided {allowedChainIds}
     *        salt: value used for precalculation of {ATSTokenPure} contract address
     *
     * @dev {pureToken}, {mintable}, {globalBurnable}, {onlyRoleBurnable}, {feeModule}, and {salt} parameters DO NOT 
     * impact on the executable code here and {ATSTokenPure} settings in this function. 
     * It defines the creation bytecode before deployment and initialization.
     *
     * The difference in the amount between the {initialSupply} and the {mintedAmountToOwner} is minted to the 
     * balance of the {ATSTokenPure} contract itself, to provide liquidity for receiving bridges from other chains.
     *
     * Can and MUST be called only once. Reinitialization is prevented by {ATSBase.__ATSBase_init} function.
     */
    function initializeToken(DeployTokenData calldata params) external { 
        __ERC20_init(params.name, params.symbol);
        __ATSBase_init(address(this), params.decimals);

        _setRouter(params.router.toAddress());
        _setChainConfig(params.allowedChainIds, params.chainConfigs);

        if (params.initialSupply > 0) {
            _update(address(0), params.owner.toAddress(), params.mintedAmountToOwner);
            _update(address(0), address(this), params.initialSupply - params.mintedAmountToOwner);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, params.owner.toAddress());
    }

    /**
     * @notice Returns decimals value of the {ATSTokenPure}.
     * @return {_decimals} of the {ATSTokenPure}.
     */
    function decimals() public view override returns(uint8) {
        return _decimals;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ATSBase, AccessControl) returns(bool) {
        return interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Overridden function that transfer ERC20 underlying token {amount} from {from} address to {address(this)}.
     * @param spender transaction sender, must be {msg.sender}.
     * @param from tokens holder on the current chain.
     * @param amount ERC20 underlying token amount to bridge to the destination chain.
     * @return bridgedAmount bridged ERC20 underlying token amount, that will be released on the destination chain.
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

        _transfer(from, address(this), amount);

        return amount;
    }

    /**
     * @notice Overridden function that transfer ERC20 underlying token {amount} to receiver {to} address.
     * @param to {_underlyingToken} receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @return receivedAmount amount that {to} address received.
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256 receivedAmount) {
        if (to != address(this)) _transfer(address(this), to, amount);
        
        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

}