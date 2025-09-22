// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

import "../interfaces/IATSUpgradeChecker.sol";

abstract contract ATSUpgradeChecker is IATSUpgradeChecker {

    bytes1 public immutable SYSTEM_CONTRACT_TYPE;

    error ATSUpgradeChecker__E0(); // invalid {newImplementation} contract

    constructor(bytes1 contractType) {
        SYSTEM_CONTRACT_TYPE = contractType;
    }

    function _checkContractType(address newImplementation) internal view virtual {
        if (IATSUpgradeChecker(newImplementation).SYSTEM_CONTRACT_TYPE() != SYSTEM_CONTRACT_TYPE) {
            revert ATSUpgradeChecker__E0();
        }

        if (!IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId)) {
            revert ATSUpgradeChecker__E0();
        }
    }

}