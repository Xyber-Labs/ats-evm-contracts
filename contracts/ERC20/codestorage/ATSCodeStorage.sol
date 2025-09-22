// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/ATSToken.sol";
import "../connector/ATSConnector.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSConnector and ATSToken contracts.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStorage is IATSCodeStorage {

    /**
     * @notice Returns the creation bytecode for a specified contract type.
     * @param isConnector flag indicating whether to return the creation bytecode for the {ATSConnector} or {ATSToken} contract.
     * @return bytecode creation bytecode of the specified contract type.
     */
    function getCode(bool isConnector) external pure returns(bytes memory bytecode) {
        return isConnector ? type(ATSConnector).creationCode : type(ATSToken).creationCode;
    }
    
}