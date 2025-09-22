const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SingletonFactoryProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const singletonRouterAddress = m.getParameter("singletonRouterAddress");

    const singletonFactoryImplementation = m.contract("SingletonFactory", [singletonRouterAddress]);

    const singletonFactoryProxy = m.contract('ERC1967Proxy', [singletonFactoryImplementation, initializeCalldata]);

    return { singletonFactoryImplementation, singletonFactoryProxy };
});