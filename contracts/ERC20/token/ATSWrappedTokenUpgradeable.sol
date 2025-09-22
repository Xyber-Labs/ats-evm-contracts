// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../../libraries/ATSUpgradeChecker.sol";

import "../interfaces/IATSWrappedTokenUpgradeable.sol"; 

contract ATSWrappedTokenUpgradeable is
    IATSWrappedTokenUpgradeable, 
    ATSUpgradeChecker, 
    ERC20Upgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable 
{
    
    /// @notice {AccessControl} role identifier for minter addresses.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Indicates an error that the specified {newImplementation} contract address is not valid.
    error ATSWrappedTokenUpgradeable__E0();

    /// @notice Indicates an error that native currency transfer to {receiver} address is failed.
    error ATSWrappedTokenUpgradeable__E1();

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
    constructor() ATSUpgradeChecker(hex'09') {
        _disableInitializers();
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param owner the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}.
     * @param name the {ERC20.name} of the {ATSWrappedTokenUpgradeable} token.
     * @param symbol the {ERC20.symbol} of the {ATSWrappedTokenUpgradeable} token.
     */
    function initialize(
        address owner,
        string calldata name,
        string calldata symbol
    ) external initializer() {
        __ERC165_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC20_init(name, symbol);
        
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
    }

    /**
     * @notice Provides the ability to send native currency to the current contract to replenish liquidity.
     */
    receive() external payable {

    }

    /**
     * @notice Mints new tokens to the provided address {receiver}.
     * @param receiver receiver of the minted tokens.
     * @param amount tokens amount to mint.
     * @dev Only addresses with the {MINTER_ROLE} can execute this function.
     */
    function mint(address receiver, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(receiver, amount);
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
            if (!_callResult) revert ATSWrappedTokenUpgradeable__E1();
        }

        emit Withdrawal(msg.sender, receiver, amount);

        return true;
    }

    /**
     * @notice Returns the balance of the native currency held by this contract.
     * @return nativeBalance native currency balance held by the {ATSWrappedTokenUpgradeable} contract.
     */
    function underlyingBalance() external view returns(uint256 nativeBalance) {
        return address(this).balance;
    }

    /**
     * @notice Returns the underlying token address.
     * @return underlyingTokenAddress {_underlyingToken} address.
     */
    function underlyingToken() public pure returns(address underlyingTokenAddress) {
        return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice The function is overridden to include access restriction to the {UUPSUpgradeable.upgradeToAndCall} function,
     * and implement a basic compatibility check with the {newImplementation} contract.
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
        
        if (IATSWrappedTokenUpgradeable(newImplementation).underlyingToken() != underlyingToken()) {
            revert ATSWrappedTokenUpgradeable__E0();
        }
    }

}