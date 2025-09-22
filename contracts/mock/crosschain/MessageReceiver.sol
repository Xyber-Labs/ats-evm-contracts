// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract MessageReceiver {

    function execute(bytes calldata data) external payable virtual {

    }

    function _decode(bytes calldata data) internal virtual returns(
        uint256 srcChainId,
        bytes32 srcTxHash,
        bytes memory senderAddr,
        bytes memory payload
    ) {
        (srcChainId, srcTxHash, senderAddr, payload) = abi.decode(data, (uint256, bytes32, bytes, bytes));
    }
}