// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct VaaKey {
	uint16 chainId;
	bytes32 emitterAddress;
	uint64 sequence;
}

struct MessageKey {
    uint8 keyType;
    bytes encodedKey;
}