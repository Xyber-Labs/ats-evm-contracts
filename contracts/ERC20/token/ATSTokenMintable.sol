// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ATSToken.sol";

import "../interfaces/IATSTokenMintable.sol";

/**
 * @notice Extends ATSToken to add function to mint tokens.
 */
contract ATSTokenMintable is IATSTokenMintable, ATSToken {

    /// @notice {AccessControl} role identifier for minter addresses.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Mints new tokens to the provided address {to}.
     * @param to receiver of the minted tokens.
     * @param amount tokens amount to mint.
     * @dev Only addresses with the {MINTER_ROLE} can execute this function.
     */
    function mint(address to, uint256 amount) external {
        if (!hasRole(MINTER_ROLE, msg.sender)) revert ATSToken__E0();
        
        _mint(to, amount);
    }

}