// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../extensions/ATSBaseExtendedUpgradeable.sol";
import "../../libraries/ATSUpgradeChecker.sol";

/**
 * @notice An ERC20 compliant token contract with integrated functionality to use ATS protocol crosschain messaging
 * for bridging this token itself, also this token is a wrapped version of the native currency.  
 *
 * @dev A mint/burn mechanism is used to send and receive ERC20 tokens crosschain bridges.
 */
contract ATSBridgeableWrappedTokenUpgradeable is
    ATSBaseExtendedUpgradeable, 
    ATSUpgradeChecker, 
    ERC20Upgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable 
{
    
    /// @notice {AccessControl} role identifier for minter addresses.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Indicates an error that the specified {newImplementation} contract address is not valid.
    error ATSBridgeableWrappedTokenUpgradeable__E0();

    /// @notice Indicates an error that native currency transfer to {receiver} address is failed.
    error ATSBridgeableWrappedTokenUpgradeable__E1();

    /**
     * @notice Emitted when native currency deposited and ERC20 tokens are minted.
     * @param depositor {msg.sender} address.
     * @param receiver receiver of the ERC20 tokens.
     * @param amount received ERC20 tokens amount.
     */
    event Deposit(address indexed depositor, address indexed receiver, uint256 amount);

    /**
     * @notice Emitted when tokens are burned and converted into native currency.
     * @param sender {msg.sender} address.
     * @param receiver receiver of the native currency.
     * @param amount received native currency amount.
     */
    event Withdrawal(address indexed sender, address indexed receiver, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor 
    constructor() ATSUpgradeChecker(hex'08') {
        _disableInitializers();
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param owner the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}.
     * @param name the {ERC20.name} of the {ATSBridgeableWrappedTokenUpgradeable} token.
     * @param symbol the {ERC20.symbol} of the {ATSBridgeableWrappedTokenUpgradeable} token.
     * @param newDecimals the {ERC20.decimals} of the {ATSBridgeableWrappedTokenUpgradeable} token.
     * @param router the address of the authorized {ATSRouter}.
     */
    function initialize(
        address owner,
        string calldata name,
        string calldata symbol,
        uint8 newDecimals,
        address router
    ) external initializer() {
        __ERC165_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC20_init(name, symbol);
        __ATSBase_init(address(this), newDecimals);
        
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _setRouter(router);
    }

    /**
     * @notice Provides the ability to send native currency to the current contract to replenish liquidity.
     */
    receive() external payable {

    }

    /**
     * @notice Returns decimals value of the {ATSBridgeableWrappedTokenUpgradeable}.
     * @return {_decimals} of the {ATSBridgeableWrappedTokenUpgradeable}.
     */
    function decimals() public view override returns(uint8) {
        return _getDecimals();
    }

    /**
     * @notice Returns the balance of the native currency held by this contract.
     * @return nativeBalance native currency balance held by the {ATSWrappedTokenUpgradeable} contract.
     */
    function underlyingBalance() external view returns(uint256 nativeBalance) {
        return address(this).balance;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ATSBaseUpgradeable, AccessControlUpgradeable) returns(bool) {
        return interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Mints new tokens to the provided address {to}.
     * @param to receiver of the minted tokens.
     * @param amount tokens amount to mint.
     * @dev Only addresses with the {MINTER_ROLE} can execute this function.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Deposits native currency and mint new ERC20 tokens to the receiver address.
     * @param receiver ERC20 tokens receiver.
     * @return success call result.
     */
    function deposit(address receiver) external payable returns(bool success) {
        _mint(receiver, msg.value);

        emit Deposit(msg.sender, receiver, msg.value);

        return true;
    }

    /**
     * @notice Burns ERC20 tokens and transfer native currency to the receiver address.
     * @param receiver native currency receiver.
     * @param amount native currency amount to receive.
     * @return success call result.
     */
    function withdraw(address receiver, uint256 amount) external returns(bool success) {
        _burn(msg.sender, amount);

        if (receiver != address(this)) {
            (bool _callResult, /* bytes memory _callResponse */) = receiver.call{value: amount}("");
            if (!_callResult) revert ATSBridgeableWrappedTokenUpgradeable__E1();
        }

        emit Withdrawal(msg.sender, receiver, amount);

        return true;
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

        _burn(from, amount);

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
        _mint(to, amount);

        return amount;
    }

    /**
     * @notice The function is overridden to include access restriction to the {ATSBaseUpgradeable.setRouter}, 
     * {ATSBaseUpgradeable.setChainConfig} and {UUPSUpgradeable._authorizeUpgrade} functions.
     */
    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

    /**
     * @notice The function is overridden to include access restriction to the {UUPSUpgradeable.upgradeToAndCall} function,
     * and implement a basic compatibility check with the {newImplementation} contract.
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override {
        _authorizeCall();
        _checkContractType(newImplementation);

        if (IATSBase(newImplementation).protocolVersion() != protocolVersion()) {
            revert ATSBridgeableWrappedTokenUpgradeable__E0();
        }
    }

}