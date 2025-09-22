// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ERC20Burnable.sol";
import "../extensions/ATSBaseIndexed.sol";

import "../interfaces/IATSToken.sol";

/**
 * @notice An ERC20 compliant token contract with integrated functionality to use ATS protocol crosschain messaging
 * for bridging this token itself.  
 *
 * @dev A mint/burn mechanism is used to send and receive ERC20 tokens crosschain bridges.
 */
contract ATSToken is IATSToken, ATSBaseIndexed, ERC20Burnable, AccessControl {
    
    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for bytes;

    /// @notice {AccessControl} role identifier for burner addresses.
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Flag indicating whether the {ATSToken} is globally burnable by anyone.
    bool public globalBurnable;

    /// @notice Flag indicating whether only addresses with the {BURNER_ROLE} can burn tokens.
    bool public onlyRoleBurnable;

    /// @notice Indicates an error that the function caller does not have the {AccessControl} role.
    error ATSToken__E0();
    
    /// @notice Indicates an error that the burning tokens is not enabled.
    error ATSToken__E1();

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param params {DeployTokenData} struct containing {ATSToken} initialization parameters:
     *        owner: the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}
     *        name: the {ERC20.name} of the {ATSToken} token
     *        symbol: the {ERC20.symbol} of the {ATSToken} token
     *        decimals: the {ERC20.decimals} of the {ATSToken} token
     *        initialSupply: total initial {ATSToken} supply to mint
     *        mintedAmountToOwner: initial {ATSToken} supply to mint to {owner} balance
     *        pureToken: flag indicating whether the {ATSToken} is use lock/unlock or mint/burn mechanism for bridging
     *        mintable: flag indicating whether {owner} can mint an unlimited amount of {ATSToken} tokens
     *        globalBurnable: flag indicating whether the {ATSToken} is globally burnable by anyone
     *        onlyRoleBurnable: flag indicating whether only addresses with the {AccessControl.BURNER_ROLE} can burn tokens
     *        feeModule: flag indicating whether the {ATSToken} is supports the fee deducting for bridging
     *        router: the address of the authorized {ATSRouter}
     *        allowedChainIds: chains Ids available for bridging in both directions
     *        chainConfigs: {ChainConfig} settings for provided {allowedChainIds}
     *        salt: value used for precalculation of {ATSToken} contract address
     *
     * @dev {mintedAmountToOwner}, {pureToken}, {mintable}, {feeModule}, and {salt} parameters DO NOT impact on
     * the executable code here and {ATSToken} settings in this function. 
     * It defines the creation bytecode before deployment and initialization.
     *
     * Can and MUST be called only once. Reinitialization is prevented by {ATSBase.__ATSBase_init} function.
     */
    function initializeToken(DeployTokenData calldata params) external { 
        __ERC20_init(params.name, params.symbol);
        __ATSBase_init(address(this), params.decimals);

        _setRouter(params.router.toAddress());
        _setChainConfig(params.allowedChainIds, params.chainConfigs);

        if (params.initialSupply > 0) super._update(address(0), params.owner.toAddress(), params.initialSupply);

        globalBurnable = params.onlyRoleBurnable ? true : params.globalBurnable;
        onlyRoleBurnable = params.onlyRoleBurnable;

        _grantRole(DEFAULT_ADMIN_ROLE, params.owner.toAddress());
    }

    /**
     * @notice Returns decimals value of the {ATSToken}.
     * @return {_decimals} of the {ATSToken}.
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
        return interfaceId == type(IATSToken).interfaceId || interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Overridden function that burn ERC20 underlying token {amount} from {from} address.
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
    ) internal virtual override returns(uint256 bridgedAmount) {
        if (from != spender) _spendAllowance(from, spender, amount);

        super._update(from, address(0), amount);

        return amount;
    }

    /**
     * @notice Overridden function that mint ERC20 underlying token {amount} to receiver {to} address.
     * @param to {_underlyingToken} receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @return receivedAmount amount that {to} address received.
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal virtual override returns(uint256 receivedAmount) {
        super._update(address(0), to, amount);

        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

    /**
     * @notice The function is overridden only to include token configuration restriction to the {burn} and {burnFrom} functions.
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        if (to == address(0)){
            if (!globalBurnable) revert ATSToken__E1();
            if (onlyRoleBurnable) if (!hasRole(BURNER_ROLE, msg.sender)) revert ATSToken__E0();
        }

        super._update(from, to, value);
    }

}