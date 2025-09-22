// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Various structs used in the ATS protocol ERC20-module contracts.

    /// @notice Destination chain {ChainConfig} settings for {ATSBase}.
    struct ChainConfig {
        bytes  peerAddress; // connected {ATSToken} or {ATSConnector} contract address on the destination chain
        uint64 minGasLimit; // the amount of gas required to execute {ATSBase.redeem} function on the destination chain
        uint8  decimals;    // connected {peerAddress} decimals on the destination chain
        bool   paused;      // flag indicating whether current contract is paused for sending/receiving messages from the connected {peerAddress}
    }

    /// @notice Destination {peerAddress} contract {ChainConfig} settings for {ATSBaseExtended.setChainConfigToDestination} function.
    struct ChainConfigUpdate {
        uint256[] allowedChainIds;  // chains Ids available for bridging in both directions
        ChainConfig[] chainConfigs; // {ChainConfig} settings
    }

    /// @notice Crosschain message source peer data.
    struct Origin {
        bytes   sender;      // source message {msg.sender} sender
        uint256 chainId;     // source chain Id
        bytes   peerAddress; // source {ATSToken} or {ATSConnector} contract address
        uint8   decimals;    // source {peerAddress} decimals
    }

    /// @notice {ATSToken} initial settings, configuration, and metadata for deployment and initialization.
    struct DeployTokenData {
        bytes     owner;               // the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}
        string    name;                // the {ERC20.name} of the {ATSToken} token
        string    symbol;              // the {ERC20.symbol} of the {ATSToken} token
        uint8     decimals;            // the {ERC20.decimals} of the {ATSToken} token
        uint256   initialSupply;       // total initial {ATSToken} supply to mint
        uint256   mintedAmountToOwner; // initial {ATSToken} supply to mint to {owner} balance
        bool      pureToken;           // flag indicating whether the {ATSToken} is use lock/unlock or mint/burn mechanism for bridging
        bool      mintable;            // flag indicating whether {owner} can mint an unlimited amount of {ATSToken} tokens
        bool      globalBurnable;      // flag indicating whether the {ATSToken} is globally burnable by anyone
        bool      onlyRoleBurnable;    // flag indicating whether only addresses with the {AccessControl.BURNER_ROLE} can burn tokens
        bool      feeModule;           // flag indicating whether the {ATSToken} is supports the fee deducting for bridging
        bytes     router;              // the address of the authorized {ATSRouter}
        uint256[] allowedChainIds;     // chains Ids available for bridging in both directions
        ChainConfig[] chainConfigs;    // {ChainConfig} settings for the corresponding {allowedChainIds}
        bytes32   salt;                // value used for precalculation of {ATSToken} contract address
    }

    /// @notice {ATSConnector} initial settings and configuration for deployment and initialization.
    struct DeployConnectorData {
        bytes     owner;            // the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}
        bytes     underlyingToken;  // underlying ERC20 token address or {ATSFactory.NATIVE_ADDRESS} as native currency
        bool      feeModule;        // flag indicating whether the {ATSConnector} is supports the fee deducting for bridging
        bytes     router;           // the address of the authorized {ATSRouter}
        uint256[] allowedChainIds;  // chains Ids available for bridging in both directions
        ChainConfig[] chainConfigs; // {ChainConfig} settings for the corresponding {allowedChainIds}
        bytes32   salt;             // value used for precalculation of {ATSConnector} contract address
    }

    /// @notice Metadata for the crosschain deployment request for {ATSDeploymentRouter.sendDeployRequest}.
    struct DeployMetadata {
        uint256 dstChainId;  // destination chain Id
        bool    isConnector; // flag indicating whether is {ATSConnector}(true) or {ATSToken}(false) deployment
        bytes   params;      // abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct
    }

    /// @notice Destination chain settings for sending a crosschain deployment request in the {ATSDeploymentRouter}.
    struct DstDeployConfig {
        bytes  factory;            // destination {ATSFactory} address
        uint64 tokenDeployGas;     // the amount of gas required to deploy the {ATSToken} on the destination chain
        uint64 connectorDeployGas; // the amount of gas required to deploy the {ATSConnector} on the destination chain
        uint16 protocolFee;        // protocol fee (basis points) for crosschain deployment on the destination chain
    }