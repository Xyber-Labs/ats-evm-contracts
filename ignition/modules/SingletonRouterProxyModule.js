const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SingletonRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const gasEstimatorAddress = m.getParameter("gasEstimatorAddress");
    const singletonFactoryAddress = m.getParameter("singletonFactoryAddress");
    const paymentTransferGasLimit = m.getParameter("paymentTransferGasLimit");

    const singletonRouterImplementation = m.contract("SingletonRouter", [masterRouterAddress, gasEstimatorAddress, singletonFactoryAddress, paymentTransferGasLimit]);

    const singletonRouterProxy = m.contract('ERC1967Proxy', [singletonRouterImplementation, initializeCalldata]);

    return { singletonRouterImplementation, singletonRouterProxy };
});