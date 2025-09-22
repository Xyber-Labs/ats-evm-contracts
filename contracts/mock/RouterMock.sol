// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../libraries/AddressConverter.sol";

import "../ERC20/interfaces/IATSBaseExtended.sol";
import "../ERC20/interfaces/IATSRouter.sol";

contract RouterMock {
    using AddressConverter for *;

    bytes2 public protocolVersion;
    address public router;

    function setProtocolVersion(bytes2 newProtocolVersion) external {
        protocolVersion = newProtocolVersion;
    }

    function setRouter(address newRouter) external {
        router = newRouter;
    }

    function bridge(
        address target,
        bytes calldata dstToken,
        bytes calldata to,
        uint256 amount,
        uint8 decimals,
        uint256 chainId,
        uint64 gasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success, uint256) {
        success = IATSRouter(target).bridge{value: msg.value}(
            dstToken,
            msg.sender.toBytes(),
            to,
            amount,
            decimals,
            chainId,
            gasLimit,
            customPayload,
            protocolPayload
        );

        return (success, amount);
    }

    function redeem(
        address target,
        address to, 
        uint256 amount, 
        Origin calldata origin
    ) external {
        IATSBase(target).redeem(to, amount, "", origin);
    }

    function setChainConfigToDestination(
        address target,
        bytes calldata sender,
        uint256[] calldata dstChainIds,
        bytes[] calldata dstPeers,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable returns(bool) {
        return IATSRouter(target).requestToUpdateConfig{value: msg.value}( 
            sender,
            dstChainIds,
            dstPeers,
            newConfigs
        );
    }

    function setChainConfigByRouter(
        address target,
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs,
        Origin calldata origin
    ) external {
        IATSBaseExtended(target).setChainConfigByRouter(allowedChainIds, chainConfigs, origin);
    }

}