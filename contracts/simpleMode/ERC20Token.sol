// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Token is ERC20 {

    constructor(
        address singletonRouter, 
        string memory name, 
        string memory symbol, 
        uint256 initialTotalSupply
    ) ERC20(name, symbol) {

        _mint(singletonRouter, initialTotalSupply);
    }

}