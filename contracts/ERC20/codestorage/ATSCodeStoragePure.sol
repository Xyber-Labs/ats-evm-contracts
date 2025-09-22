// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/ATSTokenPure.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSTokenPure contract.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStoragePure is IATSCodeStorage {

    /**
     * @notice Returns the ATSTokenPure creation bytecode.
     * @return bytecode creation bytecode of the {ATSTokenPure} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(ATSTokenPure).creationCode;
    }
    
}