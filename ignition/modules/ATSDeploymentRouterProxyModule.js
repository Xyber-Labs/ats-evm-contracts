const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ATSDeploymentRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const gasEstimatorAddress = m.getParameter("gasEstimatorAddress");
    const factoryAddress = m.getParameter("factoryAddress");
    const registryAddress = m.getParameter("registryAddress");
    const availableChainsNumber = m.getParameter("availableChainsNumber");
    const ethCallGasLimit = m.getParameter("ethCallGasLimit");

    const dRouterImplementation = m.contract(
        "ATSDeploymentRouter",
        [
            masterRouterAddress,
            gasEstimatorAddress,
            factoryAddress,
            registryAddress,
            availableChainsNumber,
            ethCallGasLimit
        ]
    );

    const dRouterProxy = m.contract('ERC1967Proxy', [dRouterImplementation, initializeCalldata]);

    return { dRouterImplementation, dRouterProxy };
});