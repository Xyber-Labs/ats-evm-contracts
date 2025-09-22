const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const ATSDeploymentRouterProxyModule = require("../../ignition/modules/ATSDeploymentRouterProxyModule");
const ATSFactoryProxyModule = require("../../ignition/modules/ATSFactoryProxyModule");
const ATSRouterProxyModule = require("../../ignition/modules/ATSRouterProxyModule");
const ATSCodeStorageModule = require("../../ignition/modules/ATSCodeStorageModule");

const { coreFixture, testCurChainId, testDstChainId, withDecimals } = require("./CoreFixture");

async function ERC20Fixture() {
    const {
        admin, user, executor, registry, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole, endpoint, masterRouter,
        functionSelector, baseFeePerGasInWei, initCalldata, gasEstimator
    } = await loadFixture(coreFixture);

    const { factoryProxy } = await ignition.deploy(ATSFactoryProxyModule, {
        parameters: {
            ATSFactoryProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                registryAddress: registry.target,
            },
        },
    });

    const { routerProxy } = await ignition.deploy(ATSRouterProxyModule, {
        parameters: {
            ATSRouterProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                gasEstimatorAddress: gasEstimator.target,
                storeGasLimit: 50000,
                serviceGas: 3000,
                updateGasLimit: 70000,
                ethCallGasLimit: 3000
            },
        },
    });

    const { dRouterProxy } = await ignition.deploy(ATSDeploymentRouterProxyModule, {
        parameters: {
            ATSDeploymentRouterProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                gasEstimatorAddress: gasEstimator.target,
                factoryAddress: factoryProxy.target,
                registryAddress: registry.target,
                availableChainsNumber: 12,
                ethCallGasLimit: 3000
            },
        },
    });

    const {
        codeStorage,
        codeStorageMintable,
        codeStorageTokenWithFee,
        codeStorageMintableWithFee,
        codeStoragePure,
        codeStorageConnectorWithFee,
        codeStorageConnectorNative
    } = await ignition.deploy(ATSCodeStorageModule);

    const factory = await ethers.getContractAt("ATSFactory", factoryProxy);
    const router = await ethers.getContractAt("ATSRouter", routerProxy);
    const dRouter = await ethers.getContractAt("ATSDeploymentRouter", dRouterProxy);

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock", admin);
    const justToken = await ERC20Mock.deploy(18);
    await justToken.waitForDeployment();

    const RouterMock = await ethers.getContractFactory("RouterMock", admin);
    const mockRouter = await RouterMock.deploy();
    await mockRouter.waitForDeployment();

    const pauserRole = await factory.PAUSER_ROLE();
    const managerRole = await router.MANAGER_ROLE();

    const minGasLimit = 285000n;
    const deployTokenGas = 5000000n;
    const deployConnectorGas = 4400000n;

    await factory.connect(admin).setCodeStorage(
        [0, 1, 2, 3, 4, 5, 6],
        [
            codeStorage.target,
            codeStorageMintable.target,
            codeStorageTokenWithFee.target,
            codeStorageMintableWithFee.target,
            codeStoragePure.target,
            codeStorageConnectorWithFee.target,
            codeStorageConnectorNative.target
        ]
    );

    await masterRouter.connect(admin).grantRole(routerRole, router.target);
    await masterRouter.connect(admin).grantRole(routerRole, dRouter.target);
    await registry.connect(admin).grantRole(factoryRole, factory.target);
    await factory.connect(admin).setRouter(dRouter.target);

    await router.connect(admin).grantRole(managerRole, admin);
    await router.connect(admin).setDstMinGasLimit([testDstChainId], [minGasLimit]);

    await dRouter.connect(admin).setDstDeployConfig(
        [testDstChainId],
        [[factory.target, deployTokenGas, deployConnectorGas, 0n]]
    );

    await justToken.connect(admin).transfer(user, withDecimals("10000"));
    await justToken.connect(admin).transfer(executor, withDecimals("10000"));

    const nativeAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    return {
        admin, user, executor, factory, router, registry, justToken, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole,
        mockRouter, endpoint, masterRouter, functionSelector, pauserRole, managerRole, minGasLimit, baseFeePerGasInWei, dRouter, deployTokenGas,
        deployConnectorGas, codeStorage, codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, codeStoragePure, gasEstimator,
        codeStorageConnectorWithFee, codeStorageConnectorNative, nativeAddress
    };
};

module.exports = { ERC20Fixture, testCurChainId, testDstChainId, withDecimals };