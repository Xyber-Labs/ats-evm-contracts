// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LocationLib} from "./LocationLib.sol";
import {TransmitterParamsLib} from "./TransmitterParamsLib.sol";

library MessageLib {
    using LocationLib for SrcChainData;

    struct Proposal {
        uint256 destChainId;
        uint256 nativeAmount;
        bytes32 selectorSlot;
        bytes senderAddr;
        bytes destAddr;
        bytes payload;
        bytes reserved;
        bytes transmitterParams;
    }

    struct SrcChainData {
        uint256 location;
        bytes32[2] srcOpTxId;
    }

    struct SrcChainDataRaw {
        uint128 srcChainId;
        uint128 srcBlockNumber;
        bytes32[2] srcOpTxId;
    }

    struct MessageData {
        Proposal initialProposal;
        SrcChainData srcChainData;
    }

    enum MessageStatus {
        NOT_INITIALIZED, 
        INVALID, 
        SAVED, 
        TRANSMITTED, 
        QUEUED, 
        PENDING, 
        PROTOCOL_FAILED,
        CONSENSUS_NOT_REACHED,
        EXTENSION_NOT_REGISTERED,
        EXTENSION_NOT_REACHABLE,
        EXTENSION_PANICKED,
        UNDERESTIMATED, 
        SUCCESS, 
        FAILED 
    }

    struct Message {
        MessageStatus status;
        uint256 globalNonce;
        MessageData data;
    }

    function statusChangeValid(
        MessageLib.MessageStatus oldStatus,
        MessageLib.MessageStatus newStatus
    ) internal pure returns (bool) {
        if (newStatus == MessageLib.MessageStatus.NOT_INITIALIZED) {
            return false;
        }

        if (
            oldStatus == MessageLib.MessageStatus.INVALID ||
            oldStatus == MessageLib.MessageStatus.FAILED ||
            oldStatus == MessageLib.MessageStatus.SUCCESS || 
            oldStatus == MessageLib.MessageStatus.PROTOCOL_FAILED
        ) {
            return false;
        }

        return true;
    }

    function getDestChain(MessageData memory msgData) internal pure returns (uint256) {
        return msgData.initialProposal.destChainId;
    }

    function getLocation(MessageData memory msgData) internal pure returns (uint256) {
        return msgData.srcChainData.location;
    }

    function getHashPrefixed(
        MessageLib.MessageData memory msgData
    ) internal pure returns (bytes32) {
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                msgData.initialProposal.destChainId,
                msgData.initialProposal.nativeAmount,
                msgData.initialProposal.selectorSlot,
                msgData.initialProposal.senderAddr.length,
                msgData.initialProposal.senderAddr,
                msgData.initialProposal.destAddr.length,
                msgData.initialProposal.destAddr,
                msgData.initialProposal.payload.length,
                msgData.initialProposal.payload,
                msgData.initialProposal.reserved.length,
                msgData.initialProposal.reserved,
                msgData.initialProposal.transmitterParams.length,
                msgData.initialProposal.transmitterParams,
                msgData.srcChainData.location,
                msgData.srcChainData.srcOpTxId
            )
        );

        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
            );
    }
}
