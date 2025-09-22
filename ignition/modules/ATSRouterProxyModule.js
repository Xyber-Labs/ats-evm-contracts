const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ATSRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const gasEstimatorAddress = m.getParameter("gasEstimatorAddress");
    const storeGasLimit = m.getParameter("storeGasLimit");
    const serviceGas = m.getParameter("serviceGas");
    const updateGasLimit = m.getParameter("updateGasLimit");
    const ethCallGasLimit = m.getParameter("ethCallGasLimit");

    const routerImplementation = m.contract("ATSRouter", [masterRouterAddress, gasEstimatorAddress, storeGasLimit, serviceGas, updateGasLimit, ethCallGasLimit]);

    const routerProxy = m.contract('ERC1967Proxy', [routerImplementation, initializeCalldata]);

    return { routerImplementation, routerProxy };
});