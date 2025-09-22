// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../connector/ATSConnectorNative.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSConnectorNative contract.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStorageConnectorNative is IATSCodeStorage {

    /**
     * @notice Returns the ATSConnectorNative creation bytecode.
     * @return bytecode creation bytecode of the {ATSConnectorNative} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(ATSConnectorNative).creationCode;
    }
    
}