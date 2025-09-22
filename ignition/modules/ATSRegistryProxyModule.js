const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ATSRegistryProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");

    const registryImplementation = m.contract("ATSRegistry");

    const registryProxy = m.contract('ERC1967Proxy', [registryImplementation, initializeCalldata]);

    return { registryImplementation, registryProxy };
});