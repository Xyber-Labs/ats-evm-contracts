// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract Mock {
    
    address public immutable SINGLETON_ROUTER;

    event Deployed(bytes32 indexed tokenId, address indexed newToken, string name, string symbol);

    constructor(address singletonRouter) {
        SINGLETON_ROUTER = singletonRouter;
    }

    function deploy(
        bytes32 /* tokenId */,
        string calldata /* name */,
        string calldata /* symbol */,
        uint256 /* totalSupply */
    ) external returns(address newToken) {
        return address(0);
    }

    function paused() external pure returns(bool) {
        return false;
    }

    function router() external view returns(address) {
        return SINGLETON_ROUTER;
    }

    function getChainId() public view returns (uint256) {
        uint256 id;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }

}