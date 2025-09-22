// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../ATSBase.sol";

/**
 * @notice A showcase ERC20 compliant token contract with integrated functionality to use ATS protocol crosschain 
 * messaging for bridging this token itself.  
 *
 * @dev A contract implements and overrides the minimum functionality for correct running and interaction with the ATS protocol.
 * A mint/burn mechanism is used to send and receive {ATSTokenWithLogicShowcase} ERC20 token crosschain bridges.
 * Also added some custom logic for using {ATSERC20DataTypes.Origin} and {customPayload} as an example:
 *     1. the extended list of receivers
 *     2. emitting custom events for multi-bridge transactions
 *
 * IMPORTANT: This is an example contract, that uses an unaudited code. Do not use this code in production before covering by tests.
 */
contract ATSTokenWithLogicShowcase is ATSBase, ERC20, Ownable {

    /// @dev Library for {address} converting, since in crosschain messaging its represented as {bytes} type.
    using AddressConverter for bytes;

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error ATSTokenWithLogicShowcase__E0();

    /// @notice Indicates an error that the provided {_receiver} address is empty address.
    error ATSTokenWithLogicShowcase__E1();

    /// @notice Indicates an error that the sum of provided {_amounts} is not equal {amount}.
    error ATSTokenWithLogicShowcase__E2();

    /**
     * @notice Emitted when crosschain multi-bridge message is successfully sent to a destination chain.
     * @param spender the caller address who initiate the bridge.
     * @param from tokens holder on the current chain.
     * @param dstPeerAddressIndexed indexed destination {peerAddress}.
     * @param dstPeerAddress destination {peerAddress}.
     * @param receivers bridged tokens receivers on the destination chain.
     * @param amounts bridged tokens amounts.
     * @param dstChainId destination chain Id.
     */
    event MultiBridged(
        address indexed spender, 
        address from, 
        bytes indexed dstPeerAddressIndexed, 
        bytes dstPeerAddress,
        bytes[] receivers, 
        uint256[] amounts,
        uint256 indexed dstChainId
    );

    /**
     * @notice Emitted when tokens are successfully redeemed from the source chain.
     * @param receiversIndexed indexed tokens receivers on the current chain.
     * @param receivers tokens receivers on the current chain.
     * @param amounts received amounts.
     * @param srcPeerAddressIndexed indexed source {peerAddress}.
     * @param srcPeerAddress source {peerAddress}.
     * @param srcChainId source chain Id.
     * @param sender source chain sender's address.
     */
    event MultiRedeemed(
        address[] indexed receiversIndexed, 
        address[] receivers,
        uint256[] amounts, 
        bytes indexed srcPeerAddressIndexed, 
        bytes srcPeerAddress,
        uint256 indexed srcChainId,
        bytes sender
    );

    /**
     * @notice Initializes basic settings.
     * @param _router address of the authorized {ATSRouter} contract.
     * @param _allowedChainIds chains Ids available for bridging in both directions.
     * @param _chainConfigs {ChainConfig} settings for provided {_allowedChainIds}.
     * @dev See the {ATSERC20DataTypes.ChainConfig} for details.
     *
     * @dev Since this contract is a token itself, its underlying token address will be {address(this)}.
     */
    constructor(
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs
    ) Ownable(msg.sender) ERC20("ATS Token With Logic Showcase", "TWL") {
        __ATSBase_init(address(this), decimals());

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);

        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Overridden function that burn tokens from tokens holder {from} address.
     * @param spender {bridge} transaction initiator {msg.sender}.
     * @param from tokens holder on the current chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @param customPayload in that case encoded arrays of receivers and amounts.
     * @return bridgedAmount bridged tokens amount, that will be released on the destination chain.
     * @dev {bridgedAmount} value may be different from {amount}, in case amount modifies by fee collecting or any 
     * other custom logic. Returned {bridgedAmount} value will be actually used for crosschain message.
     *
     * @dev To ensure that the {spender} is not using someone else's tokens to bridge to itself, an {ERC20.allowance} 
     * check MUST be added.
     */
    function _burnFrom(
        address spender,
        address from, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory customPayload
    ) internal override returns(uint256 bridgedAmount) {
        if (from != spender) _spendAllowance(from, spender, amount);

        _update(from, address(0), amount);

        // This is just an example of how multi-bridge can be implemented.
        if (customPayload.length > 0) {
            // {address} type array can be used here if the token will exist only in EVM-compatible chains.
            (bytes[] memory _receivers, uint256[] memory _amounts) = abi.decode(customPayload, (bytes[], uint256[]));

            // Some basic checks are added here:
            //     1. the {_receivers} and {_amounts} arrays lengths are the same
            //     2. the {_receivers} addresses are not empty
            //     3. the sum of {_amounts} is equal to {amount}

            if (_receivers.length != _amounts.length) revert ATSTokenWithLogicShowcase__E0();

            uint256 _amountsSum;

            for (uint256 i; _receivers.length > i; ++i) {
                if (_receivers[i].length == 0) revert ATSTokenWithLogicShowcase__E1();

                _amountsSum += _amounts[i];
            }

            if (amount != _amountsSum) revert ATSTokenWithLogicShowcase__E2();

            ChainConfig memory config = _chainConfig[dstChainId];

            emit MultiBridged(spender, from, config.peerAddress, config.peerAddress, _receivers, _amounts, dstChainId);
        }

        return amount;
    }

    /**
     * @notice Overridden function that mint tokens to receiver {to} address or to {_receivers} addresses.
     * @param to tokens receiver on the current chain.
     * @param amount amount that {to} address will be received.
     * @param customPayload in that case can be encoded arrays of receivers and amounts.
     * @param origin source chain data.
     * @dev See the {ATSERC20DataTypes.Origin} for details.
     * @return receivedAmount amount that {to} address received.
     * @dev {receivedAmount} value may be different from {amount}, in case amount modifies by fee collecting or any 
     * other custom logic.
     *
     * @dev Depending on {customPayload}, transfer tokens to the corresponding receivers, expecting that the necessary 
     * checks are implemented in the {_burnFrom} function.
     */
    function _mintTo(
        address to,
        uint256 amount,
        bytes memory customPayload,
        Origin memory origin
    ) internal override returns(uint256 receivedAmount) {
        if (customPayload.length > 0) {
            (bytes[] memory _receiversInBytes, uint256[] memory _amounts) = abi.decode(customPayload, (bytes[], uint256[]));

            address[] memory _receivers = new address[](_receiversInBytes.length);

            for (uint256 i; _receiversInBytes.length > i; ++i) {
                _receivers[i] = _receiversInBytes[i].toAddress();
                _update(address(0), _receivers[i], _amounts[i]);
            }

            emit MultiRedeemed(
                _receivers, 
                _receivers,
                _amounts, 
                origin.peerAddress, 
                origin.peerAddress,
                origin.chainId,
                origin.sender
            );

        } else {
            _update(address(0), to, amount);
        }

        return amount;
    }

    /**
     * @notice The function is overridden only to include access restriction to the {setRouter} and {setChainConfig} functions.
     */
    function _authorizeCall() internal override onlyOwner() {
        
    }

}