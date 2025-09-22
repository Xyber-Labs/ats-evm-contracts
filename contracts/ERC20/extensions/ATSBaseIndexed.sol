// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ATSBaseExtended.sol";

interface IATSFactory {

    function REGISTRY() external view returns(address);

}

interface IATSRegistry {

    function updateChainConfigs(uint256[] calldata allowedChainIds, ChainConfig[] calldata chainConfigs) external;

    function updateRouter(address newRouter) external;

}

/**
 * @notice Extension of {ATSBase} that adds an external calls to emit events in the {ATSRegistry} to log crucial data
 * off-chain.
 *
 * @dev Сan only be used by contracts deployed by {ATSFactory} or contracts manually registered in the {ATSRegistry}.
 */
abstract contract ATSBaseIndexed is ATSBaseExtended {

    /// @notice The {ATSRegistry} contract address.
    address private immutable REGISTRY;

    /// @notice Initializes immutable {REGISTRY} variable.
    constructor() {
        REGISTRY = IATSFactory(msg.sender).REGISTRY();
    }

    function _setChainConfig(uint256[] memory allowedChainIds, ChainConfig[] memory chainConfigs) internal virtual override {

        IATSRegistry(REGISTRY).updateChainConfigs(allowedChainIds, chainConfigs);

        super._setChainConfig(allowedChainIds, chainConfigs);
    }

    function _setRouter(address newRouter) internal virtual override {

        IATSRegistry(REGISTRY).updateRouter(newRouter);

        super._setRouter(newRouter);
    }

}