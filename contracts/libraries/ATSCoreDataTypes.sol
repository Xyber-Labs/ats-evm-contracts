// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Various structs and enum used in the ATS protocol core contracts.

    /// @notice The {ATSToken} and {ATSConnector} metadata registered in the {ATSRegistry}.
    struct DeploymentData {
        bytes   deployer;            // deployer {msg.sender} address
        address underlyingToken;     // underlying token address
        bytes2  initProtocolVersion; // initial ATS protocol version
    }

    /// @notice Metadata for manual registration of ATS compatible contract in the {ATSRegistry}.
    struct ApproveRequestData {
        address deployment;      // ATS compatible contract address
        bytes   deployer;        // deployer address
        address underlyingToken; // underlying token address
        bytes2  protocolVersion; // ATS protocol version
    }

    /// @notice Execution result code for the {ATSMasterRouter.ProposalExecuted} event.
    enum OperationResult {
        Success,
        FailedAndStored,
        Failed,
        RouterPaused,
        UnauthorizedRouter,
        InvalidDstPeerAddress,
        InvalidSrcChainId,
        InvalidToAddress,
        InvalidSrcPeerAddress,
        DeployFailed,
        IncompatibleRouter,
        MasterRouterPaused,
        InvalidMessageType,
        InvalidSrcMasterRouter,
        S_Success,
        S_FailedAndStored,
        S_TokenNotExistAndStored,
        S_InvalidToAddress,
        S_DeployFailed,
        S_DeployAndRedeemFailed
    }