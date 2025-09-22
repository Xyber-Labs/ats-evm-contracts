// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../ERC20/token/ERC20Burnable.sol";
import "../ERC20/token/ATSToken.sol";
import "./ERC20Mock.sol";

contract ATSTokenMock is ERC20Burnable {

    error ATSTokenMock__E0(bytes);
    error ATSTokenMock__E1();

    address public router;

    mapping(bytes32 msgHash => address to) private _failedExecution;

    constructor(address _router) {
        __ERC20_init("1", "1");
        router = _router;
    }

    function redeem(
        address /* to */,
        uint256 /* amount */,
        bytes calldata /* customPayload */,
        Origin calldata /* origin */
    ) external payable returns(bool) {
        revert ATSTokenMock__E1();
    }

    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        bytes calldata result
    ) external {
        bytes memory code = abi.encodePacked(type(ERC20Mock).creationCode);
        _failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, result.length))] = to;

        revert ATSTokenMock__E0(code);
    }

    function isExecutionFailed(
        address to, 
        uint256 amount, 
        bytes calldata customPayload, 
        Origin calldata origin,
        uint256 nonce
    ) external view returns(bool) {
        return _failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, nonce))] == to;
    }
}

contract ATSTokenMockTwo is ERC20Burnable {

    uint256 private _retryNonce;
    address public router;
    uint8  internal _decimals;

    mapping(uint256 chainId => ChainConfig dstChainConfig) internal _chainConfig;
    mapping(bytes32 msgHash => address receiverAddress) private _failedExecution;

    error ATSTokenMock__E0(bytes);

    event ExecutionFailed(
        address indexed to, 
        uint256 amount, 
        bytes customPayload, 
        Origin indexed originIndexed, 
        Origin origin,
        bytes indexed result, 
        uint256 nonce
    );

    constructor(address _router) {
        router = _router;
        _retryNonce++;
    }

    function redeem(
        address /* to */,
        uint256 /* amount */,
        bytes calldata /* customPayload */,
        Origin calldata /* origin */
    ) external payable returns(bool) {
        bytes memory code = abi.encodePacked(type(ERC20Mock).creationCode);

        revert ATSTokenMock__E0(code);
    }

    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        bytes calldata result
    ) external {

        emit ExecutionFailed(to, amount, customPayload, origin, origin, result, _retryNonce);

        _failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, _retryNonce))] = to;

        _retryNonce++;
    }

    function isExecutionFailed(
        address to, 
        uint256 amount, 
        bytes calldata customPayload, 
        Origin calldata origin,
        uint256 nonce
    ) external view virtual returns(bool) {
        if (to == address(0)) return false;
        return _failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, nonce))] == to;
    }
}