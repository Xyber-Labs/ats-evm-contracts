const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ATSMasterRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const endpointAddress = m.getParameter("endpointAddress");
    const getRouterGasLimit = m.getParameter("getRouterGasLimit");

    const masterRouterImplementation = m.contract("ATSMasterRouter", [endpointAddress, getRouterGasLimit]);

    const masterRouterProxy = m.contract('ERC1967Proxy', [masterRouterImplementation, initializeCalldata]);

    return { masterRouterImplementation, masterRouterProxy };
});