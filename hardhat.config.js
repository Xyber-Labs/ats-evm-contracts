require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require('dotenv').config();

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            // forking: {
            //     url: "https://mainnet.infura.io/v3/",
            //     blockNumber: 20000000,
            // }
        },
        eth: {
            url: process.env.ETH_RPC_URL !== undefined ? process.env.ETH_RPC_URL : "https://eth.llamarpc.com",
            chainId: 1,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        holesky: {
            url: process.env.HOLESKY_RPC_URL !== undefined ? process.env.HOLESKY_RPC_URL : "https://1rpc.io/holesky",
            chainId: 17000,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL !== undefined ? process.env.SEPOLIA_RPC_URL : "https://ethereum-sepolia-rpc.publicnode.com",
            chainId: 11155111,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        bsc: {
            url: process.env.BSC_RPC_URL !== undefined ? process.env.BSC_RPC_URL : "https://binance.llamarpc.com",
            chainId: 56,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        bscTestnet: {
            url: process.env.BSC_TESTNET_RPC_URL !== undefined ? process.env.BSC_TESTNET_RPC_URL : "https://bsc-testnet-rpc.publicnode.com",
            chainId: 97,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        opbnb: {
            url: process.env.OPBNB_RPC_URL !== undefined ? process.env.OPBNB_RPC_URL : "https://1rpc.io/opbnb",
            chainId: 204,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        opbnbTestnet: {
            url: process.env.OPBNB_TESTNET_RPC_URL !== undefined ? process.env.OPBNB_TESTNET_RPC_URL : "https://opbnb-testnet-rpc.bnbchain.org",
            chainId: 5611,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        arbitrum: {
            url: process.env.ARBITRUM_RPC_URL !== undefined ? process.env.ARBITRUM_RPC_URL : "https://arbitrum.llamarpc.com",
            chainId: 42161,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        arbitrumSepolia: {
            url: process.env.ARBITRUM_SEPOLIA_RPC_URL !== undefined ? process.env.ARBITRUM_SEPOLIA_RPC_URL : "https://endpoints.omniatech.io/v1/arbitrum/sepolia/public",
            chainId: 421614,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        base: {
            url: process.env.BASE_RPC_URL !== undefined ? process.env.BASE_RPC_URL : "https://base.llamarpc.com",
            chainId: 8453,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL !== undefined ? process.env.BASE_SEPOLIA_RPC_URL : "https://base-sepolia.drpc.org",
            chainId: 84532,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        polygon: {
            url: process.env.POLYGON_RPC_URL !== undefined ? process.env.POLYGON_RPC_URL : "https://polygon.llamarpc.com",
            chainId: 137,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        avalanche: {
            url: process.env.AVALANCHE_RPC_URL !== undefined ? process.env.AVALANCHE_RPC_URL : "https://avalanche-c-chain-rpc.publicnode.com",
            chainId: 43114,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        fuji: {
            url: process.env.FUJI_RPC_URL !== undefined ? process.env.FUJI_RPC_URL : "https://avalanche-fuji.drpc.org",
            chainId: 43113,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        optimism: {
            url: process.env.OPTIMISM_RPC_URL !== undefined ? process.env.OPTIMISM_RPC_URL : "https://optimism.llamarpc.com",
            chainId: 10,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        mantle: {
            url: process.env.MANTLE_RPC_URL !== undefined ? process.env.MANTLE_RPC_URL : "https://mantle-rpc.publicnode.com",
            chainId: 5000,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        mantleSepolia: {
            url: process.env.MANTLE_SEPOLIA_RPC_URL !== undefined ? process.env.MANTLE_SEPOLIA_RPC_URL : "https://endpoints.omniatech.io/v1/mantle/sepolia/public",
            chainId: 5003,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        xlayer: {
            url: process.env.XLAYER_RPC_URL !== undefined ? process.env.XLAYER_RPC_URL : "https://xlayer.drpc.org",
            chainId: 196,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        core: {
            url: process.env.CORE_RPC_URL !== undefined ? process.env.CORE_RPC_URL : "https://1rpc.io/core",
            chainId: 1116,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        immutable: {
            url: process.env.IMMUTABLE_RPC_URL !== undefined ? process.env.IMMUTABLE_RPC_URL : "https://rpc.immutable.com",
            chainId: 13371,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        immutableTestnet: {
            url: process.env.IMMUTABLE_TESTNET_RPC_URL !== undefined ? process.env.IMMUTABLE_TESTNET_RPC_URL : "https://rpc.testnet.immutable.com",
            chainId: 13473,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        bera: {
            url: process.env.BERA_RPC_URL !== undefined ? process.env.BERA_RPC_URL : "https://rpc.berachain.com/",
            chainId: 80094,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        sonic: {
            url: process.env.SONIC_RPC_URL !== undefined ? process.env.SONIC_RPC_URL : "https://rpc.soniclabs.com/",
            chainId: 146,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        blaze: {
            url: process.env.BLAZE_RPC_URL !== undefined ? process.env.BLAZE_RPC_URL : "https://rpc.blaze.soniclabs.com",
            chainId: 57054,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        manta: {
            url: process.env.MANTA_RPC_URL !== undefined ? process.env.MANTA_RPC_URL : "https://manta-pacific.drpc.org/",
            chainId: 169,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        zksync: {
            url: process.env.ZKSYNC_RPC_URL !== undefined ? process.env.ZKSYNC_RPC_URL : "https://mainnet.era.zksync.io",
            ethNetwork: "mainnet",
            zksync: true,
            chainId: 324,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        abstract: {
            url: process.env.ABSTRACT_RPC_URL !== undefined ? process.env.ABSTRACT_RPC_URL : "https://api.mainnet.abs.xyz",
            ethNetwork: "mainnet",
            zksync: true,
            chainId: 2741,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        kaia: {
            url: process.env.KAIA_RPC_URL !== undefined ? process.env.KAIA_RPC_URL : "https://1rpc.io/klay",
            chainId: 8217,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        oasisSapphire: {
            url: process.env.OASIS_SAPPHIRE_RPC_URL !== undefined ? process.env.OASIS_SAPPHIRE_RPC_URL : "https://1rpc.io/oasis/sapphire",
            chainId: 23294,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        blast: {
            url: process.env.BLAST_RPC_URL !== undefined ? process.env.BLAST_RPC_URL : "https://blast.drpc.org",
            chainId: 81457,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        ronin: {
            url: process.env.RONIN_RPC_URL !== undefined ? process.env.RONIN_RPC_URL : "https://ronin.drpc.org",
            chainId: 2020,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        skaleNebulaTestnet: {
            url: process.env.SKALE_NEBULA_TESTNET_RPC_URL !== undefined ? process.env.SKALE_NEBULA_TESTNET_RPC_URL : "https://testnet.skalenodes.com/v1/lanky-ill-funny-testnet",
            chainId: 37084624,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        }
    },

    etherscan: {
        apiKey: {
            eth: process.env.ETH_API_KEY,
            holesky: process.env.ETH_API_KEY,
            sepolia: process.env.ETH_API_KEY,
            bsc: process.env.BSC_API_KEY,
            bscTestnet: process.env.BSC_API_KEY
        }
    },

    solidity: {
        compilers: [
            {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],

        overrides: {
            "contracts/ERC20/codestorage/ATSCodeStorage.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/ERC20/codestorage/ATSCodeStorageMintable.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/ERC20/codestorage/ATSCodeStorageTokenWithFee.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/ERC20/codestorage/ATSCodeStorageMintableWithFee.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/ERC20/codestorage/ATSCodeStoragePure.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/ERC20/codestorage/ATSCodeStorageConnectorWithFee.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/ERC20/codestorage/ATSCodeStorageConnectorNative.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            },

            "contracts/mock/crosschain/endpoint/EndpointMock.sol": {
                version: "0.8.25",
                settings: {
                    viaIR: true,
                    evmVersion: "cancun",
                    optimizer: {
                        enabled: true,
                        runs: 0,
                    },
                },
            },

            "contracts/simpleToken/SingletonFactory.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 10,
                    },
                },
            }
        },
    },

    gasReporter: {
        enabled: false,
    },

    contractSizer: {
        alphaSort: false,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
        only: [],
    }
}