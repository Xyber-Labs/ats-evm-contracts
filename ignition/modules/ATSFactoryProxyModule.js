const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ATSFactoryProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const registryAddress = m.getParameter("registryAddress");

    const factoryImplementation = m.contract("ATSFactory", [masterRouterAddress, registryAddress]);

    const factoryProxy = m.contract('ERC1967Proxy', [factoryImplementation, initializeCalldata]);

    return { factoryImplementation, factoryProxy };
});