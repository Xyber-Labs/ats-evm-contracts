// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
 
library LocationLib {

    bytes32 constant BLOCK_MASK = 0x000000000000000000000000000000000fffffffffffffffffffffffffffffff;

    function pack(
        uint128 srcChainID, 
        uint128 srcBlockNumber
    ) internal pure returns(uint256 packedVar) {
        assembly {
            packedVar := add(shl(128, srcChainID), srcBlockNumber)
        }
    }

    function unpack(uint256 packedVar) internal pure returns(uint128 srcChainID, uint128 srcBlockNumber){
        assembly {
            srcChainID := shr(128, packedVar)
            srcBlockNumber := and(BLOCK_MASK, packedVar)
        }
    }

    function getChain(uint256 packedVar) internal pure returns(uint128 srcChainId) {
        assembly {
            srcChainId := shr(128, packedVar)
        }
    }

    function getBlock(uint256 packedVar) internal pure returns(uint128 srcBlockNumber) {
        assembly {
            srcBlockNumber := and(BLOCK_MASK, packedVar)
        }
    }
}
