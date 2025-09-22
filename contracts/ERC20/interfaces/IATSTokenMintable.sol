// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IATSToken.sol";

interface IATSTokenMintable is IATSToken {

    function mint(address to, uint256 amount) external;

}