// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "./mock/crosschain/interfaces/IEndpoint.sol";
import "./mock/crosschain/MessageReceiver.sol";

import "./libraries/BytesLib.sol";
import "./libraries/AddressConverter.sol";
import "./libraries/ATSCoreDataTypes.sol";
import "./libraries/ATSUpgradeChecker.sol";

import "./interfaces/IATSMasterRouter.sol";
import "./ERC20/interfaces/IATSRouter.sol";

/**
 * @notice A contract manages the upper layer sending and receiving of all crosschain messages via ATS protocol.
 *
 * @dev It is an implementation of {ATSMasterRouter} for UUPS.
 */
contract ATSMasterRouter is IATSMasterRouter, ATSUpgradeChecker, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, MessageReceiver {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for bytes;

    using BytesLib for bytes;

    /// @notice {AccessControl} role identifier for ATS router addresses.
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    
    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Internal function identifier for {ATSMasterRouter.execute(bytes calldata data)}.
    bytes32 private constant FUNCTION_SELECTOR = 0x0000000000000000000000000000000000000000000000000000000009c5eabe;

    /// @notice Address of the {EndPoint} contract.
    address private immutable ENDPOINT;

    /// @notice The gas limit for {router} function call in the {executeProposal} function.
    uint64 private immutable GET_ROUTER_GAS_LIMIT;

    /// @custom:storage-location erc7201:ATSProtocol.storage.ATSMasterRouter.Main
    struct Main {
        mapping(uint256 chainId => bytes dstMasterRouterAddress) _dstMasterRouter;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("ATSProtocol.storage.ATSMasterRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3abf3d58cc9e55ebb44c67e01e6f624d157bd395fd4eda846af5988472e5d800;

    /// @notice Indicates an error that the function caller is not the {ENDPOINT}.
    error ATSMasterRouter__E0();
    
    /// @notice Indicates an error that the provided {dstChainId} is not supported.
    error ATSMasterRouter__E2();

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error ATSMasterRouter__E3();

    /**
     * @notice Emitted when the {_dstMasterRouter} contract address is updated.
     * @param chainId destination chain Id.
     * @param newDstMasterRouter new {_dstMasterRouter} address for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstMasterRouter}.
     */
    event DstMasterRouterSet(uint256 indexed chainId, bytes newDstMasterRouter, address indexed caller);

    /**
     * @notice Emitted when received crosschain message is executed.
     * @param OperationResult the execution result code, represented as a uint8(ATSCoreDataTypes.OperationResult).
     * @param dstPeerAddress current chain target contract address, e.g. {ATSToken} or {ATSFactory}.
     * @param router target contract's {router}, e.g. {ATSRouter}.
     * @param params abi.encoded local execution params.
     * @param srcChainId source message chain Id.
     * @param srcOpTxId source message transaction hash.
     */
    event ProposalExecuted(
        uint8 indexed OperationResult, 
        address indexed dstPeerAddress, 
        address router, 
        bytes params,
        uint256 indexed srcChainId,
        bytes32[2] srcOpTxId
    );

    /**
     * @notice Initializes immutable variables.
     * @param endpoint {EndPoint} contract address.
     * @param getRouterGasLimit the gas limit for {router} function call in the {executeProposal} function.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(address endpoint, uint64 getRouterGasLimit) ATSUpgradeChecker(hex'00') {
        _disableInitializers();

        ENDPOINT = endpoint;
        GET_ROUTER_GAS_LIMIT = getRouterGasLimit;
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     * @param defaultAdmin initial {DEFAULT_ADMIN_ROLE} address.
     */
    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Sends a crosschain message to the destination chain.
     * @param dstGasLimit {execute} call gas limit on the destination chain.
     * @param dstChainId destination chain Id.
     * @param params abi.encoded local execution params.
     * @dev Only addresses with the {ROUTER_ROLE} can execute this function.
     */
    function sendProposal(
        uint256 dstGasLimit,
        uint256 dstChainId,
        bytes calldata params
    ) external payable onlyRole(ROUTER_ROLE) whenNotPaused() {
        if (dstChainId == block.chainid) revert ATSMasterRouter__E2();
        bytes memory _dstMasterRouterAddress = dstMasterRouter(dstChainId);
        if (_dstMasterRouterAddress.length == 0) revert ATSMasterRouter__E2();

        IEndpoint(ENDPOINT).propose{value: msg.value}(
            dstChainId,
            FUNCTION_SELECTOR,
            abi.encode(uint256(1), dstGasLimit),
            _dstMasterRouterAddress,
            params
        );
    }

    /**
     * @notice Executes a crosschain message received from {ATSMasterRouter} on source chain via messenger and 
     * directs execution to the appropriate ATS router.
     * @param data abi.encoded execution params.
     * @dev Only {ENDPOINT} can execute this function.
     */
    function execute(bytes calldata data) external payable override(IATSMasterRouter, MessageReceiver) {
        if (msg.sender != ENDPOINT) revert ATSMasterRouter__E0();

        (uint256 _srcChainId, bytes32 _srcTxHash, bytes memory _srcSender, bytes memory _params) = _decode(data);
        bytes memory _srcMasterRouterAddress = dstMasterRouter(_srcChainId);
        bytes32[2] memory _srcOpTxId;

        _srcOpTxId[0] = _srcTxHash;

        if (
            !_srcMasterRouterAddress.equal(_srcSender) ||
            _srcMasterRouterAddress.length == 0 ||
            _srcChainId == block.chainid
        ) {
            emit ProposalExecuted(
                uint8(OperationResult.InvalidSrcMasterRouter), 
                address(0), 
                address(0), 
                _params, 
                _srcChainId, 
                _srcOpTxId
            );
        } else {
            ( 
                bytes memory _dstPeer, 
                bytes1 _messageType,
                bytes memory _localParams
            ) = abi.decode(_params, (bytes, bytes1, bytes));

            (
                address _dstPeerAddress, 
                address _router, 
                uint8 _opResult
            ) = (_dstPeer.toAddress(), address(0), uint8(OperationResult.Success));

            (
                bool _getRouterResult,
                bytes memory _getRouterResponse
            ) = _dstPeerAddress.staticcall{gas: GET_ROUTER_GAS_LIMIT}(abi.encodeWithSignature("router()"));

            if (_getRouterResult && _getRouterResponse.length > 0) {
                _router = _getRouterResponse.toAddressPadded();

                if (!paused()) {
                    if (hasRole(ROUTER_ROLE, _router)) {
                        (bool _executeResult, bytes memory _executeResponse) = _router.call(
                            abi.encodeCall(IATSRouter.execute, (_srcChainId, _dstPeerAddress, _messageType, _localParams))
                        );

                        if (_executeResult && _executeResponse.length > 0) {
                            _opResult = abi.decode(_executeResponse, (uint8));
                        } else {
                            _opResult = uint8(OperationResult.IncompatibleRouter);
                        }
                    } else {
                        _opResult = uint8(OperationResult.UnauthorizedRouter);
                    }
                } else {
                    _opResult = uint8(OperationResult.MasterRouterPaused);
                }
            } else {
                _opResult = uint8(OperationResult.InvalidDstPeerAddress);
            }

            emit ProposalExecuted(_opResult, _dstPeerAddress, _router, _params, _srcChainId, _srcOpTxId);
        }
    }

    /**
     * @notice Sets the destination {ATSMasterRouter} contract addresses.
     * @param dstChainIds destination chain Ids.
     * @param newDstMasterRouter new {ATSMasterRouter} addresses on the corresponding {dstChainId}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     * @dev The {ATSMasterRouter} address MUST be represented as abi.encode(address) for EVM compatible chains.
     */
    function setDstMasterRouter(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newDstMasterRouter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newDstMasterRouter.length) revert ATSMasterRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstMasterRouter(dstChainIds[i], newDstMasterRouter[i]);
    }

    /**
     * @notice Pauses the {sendProposal} and {executeProposal} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {sendProposal} and {executeProposal} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Returns whether provided {target} address has the {AccessControl.ROUTER_ROLE}.
     * @param target target contract address.
     * @return isAuthorized result.
     */
    function validateRouter(address target) external view returns(bool isAuthorized) {
        return hasRole(ROUTER_ROLE, target);
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IATSMasterRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the destination {ATSMasterRouter} contract address.
     * @param dstChainId destination chain Id.
     * @return dstMasterRouterAddress {ATSMasterRouter} address on the corresponding {dstChainId}.
     */
    function dstMasterRouter(uint256 dstChainId) public view returns(bytes memory dstMasterRouterAddress) {
        Main storage $ = _getMainStorage();
        return $._dstMasterRouter[dstChainId];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _setDstMasterRouter(uint256 dstChainId, bytes memory newDstMasterRouter) internal {
        Main storage $ = _getMainStorage();
        $._dstMasterRouter[dstChainId] = newDstMasterRouter;

        emit DstMasterRouterSet(dstChainId, newDstMasterRouter, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}