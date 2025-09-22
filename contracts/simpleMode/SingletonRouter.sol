// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/ATSCoreDataTypes.sol";
import "../libraries/AddressConverter.sol";
import "../interfaces/IATSMasterRouter.sol";
import "../mock/crosschain/interfaces/IGasEstimator.sol";
import "../libraries/ATSUpgradeChecker.sol";

import "./interfaces/ISingletonFactory.sol";
import "./interfaces/ISingletonRouter.sol";

contract SingletonRouter is ISingletonRouter, ATSUpgradeChecker, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using AddressConverter for *;
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    bytes1 private constant SIMPLE_BRIDGE_MESSAGE_TYPE = 0x04;
    bytes1 private constant SIMPLE_DEPLOY_MESSAGE_TYPE = 0x05;

    uint8  private constant BYTES32_LENGTH = 32;
    uint64 private constant SOLANA_CHAIN_ID = 11100000000000000501;

    uint64 private constant DEFAULT_DST_REDEEM_GAS_AMOUNT = 220000;
    uint64 private constant DEFAULT_DST_DEPLOY_GAS_AMOUNT = 1000000;

    address public immutable MASTER_ROUTER;
    address public immutable GAS_ESTIMATOR;
    address public immutable SINGLETON_FACTORY;

    uint64 private immutable ETH_CALL_GAS_LIMIT;

    /// @custom:storage-location erc7201:SimpleCrosschainToken.storage.SingletonRouter.Main
    struct Main {
        mapping(uint256 dstChainId => bytes dstSingletonRouterAddress) _dstSingletonRouter;
        mapping(uint256 dstChainId => uint64 dstRedeemGas) _dstRedeemGas;
        mapping(uint256 dstChainId => uint64 dstDeployGas) _dstDeployGas;

        mapping(bytes32 tokenId => address deployedTokenAddress) _token;
        mapping(address deployedTokenAddress => bytes32 tokenId) _tokenId;

        mapping(bytes32 msgHash => address receiverAddress) _failedExecution;
        uint256 _retryNonce;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("SimpleCrosschainToken.storage.SingletonRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x380b4626e4b94f2170e0940b0aaff1244b28cffe5f047c2bf6d5ef4f76a58a00;

    error SingletonRouter__E0(); // parameters lengths mismatch
    error SingletonRouter__E1(); // non-existing or invalid token
    error SingletonRouter__E2(); // parameters length zero
    error SingletonRouter__E3(); // unsupported chainId
    error SingletonRouter__E4(); // insufficient payment
    error SingletonRouter__E5(); // invalid caller
    error SingletonRouter__E6(); // invalid receiver address
    error SingletonRouter__E7(); // invalid retryRedeem call
    error SingletonRouter__E8(); // zero amount to bridge
    error SingletonRouter__E9(); // existing token

    event NewTokenDeployed(
        bytes32 indexed underlyingTokenId,
        address indexed tokenAddress,
        string name,
        string symbol, 
        uint256 totalSupply
    );

    event DeployRequestSent(
        address indexed deployer,
        bytes32 indexed underlyingTokenId,
        address tokenAddress,
        string name,
        string symbol, 
        uint256 totalSupply,
        uint256 indexed dstChainId
    );

    event OffchainDeployRequestSent(
        address indexed deployer,
        bytes indexed tokenAddressIndexed,
        bytes tokenAddress,
        uint256 indexed srcChainId,
        uint256[] dstChainIds
    );

    event Bridged(
        bytes32 indexed underlyingTokenId,
        address tokenAddress,
        address indexed from,
        bytes receiver, 
        uint256 amount,
        uint256 indexed dstChainId
    );

    event Redeemed(
        bytes32 indexed underlyingTokenId,
        address indexed tokenAddress,
        address indexed receiver, 
        uint256 amount
    );

    event ExecutionFailed(
        bytes32 indexed underlyingTokenId,
        address indexed receiver, 
        uint256 amount,
        uint256 nonce
    );

    event DstSingletonRouterSet(uint256 indexed dstChainId, bytes newDstSingletonRouterAddress, address indexed caller);

    event DstRedeemGasSet(uint256 indexed dstChainId, uint64 newDstRedeemGas, address indexed caller);

    event DstDeployGasSet(uint256 indexed dstChainId, uint64 newDstDeployGas, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address masterRouter, 
        address gasEstimator,
        address singletonFactory,
        uint64 ethCallGasLimit
    ) ATSUpgradeChecker(hex'05') {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        GAS_ESTIMATOR = gasEstimator;
        SINGLETON_FACTORY = singletonFactory;
        ETH_CALL_GAS_LIMIT = ethCallGasLimit;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function bridge(
        address tokenAddress,
        bytes calldata protocolPayload,
        BridgeRequest[] calldata requests
    ) external payable whenNotPaused() returns(uint256 bridgedAmount, uint256 paymentAmount) {
        bytes32 _tokenId = tokenId(tokenAddress);

        if (_tokenId == bytes32(0)) revert SingletonRouter__E1();
        if (requests.length == 0) revert SingletonRouter__E2();

        for (uint256 i; requests.length > i; ++i) {
            bytes memory _dstSingletonRouterAddress = dstSingletonRouter(requests[i].dstChainId);

            if (requests[i].amount == 0) revert SingletonRouter__E8(); 
            if (_dstSingletonRouterAddress.length == 0) revert SingletonRouter__E3();
            if (BYTES32_LENGTH >= requests[i].receiver.length) {
                if (bytes32(requests[i].receiver) == bytes32(0)) revert SingletonRouter__E6();
            }

            uint256 _paymentAmount = _getBridgeFee(requests[i].dstChainId, protocolPayload);

            paymentAmount += _paymentAmount;
            bridgedAmount += requests[i].amount;

            IATSMasterRouter(MASTER_ROUTER).sendProposal{value: _paymentAmount}(
                dstRedeemGas(requests[i].dstChainId),
                requests[i].dstChainId, 
                abi.encode(
                    _dstSingletonRouterAddress,
                    SIMPLE_BRIDGE_MESSAGE_TYPE,
                    abi.encode(
                        _tokenId,
                        requests[i].receiver,
                        requests[i].amount
                    )
                )
            );

            emit Bridged(
                _tokenId,
                tokenAddress,
                msg.sender,
                requests[i].receiver, 
                requests[i].amount,
                requests[i].dstChainId
            );
        }

        if (paymentAmount > msg.value) revert SingletonRouter__E4();

        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), bridgedAmount);
    }

    function deployAndBridge(
        address tokenAddress,
        bytes calldata protocolPayload,
        BridgeRequest[] calldata requests
    ) external payable whenNotPaused() returns(uint256 bridgedAmount, uint256 paymentAmount) {
        bytes32 _tokenId = tokenId(tokenAddress);

        if (_tokenId == bytes32(0)) revert SingletonRouter__E1();
        if (requests.length == 0) revert SingletonRouter__E2();

        string memory _name = IERC20Metadata(tokenAddress).name();
        string memory _symbol = IERC20Metadata(tokenAddress).symbol();
        uint256 _totalSupply = IERC20(tokenAddress).totalSupply();

        for (uint256 i; requests.length > i; ++i) {
            bytes memory _dstSingletonRouterAddress = dstSingletonRouter(requests[i].dstChainId);
            if (_dstSingletonRouterAddress.length == 0) revert SingletonRouter__E3();

            uint256 _paymentAmount;

            if (requests[i].amount > 0) {
                if (BYTES32_LENGTH >= requests[i].receiver.length) {
                    if (bytes32(requests[i].receiver) == bytes32(0)) revert SingletonRouter__E6();
                }

                _paymentAmount = _getTotalFee(requests[i].dstChainId, protocolPayload);

                paymentAmount += _paymentAmount;
                bridgedAmount += requests[i].amount;

                emit Bridged(
                    _tokenId,
                    tokenAddress,
                    msg.sender,
                    requests[i].receiver, 
                    requests[i].amount,
                    requests[i].dstChainId
                );
            } else {
                _paymentAmount = _getDeployFee(requests[i].dstChainId, protocolPayload);
                paymentAmount += _paymentAmount;
            }

            IATSMasterRouter(MASTER_ROUTER).sendProposal{value: _paymentAmount}(
                requests[i].amount > 0 ? dstRedeemGas(requests[i].dstChainId) + dstDeployGas(requests[i].dstChainId) : dstDeployGas(requests[i].dstChainId),
                requests[i].dstChainId, 
                abi.encode(
                    _dstSingletonRouterAddress,
                    SIMPLE_DEPLOY_MESSAGE_TYPE,
                    abi.encode(
                        abi.encode(
                            _tokenId,
                            _name,
                            _symbol,
                            _totalSupply
                        ),
                        abi.encode(
                            _tokenId,
                            requests[i].receiver,
                            requests[i].amount
                        )
                    )
                )
            );

            emit DeployRequestSent(
                msg.sender, 
                _tokenId, 
                tokenAddress, 
                _name, 
                _symbol, 
                _totalSupply, 
                requests[i].dstChainId
            );
        }

        if (paymentAmount > msg.value) revert SingletonRouter__E4();

        if (bridgedAmount > 0) IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), bridgedAmount);
    }

    function retryRedeem(
        bytes32 underlyingTokenId, 
        address receiver, 
        uint256 amount,
        uint256 nonce
    ) external returns(bool success) {
        if (token(underlyingTokenId) == address(0)) revert SingletonRouter__E1();

        _removeFailedExecution(underlyingTokenId, receiver, amount, nonce);

        if (_executeRedeem(abi.encode(underlyingTokenId, receiver.toBytes(), amount)) != uint8(OperationResult.S_Success)) {
            revert SingletonRouter__E7();
        }

        return true;
    }

    function execute(
        uint256 srcChainId,
        address singletonRouterAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult) {
        if (msg.sender != MASTER_ROUTER) revert SingletonRouter__E5();

        if (singletonRouterAddress != address(this)) return uint8(OperationResult.InvalidDstPeerAddress);
        if (srcChainId == block.chainid) return uint8(OperationResult.InvalidSrcChainId);
        if (dstSingletonRouter(srcChainId).length == 0) return uint8(OperationResult.InvalidSrcChainId);
        if (paused()) return uint8(OperationResult.RouterPaused);

        if (messageType == SIMPLE_BRIDGE_MESSAGE_TYPE) return _executeRedeem(localParams);

        if (ISingletonFactory(SINGLETON_FACTORY).paused()) return uint8(OperationResult.RouterPaused);

        if (messageType == SIMPLE_DEPLOY_MESSAGE_TYPE) {
            (
                bytes memory _deployLocalParams, 
                bytes memory _redeemLocalParams
            ) = abi.decode(localParams, (bytes, bytes));

            opResult = _executeDeploy(_deployLocalParams);

            uint8 _redeemResultCode = _executeRedeem(_redeemLocalParams);

            if (_redeemResultCode == uint8(OperationResult.S_Success)) {
                return opResult;
            } else if (
                opResult == uint8(OperationResult.S_DeployFailed) && 
                _redeemResultCode == uint8(OperationResult.S_InvalidToAddress)
            ) {
                return uint8(OperationResult.S_DeployAndRedeemFailed);
            } else {
                return _redeemResultCode;
            }
        }

        return uint8(OperationResult.InvalidMessageType);
    }

    function addExistingToken(address tokenAddress) external onlyRole(DEPLOYER_ROLE) returns(bytes32 underlyingTokenId) {
        underlyingTokenId = generateTokenId(tokenAddress);

        if (tokenId(tokenAddress) != bytes32(0) || token(underlyingTokenId) != address(0)) revert SingletonRouter__E9();

        _addNewToken(
            underlyingTokenId, 
            tokenAddress, 
            IERC20Metadata(tokenAddress).name(), 
            IERC20Metadata(tokenAddress).symbol(), 
            IERC20(tokenAddress).totalSupply()
        );
    }

    function setDstSingletonRouter(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newDstSingletonRouter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newDstSingletonRouter.length) revert SingletonRouter__E0();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstSingletonRouter(dstChainIds[i], newDstSingletonRouter[i]);
    }

    function setDstRedeemGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstRedeemGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstRedeemGas.length) revert SingletonRouter__E0();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstRedeemGas(dstChainIds[i], newDstRedeemGas[i]);
    }

    function setDstDeployGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstDeployGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstDeployGas.length) revert SingletonRouter__E0();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstDeployGas(dstChainIds[i], newDstDeployGas[i]);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getBridgeFees(
        uint256[] calldata dstChainIds, 
        bytes calldata protocolPayload
    ) external view returns(uint256[] memory bridgeFeeAmounts, uint256 totalBridgeFeeAmount) {
        bridgeFeeAmounts = new uint256[](dstChainIds.length);

        for (uint256 i; dstChainIds.length > i; ++i) {
            uint256 _feeAmount = _getBridgeFee(dstChainIds[i], protocolPayload);
            bridgeFeeAmounts[i] = _feeAmount;
            totalBridgeFeeAmount += _feeAmount;
        }
    }

    function getDeployFees(
        uint256[] calldata dstChainIds, 
        bytes calldata protocolPayload
    ) external view returns(uint256[] memory deployFeeAmounts, uint256 totalDeployFeeAmount) {
        deployFeeAmounts = new uint256[](dstChainIds.length);

        for (uint256 i; dstChainIds.length > i; ++i) {
            uint256 _feeAmount = _getDeployFee(dstChainIds[i], protocolPayload);
            deployFeeAmounts[i] = _feeAmount;
            totalDeployFeeAmount += _feeAmount;
        }
    }

    function getDeployAndBridgeFees(
        uint256[] calldata dstChainIds, 
        bytes calldata protocolPayload
    ) external view returns(uint256[] memory deployAndBridgeFeeAmounts, uint256 totalDeployAndBridgeFeeAmounts) {
        deployAndBridgeFeeAmounts = new uint256[](dstChainIds.length);

        for (uint256 i; dstChainIds.length > i; ++i) {
            uint256 _feeAmount = _getTotalFee(dstChainIds[i], protocolPayload);
            deployAndBridgeFeeAmounts[i] = _feeAmount;
            totalDeployAndBridgeFeeAmounts += _feeAmount;
        }
    }

    function isExecutionFailed(
        bytes32 underlyingTokenId, 
        address receiver, 
        uint256 amount,
        uint256 retryNonce
    ) external view returns(bool isFailed) {
        if (receiver == address(0)) return false;

        Main storage $ = _getMainStorage();
        return $._failedExecution[keccak256(abi.encode(underlyingTokenId, receiver, amount, retryNonce))] == receiver;
    }

    function generateTokenId(address tokenAddress) public view returns(bytes32 underlyingTokenId) {
        return keccak256(abi.encode(tokenAddress.toBytes(), block.chainid));
    }

    function router() external view returns(address routerAddress) {
        return address(this);
    }

    function tokenId(address tokenAddress) public view returns(bytes32 tokenIdByAddress) {
        Main storage $ = _getMainStorage();
        return $._tokenId[tokenAddress];
    }

    function token(bytes32 underlyingTokenId) public view returns(address tokenAddressById) {
        Main storage $ = _getMainStorage();
        return $._token[underlyingTokenId];
    }

    function dstSingletonRouter(uint256 dstChainId) public view returns(bytes memory dstSingletonRouterAddress) {
        Main storage $ = _getMainStorage();
        return $._dstSingletonRouter[dstChainId];
    }

    function dstRedeemGas(uint256 dstChainId) public view returns(uint64 dstRedeemGasAmount) {
        Main storage $ = _getMainStorage();
        dstRedeemGasAmount = $._dstRedeemGas[dstChainId];
        return dstRedeemGasAmount > 0 ? dstRedeemGasAmount : DEFAULT_DST_REDEEM_GAS_AMOUNT;
    }

    function dstDeployGas(uint256 dstChainId) public view returns(uint64 dstDeployGasAmount) {
        Main storage $ = _getMainStorage(); 
        dstDeployGasAmount = $._dstDeployGas[dstChainId];
        return dstDeployGasAmount > 0 ? dstDeployGasAmount : DEFAULT_DST_DEPLOY_GAS_AMOUNT;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(ISingletonRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    function _getBridgeFee(
        uint256 dstChainId, 
        bytes calldata /* protocolPayload */
    ) internal view returns(uint256 bridgeFee) {
        return IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(dstChainId, dstRedeemGas(dstChainId));
    }

    function _getDeployFee(
        uint256 dstChainId, 
        bytes calldata /* protocolPayload */
    ) internal view returns(uint256 deployFee) {
        return IGasEstimator(GAS_ESTIMATOR).estimateExecutionWithGas(dstChainId, dstDeployGas(dstChainId));
    }

    function _getTotalFee(
        uint256 dstChainId, 
        bytes calldata protocolPayload
    ) internal view returns(uint256 totalFee) {
        return _getBridgeFee(dstChainId, protocolPayload) + _getDeployFee(dstChainId, protocolPayload);
    }

    function _executeRedeem(bytes memory localParams) internal returns(uint8 opResult) {
        (
            bytes32 _tokenId, 
            bytes memory _encodedReceiver, 
            uint256 _amount
        ) = abi.decode(localParams, (bytes32, bytes, uint256));

        if (_amount == 0) return uint8(OperationResult.S_Success);

        address _receiver = _encodedReceiver.toAddress(); 

        if (_encodedReceiver.length != 20) {
            return uint8(OperationResult.S_InvalidToAddress); 
        } else {
            if (_receiver == address(0)) return uint8(OperationResult.S_InvalidToAddress);
        }

        address _tokenAddress = token(_tokenId);

        if (_tokenAddress == address(0)) {
            _addFailedExecution(_tokenId, _receiver, _amount);

            return uint8(OperationResult.S_TokenNotExistAndStored);
        } 

        (bool _redeemResult, /* bytes memory _redeemResponse */) = _tokenAddress.call(
            abi.encodeCall(IERC20.transfer, (_receiver, _amount))
        );

        if (_redeemResult) {
            emit Redeemed(_tokenId, _tokenAddress, _receiver, _amount);

            return uint8(OperationResult.S_Success);
        } else {
            _addFailedExecution(_tokenId, _receiver, _amount);

            return uint8(OperationResult.S_FailedAndStored);
        }
    }

    function _executeDeploy(bytes memory localParams) internal returns(uint8 opResult) {
        (
            bytes32 _tokenId,
            string memory _name,
            string memory _symbol,
            uint256 _totalSupply
        ) = abi.decode(localParams, (bytes32, string, string, uint256));

        if (token(_tokenId) != address(0)) return uint8(OperationResult.S_Success);

        (bool _deployResult, bytes memory _deployResponse) = SINGLETON_FACTORY.call(
            abi.encodeCall(ISingletonFactory.deploy, (_tokenId, _name, _symbol, _totalSupply))
        );

        if (_deployResult && _deployResponse.length == BYTES32_LENGTH) {
            address _newTokenAddress = abi.decode(_deployResponse, (address));

            if (_newTokenAddress != address(0)) {
                _addNewToken(_tokenId, _newTokenAddress, _name, _symbol, _totalSupply);

                return uint8(OperationResult.S_Success);
            } else {
                return uint8(OperationResult.S_DeployFailed);
            }
        } else {
            return uint8(OperationResult.S_DeployFailed);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _addFailedExecution(
        bytes32 underlyingTokenId, 
        address receiver, 
        uint256 amount
    ) internal {
        Main storage $ = _getMainStorage();
        $._failedExecution[keccak256(abi.encode(underlyingTokenId, receiver, amount, $._retryNonce))] = receiver;

        emit ExecutionFailed(underlyingTokenId, receiver, amount, $._retryNonce);

        $._retryNonce += 1;
    }

    function _removeFailedExecution(
        bytes32 underlyingTokenId, 
        address receiver, 
        uint256 amount,
        uint256 retryNonce
    ) internal {
        Main storage $ = _getMainStorage();

        bytes32 _msgHash = keccak256(abi.encode(underlyingTokenId, receiver, amount, retryNonce));

        if ($._failedExecution[_msgHash] != receiver || receiver == address(0)) revert SingletonRouter__E7();

        delete $._failedExecution[_msgHash];
    }

    function _addNewToken(
        bytes32 underlyingTokenId, 
        address tokenAddress,
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) internal {
        Main storage $ = _getMainStorage();
        $._token[underlyingTokenId] = tokenAddress;
        $._tokenId[tokenAddress] = underlyingTokenId;

        emit NewTokenDeployed(underlyingTokenId, tokenAddress, name, symbol, totalSupply);
    }

    function _setDstSingletonRouter(uint256 dstChainId, bytes calldata newDstSingletonRouterAddress) internal {
        Main storage $ = _getMainStorage();
        $._dstSingletonRouter[dstChainId] = newDstSingletonRouterAddress;

        emit DstSingletonRouterSet(dstChainId, newDstSingletonRouterAddress, msg.sender);
    }

    function _setDstRedeemGas(uint256 dstChainId, uint64 newDstRedeemGas) internal {
        Main storage $ = _getMainStorage();
        $._dstRedeemGas[dstChainId] = newDstRedeemGas;

        emit DstRedeemGasSet(dstChainId, newDstRedeemGas, msg.sender);
    }

    function _setDstDeployGas(uint256 dstChainId, uint64 newDstDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployGas[dstChainId] = newDstDeployGas;

        emit DstDeployGasSet(dstChainId, newDstDeployGas, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}