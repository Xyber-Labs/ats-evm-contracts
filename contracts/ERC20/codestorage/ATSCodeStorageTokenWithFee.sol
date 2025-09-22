// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/ATSTokenWithFee.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSTokenWithFee contract.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStorageTokenWithFee is IATSCodeStorage {

    /**
     * @notice Returns the ATSTokenWithFee creation bytecode.
     * @return bytecode creation bytecode of the {ATSTokenWithFee} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(ATSTokenWithFee).creationCode;
    }
    
}