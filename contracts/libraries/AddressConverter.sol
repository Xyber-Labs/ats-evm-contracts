// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice A library contains utility functions for converting address type for the ATS protocol.
 */
library AddressConverter {

    function toBytes(address _address) internal pure returns(bytes memory) {
        return abi.encodePacked(_address);
    }

    function toAddress(bytes memory _params) internal pure returns(address) {
        return address(uint160(bytes20(_params)));
    }

    function toAddressPadded(bytes memory _params) internal pure returns(address addressPadded) {
        if (32 > _params.length) return address(0);

        assembly {
            addressPadded := div(mload(add(add(_params, 0x20), 12)), 0x1000000000000000000000000)
        }
    }

}