// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IATSMasterRouter {

    function validateRouter(address target) external view returns(bool isAuthorized);

    function dstMasterRouter(uint256 dstChainId) external view returns(bytes memory dstMasterRouterAddress);

    function sendProposal(uint256 dstGasLimit, uint256 dstChainId, bytes calldata params) external payable;

    function execute(bytes calldata data) external payable;

    function setDstMasterRouter(uint256[] calldata dstChainIds, bytes[] calldata newDstMasterRouter) external;

    function pause() external;

    function unpause() external;

}