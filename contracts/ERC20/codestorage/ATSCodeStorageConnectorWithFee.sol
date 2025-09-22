// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../connector/ATSConnectorWithFee.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSConnectorWithFee contract.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStorageConnectorWithFee is IATSCodeStorage {

    /**
     * @notice Returns the ATSConnectorWithFee creation bytecode.
     * @return bytecode creation bytecode of the {ATSConnectorWithFee} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(ATSConnectorWithFee).creationCode;
    }
    
}