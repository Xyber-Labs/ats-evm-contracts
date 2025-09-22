// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library TransmitterParamsLib {

    struct TransmitterParams {
        uint256 blockFinalizationOption;
        uint256 customGasLimit;
    }

    function encode(TransmitterParamsLib.TransmitterParams memory params) internal pure returns(bytes memory packedParams) {
        return abi.encode(params.blockFinalizationOption, params.customGasLimit);
    }

    function decode(bytes calldata packedParams) internal pure returns(TransmitterParamsLib.TransmitterParams memory params) {
        (params.blockFinalizationOption, params.customGasLimit) = abi.decode(packedParams, (uint256, uint256));
    }

    function blockFinalizationOption(bytes calldata packedParams) internal pure returns(uint256 waitFor) {
        (waitFor, ) = abi.decode(packedParams, (uint256, uint256));
    }

    function customGasLimit(bytes memory packedParams) internal pure returns(uint256 gasLimit) {
        (, gasLimit) = abi.decode(packedParams, (uint256, uint256));
    }
}
