const ATSMasterRouterProxyModule = require("../../ignition/modules/ATSMasterRouterProxyModule");
const ATSRegistryProxyModule = require("../../ignition/modules/ATSRegistryProxyModule");

const withDecimals = ethers.parseEther;
const testCurChainId = 31337n;
const testDstChainId = 137n;

async function coreFixture() {
    const [admin, user, executor] = await ethers.getSigners();

    const minCommission = 100n;

    const EndpointMock = await ethers.getContractFactory("EndpointMock", admin);
    const endpoint = await EndpointMock.deploy();
    await endpoint.waitForDeployment();

    await endpoint.connect(admin).setMinTxGas(testCurChainId, 10000n);
    await endpoint.connect(admin).setMinCommission(minCommission);
    await endpoint.connect(admin).setTotalActiveSigners(3n);

    const GasEstimatorMock = await ethers.getContractFactory("GasEstimatorMock", admin);
    const gasEstimator = await GasEstimatorMock.deploy(endpoint.target);
    await gasEstimator.waitForDeployment();

    await endpoint.connect(admin).setGasEstimator(gasEstimator.target);

    await gasEstimator.connect(admin).setChainData(
        testCurChainId,
        [
            1n,
            18n,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002"
        ]
    );

    await gasEstimator.connect(admin).setChainData(
        testDstChainId,
        [
            1n,
            18n,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000003",
            "0x0000000000000000000000000000000000000000000000000000000000000004"
        ]
    );

    const baseFeePerGasInWei = await gasEstimator.estimateExecutionWithGas(testDstChainId, 1n);

    const initCalldata = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

    const { registryProxy } = await ignition.deploy(ATSRegistryProxyModule, {
        parameters: {
            ATSRegistryProxyModule: {
                initializeCalldata: initCalldata,
            },
        },
    });

    const { masterRouterProxy } = await ignition.deploy(ATSMasterRouterProxyModule, {
        parameters: {
            ATSMasterRouterProxyModule: {
                initializeCalldata: initCalldata,
                endpointAddress: endpoint.target,
                getRouterGasLimit: 10000
            },
        },
    });

    const registry = await ethers.getContractAt("ATSRegistry", registryProxy);
    const masterRouter = await ethers.getContractAt("ATSMasterRouter", masterRouterProxy);

    const adminRole = await registry.DEFAULT_ADMIN_ROLE();
    const approverRole = await registry.APPROVER_ROLE();
    const factoryRole = await registry.FACTORY_ROLE();
    const routerRole = await masterRouter.ROUTER_ROLE();

    await masterRouter.connect(admin).setDstMasterRouter([testDstChainId], [ethers.zeroPadValue(masterRouter.target, 32)]);

    const zeroHash = ethers.ZeroHash;
    const zeroAddress = ethers.ZeroAddress;
    const functionSelector = "0x0000000000000000000000000000000000000000000000000000000009c5eabe";

    return {
        admin, user, executor, registry, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole, endpoint, masterRouter,
        functionSelector, baseFeePerGasInWei, initCalldata, gasEstimator
    };
};

module.exports = { coreFixture, testCurChainId, testDstChainId, withDecimals };