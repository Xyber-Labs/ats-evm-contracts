// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/ATSTokenMintableWithFee.sol";

import "../interfaces/IATSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for ATSTokenMintableWithFee contract.
 *
 * The bytecode is used by the {ATSFactory} for deployment.
 */
contract ATSCodeStorageMintableWithFee is IATSCodeStorage {

    /**
     * @notice Returns the ATSTokenMintableWithFee creation bytecode.
     * @return bytecode creation bytecode of the {ATSTokenMintableWithFee} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(ATSTokenMintableWithFee).creationCode;
    }
    
}