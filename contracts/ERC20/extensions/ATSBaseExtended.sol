// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ATSBase.sol";

import "../interfaces/IATSBaseExtended.sol";

/**
 * @notice Extension of {ATSBase} that allows {ATSBase} contract owner to change {ChainConfig} settings on different 
 * destination chains with a single crosschain transaction.
 */
abstract contract ATSBaseExtended is IATSBaseExtended, ATSBase {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for address;
    
    /// @dev Library for performing various operations on the {bytes} type. 
    using BytesLib for bytes;

    /**
     * @notice Send crosschain message that will change destination {ChainConfig}.
     * @param dstChainIds destination chains Ids to which a message will be sent to change their {ChainConfig}.
     * @param newConfigs new {ChainConfig} settings for provided {allowedChainIds} to be setted on the destination chains.
     * @return success call result.
     */
    function setChainConfigToDestination(
        uint256[] calldata dstChainIds,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable returns(bool success) {
        _authorizeCall();

        if (dstChainIds.length != newConfigs.length) revert ATSBase__E4();

        bytes[] memory _dstPeers = new bytes[](dstChainIds.length);

        for (uint256 i; dstChainIds.length > i; ++i) _dstPeers[i] = _chainConfig[dstChainIds[i]].peerAddress;

        return IATSRouter(router()).requestToUpdateConfig{value: msg.value}( 
            msg.sender.toBytes(),
            dstChainIds,
            _dstPeers,
            newConfigs
        );
    }

    /**
     * @notice Sets the destination chains settings by crosschain message.
     * @param allowedChainIds chains Ids available for bridging in both directions.
     * @param chainConfigs array of new {ChainConfig} settings for provided {allowedChainIds}.
     * @param origin source chain data.
     * @dev Only the {_router} can execute this function.
     */
    function setChainConfigByRouter(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs,
        Origin calldata origin
    ) external {
        _onlyRouter();

        if (!_chainConfig[origin.chainId].peerAddress.equalStorage(origin.peerAddress)) revert ATSBase__E7();

        _setChainConfig(allowedChainIds, chainConfigs);
    }

    /**
     * @notice Returns estimated minimal amount to pay for {setChainConfigToDestination} call.
     * @param dstChainIds destination chains Ids to which a message will be sent.
     * @param configsLength {ChainConfigUpdate.allowedChainIds} length.
     * @return paymentAmount source chain native currency amount to pay for {setChainConfigToDestination} call.
     */
    function estimateUpdateFee(
        uint256[] calldata dstChainIds, 
        uint256[] calldata configsLength
    ) external view returns(uint256 paymentAmount) {
        return IATSRouter(router()).getUpdateFee(dstChainIds, configsLength);
    }

}