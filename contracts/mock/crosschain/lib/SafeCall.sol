// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SafeCall {

    function safeCall(
        address _target,
        uint256 _gas,
        uint256 _value,
        uint16 _maxCopy,
        bytes memory _calldata
    ) internal returns (bool, bytes memory) {
        uint256 _toCopy;
        bool _success;
        bytes memory _returnData = new bytes(_maxCopy);
        assembly {
            _success := call(
                _gas,
                _target,
                _value,
                add(_calldata, 0x20), 
                mload(_calldata),
                0, 
                0 
            )

            _toCopy := returndatasize()
            if gt(_toCopy, _maxCopy) {
                _toCopy := _maxCopy
            }

            mstore(_returnData, _toCopy)

            returndatacopy(add(_returnData, 0x20), 0, _toCopy)
        }
        return (_success, _returnData);
    }
}
