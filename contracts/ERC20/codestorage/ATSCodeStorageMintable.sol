// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/ATSTokenMintable.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSTokenMintable contract.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStorageMintable is IATSCodeStorage {

    /**
     * @notice Returns the ATSTokenMintable creation bytecode.
     * @return bytecode creation bytecode of the {ATSTokenMintable} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(ATSTokenMintable).creationCode;
    }
    
}