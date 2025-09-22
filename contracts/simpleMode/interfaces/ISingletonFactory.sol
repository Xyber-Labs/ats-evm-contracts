// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISingletonFactory {

    function SINGLETON_ROUTER() external view returns(address);

    function paused() external view returns(bool);

    function deploy(
        bytes32 tokenId,
        string calldata name,
        string calldata symbol,
        uint256 totalSupply
    ) external returns(address newToken);

    function pause() external;

    function unpause() external;

}