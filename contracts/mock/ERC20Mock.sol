// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../ERC20/token/ERC20Burnable.sol";

contract ERC20Mock is ERC20Burnable {

    uint8 private _decimals;

    constructor(uint8 decimals_) {
        __ERC20_init("ERC20Mock", "ERC20");
        _decimals = decimals_;

        _mint(msg.sender, 100_000_000 * 10 ** decimals());
    }

    function decimals() public view virtual override returns(uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

}