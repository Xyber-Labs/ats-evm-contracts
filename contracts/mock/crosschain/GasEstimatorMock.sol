// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable, AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IEndpointExtended} from "./interfaces/IEndpointExtended.sol";
import {IDFOracle} from "./interfaces/IDFOracle.sol";

contract GasEstimatorMock is 
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable
{

    error GasEstimator__ChainInactive();
    error GasEstimator__ZeroActiveAgents();
    error GasEstimator__ZeroRates();
    error GasEstimator__ZeroChainId();
    error GasEstimator__InvalidChainData();
    error GasEstimator__InvalidAddress();
    error GasEstimator__ZeroGasLimit();

    bytes32 public constant ADMIN = keccak256("ADMIN");

    struct ChainData {
        uint256 totalFee;
        uint256 decimals;
        uint256 defaultGas;
        bytes32 gasDataKey;
        bytes32 nativeDataKey;
    }

    address public endpoint;
    address public oracle;

    uint256 public priceMul;
    uint256 public coms;
    uint256 public gasMul;

    mapping(uint256 chainId => ChainData) public chainData;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address endpoint_) initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        _setRoleAdmin(ADMIN, ADMIN);
        _grantRole(ADMIN, msg.sender);
        endpoint = endpoint_;
    }   

    function estimateExecutionWithGas(uint256 destChainId, uint256 gasLimit) external view returns (uint256) {
        return destChainId * gasLimit;
    }

    function convertGas(
        uint256 srcPrice, 
        uint256 destPrice, 
        uint256 destChainId, 
        uint256 amount
    ) public view returns (uint256) {
        uint256 decimalsFrom = chainData[block.chainid].decimals;
        uint256 decimalsTo = chainData[destChainId].decimals;

        uint256 baseRate = (amount * destPrice) / srcPrice;

        if (decimalsFrom >= decimalsTo) {
            uint256 decimalsDiff = decimalsFrom - decimalsTo;
            return baseRate * 10 ** decimalsDiff;
        } else {
            uint256 decimalsDiff = decimalsTo - decimalsFrom;
            uint256 denom = 10 ** decimalsDiff;
            return (baseRate + denom - 1) / denom;
        }

        // return (amount * srcPrice * (10 ** decimalsTo)) / (destPrice * (10 ** decimalsFrom));
    } 

    function getNativePrices(uint256 destChainId) public view returns(uint256, uint256) {
        if (destChainId == 0) {
            revert GasEstimator__ZeroChainId();
        }
        return(getNativePrice(block.chainid), getNativePrice(destChainId));
    }

    function getGasPrice(uint256 chainId) public view returns (uint256) {
        if (chainId == 0) {
            revert GasEstimator__ZeroChainId();
        }
        // bytes32 gasDataKey = chainData[chainId].gasDataKey;
        // (uint256 price, /* uint256 timestamp */) = IDFOracle(oracle).getFeedPrice(gasDataKey);
        // return price;

        return 1;
    }

    function getNativePrice(uint256 chainId) public view returns (uint256) {
        if (chainId == 0) {
            revert GasEstimator__ZeroChainId();
        }
        // bytes32 nativeDataKey = chainData[chainId].nativeDataKey;
        // (uint256 price, /* uint256 timestamp */) = IDFOracle(oracle).getFeedPrice(nativeDataKey);
        // return price;

        return 1;
    }

    function setChainData(uint256 chainId, ChainData calldata data) public onlyRole(ADMIN) {
        if (
            chainId == 0 || 
            data.totalFee == 0 ||
            data.defaultGas == 0 ||
            data.decimals == 0 ||
            data.gasDataKey == bytes32(0) ||
            data.nativeDataKey == bytes32(0)
        ) {
            revert GasEstimator__InvalidChainData();
        }
        chainData[chainId] = data;
    }

    function setChainDataBatch(uint256[] calldata chainIds, ChainData[] calldata datas) external onlyRole(ADMIN) {
        if (chainIds.length != datas.length) {
            revert GasEstimator__InvalidChainData();
        }
        if (chainIds.length == 0 || datas.length == 0) {
            revert GasEstimator__InvalidChainData();
        }

        for (uint256 i = 0; i < chainIds.length; i++) {
            setChainData(chainIds[i], datas[i]);
        }
    }

    function setOracle(address newOracle) external onlyRole(ADMIN) {
        if (newOracle == address(0)) {
            revert GasEstimator__InvalidAddress();
        }
        oracle = newOracle;
    }

    function setDeviations(uint256 newPriceMul, uint256 newComs, uint256 newGasMul) external onlyRole(ADMIN) {
        priceMul = newPriceMul;
        coms = newComs;
        gasMul = newGasMul;
    }

    function _authorizeUpgrade(address) internal override onlyRole(ADMIN) {
        
    }

    function changeEndpoint(address newEndpoint) external onlyRole(ADMIN) {
        endpoint = newEndpoint;
    }
}
