# ATS Smart Contracts

Agents Token Standard (ATS) protocol implementation for EVM-compatible blockchains, providing a comprehensive cross-chain token bridging solution.

## Overview

ATS Smart Contracts is a modular and upgradeable framework for creating cross-chain compatible ERC20 tokens with built-in bridging capabilities. The protocol enables seamless token transfers across different blockchain networks while maintaining security and flexibility.

## Features

- **Cross-chain Token Bridging**: Native support for transferring tokens between different EVM chains
- **Multiple Token Models**: Support for mintable, burnable, lock/unlock, and wrapped token patterns
- **Upgradeable Architecture**: Contracts built with upgradeability in mind using OpenZeppelin's upgradeable patterns
- **Fee Management**: Optional fee module for bridge operations
- **Native Currency Support**: Handle native currencies (ETH, BNB, etc.) alongside ERC20 tokens
- **Factory Pattern**: Streamlined deployment of new bridgeable tokens
- **Code Storage Optimization**: Efficient bytecode storage for reduced deployment costs

## Project Structure

```
contracts/
├── ERC20/                    # Core ERC20 token implementations
│   ├── token/               # Token contracts (standard, mintable, upgradeable)
│   ├── connector/           # Bridge connectors for different token models
│   ├── codestorage/        # Bytecode storage contracts
│   ├── extensions/         # Extended functionality modules
│   ├── interfaces/         # Contract interfaces
│   └── showcases/          # Example implementations
├── libraries/               # Utility libraries
├── interfaces/             # Protocol-wide interfaces
├── simpleMode/             # Simplified singleton pattern implementation
└── mock/                   # Test and development contracts
```

## Key Components

### Core Contracts

- **ATSBase**: Abstract base contract for cross-chain token functionality
- **ATSRouter**: Handles routing of cross-chain messages and token transfers
- **ATSFactory**: Factory for deploying new bridgeable tokens
- **ATSRegistry**: Central registry for managing protocol components
- **ATSMasterRouter**: Main contract for cross-chain operations

### Token Types

- **ATSToken**: Standard bridgeable ERC20 token
- **ATSTokenMintable**: Mintable token for mint/burn bridging model
- **ATSTokenUpgradeable**: Upgradeable proxy pattern token
- **ATSWrappedTokenUpgradeable**: Wrapped representation of tokens from other chains

### Connectors

- **ATSConnector**: Lock/unlock model for existing tokens
- **ATSConnectorNative**: Native currency bridging
- **ATSConnectorWithFee**: Connector with fee collection

## Installation

```bash
npm install
```

## Development

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Run Coverage

```bash
npx hardhat coverage
```

## Configuration

Create a `.env` file in the root directory with your configuration:

```env
PRIVATE_KEY=your_private_key
```

## Dependencies

- Node.js v22.17.0
- Solidity ^0.8.20
- OpenZeppelin Contracts v5.0.2
- Hardhat v2.22.10
- Ethers.js v6.13.2

## Security Considerations

- All contracts are designed with security best practices
- Upgradeable contracts use OpenZeppelin's proxy patterns
- Access control mechanisms for administrative functions
- Pausable functionality for emergency situations
- Comprehensive validation of cross-chain messages

## License

MIT

## Support

For questions and support, please open an issue in the repository.