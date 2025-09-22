const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testCurChainId, testDstChainId } = require("./utils/ERC20Fixture");
const { globalProtocolVersion } = require("./utils/GlobalConstants");

describe("Proxies test", function () {
    it("Base test", async function () {
        const { admin, adminRole, user, factory, router, registry, approverRole, masterRouter, dRouter, deployTokenGas, deployConnectorGas } = await loadFixture(ERC20Fixture);

        expect(await masterRouter.hasRole(adminRole, admin)).to.equal(true);
        expect(await registry.hasRole(adminRole, admin)).to.equal(true);
        expect(await factory.hasRole(adminRole, admin)).to.equal(true);
        expect(await dRouter.hasRole(adminRole, admin)).to.equal(true);
        expect(await router.hasRole(adminRole, admin)).to.equal(true);

        await expect(masterRouter.connect(user).upgradeToAndCall(
            registry.target,
            "0x"
        )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

        await expect(factory.connect(user).upgradeToAndCall(
            registry.target,
            "0x"
        )).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");

        await expect(registry.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

        await expect(router.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

        await expect(dRouter.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");

        await expect(masterRouter.connect(user).initialize(
            user,
            user
        )).to.be.revertedWithCustomError(masterRouter, "InvalidInitialization");

        await expect(factory.connect(user).initialize(
            user,
            user
        )).to.be.revertedWithCustomError(factory, "InvalidInitialization");

        await expect(registry.connect(user).initialize(
            user
        )).to.be.revertedWithCustomError(registry, "InvalidInitialization");

        await expect(router.connect(user).initialize(
            user,
            user
        )).to.be.revertedWithCustomError(router, "InvalidInitialization");

        await expect(dRouter.connect(user).initialize(
            user
        )).to.be.revertedWithCustomError(dRouter, "InvalidInitialization");

        await expect(router.connect(user).pause()).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");
        await expect(router.connect(user).unpause()).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");
        await expect(factory.connect(user).pause()).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
        await expect(factory.connect(user).unpause()).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
        await expect(dRouter.connect(user).pause()).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        await expect(dRouter.connect(user).unpause()).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");

        expect(await factory.router()).to.equal(dRouter.target);
        expect(await router.MASTER_ROUTER()).to.equal(masterRouter.target);
        expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(deployTokenGas);
        expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(deployConnectorGas);

        expect(await router.protocolVersion()).to.equal(globalProtocolVersion);
        expect(await factory.protocolVersion()).to.equal(globalProtocolVersion);
        expect(await dRouter.protocolVersion()).to.equal(globalProtocolVersion);

        expect(await router.paused()).to.equal(false);
        expect(await factory.paused()).to.equal(false);
        expect(await dRouter.paused()).to.equal(false);

        const RegistryImplMockTwo = await ethers.getContractFactory("RegistryImplMockTwo", admin);
        const mockImplRegistryTwo = await RegistryImplMockTwo.deploy();
        await mockImplRegistryTwo.waitForDeployment();

        const MasterRouterImplMockTwo = await ethers.getContractFactory("MasterRouterImplMockTwo", admin);
        const mockImplMasterRouterTwo = await MasterRouterImplMockTwo.deploy();
        await mockImplMasterRouterTwo.waitForDeployment();

        const RouterImplMockTwo = await ethers.getContractFactory("RouterImplMockTwo", admin);
        const mockImplRouterTwo = await RouterImplMockTwo.deploy();
        await mockImplRouterTwo.waitForDeployment();

        const RouterImplMockThree = await ethers.getContractFactory("RouterImplMockThree", admin);
        const mockImplRouterThree = await RouterImplMockThree.deploy();
        await mockImplRouterThree.waitForDeployment();

        const FactoryImplMockTwo = await ethers.getContractFactory("FactoryImplMockTwo", admin);
        const mockImplFactoryTwo = await FactoryImplMockTwo.deploy();
        await mockImplFactoryTwo.waitForDeployment();

        const FactoryImplMockThree = await ethers.getContractFactory("FactoryImplMockThree", admin);
        const mockImplFactoryThree = await FactoryImplMockThree.deploy();
        await mockImplFactoryThree.waitForDeployment();

        const DeploymentRouterImplMockTwo = await ethers.getContractFactory("DeploymentRouterImplMockTwo", admin);
        const mockImplDeploymentRouterTwo = await DeploymentRouterImplMockTwo.deploy();
        await mockImplDeploymentRouterTwo.waitForDeployment();

        const DeploymentRouterImplMockThree = await ethers.getContractFactory("DeploymentRouterImplMockThree", admin);
        const mockImplDeploymentRouterThree = await DeploymentRouterImplMockThree.deploy();
        await mockImplDeploymentRouterThree.waitForDeployment();

        const RouterImplMock = await ethers.getContractFactory("RouterImplMock", admin);
        const mockImplRouter = await RouterImplMock.deploy();
        await mockImplRouter.waitForDeployment();

        const MasterRouterImplMock = await ethers.getContractFactory("MasterRouterImplMock", admin);
        const mockImplMasterRouter = await MasterRouterImplMock.deploy();
        await mockImplMasterRouter.waitForDeployment();

        const FactoryImplMock = await ethers.getContractFactory("FactoryImplMock", admin);
        const mockImplFactory = await FactoryImplMock.deploy();
        await mockImplFactory.waitForDeployment();

        const RegistryImplMock = await ethers.getContractFactory("RegistryImplMock", admin);
        const mockImplRegistry = await RegistryImplMock.deploy();
        await mockImplRegistry.waitForDeployment();

        const DeploymentRouterImplMock = await ethers.getContractFactory("DeploymentRouterImplMock", admin);
        const mockImplDeploymentRouter = await DeploymentRouterImplMock.deploy();
        await mockImplDeploymentRouter.waitForDeployment();

        await expect(registry.connect(admin).upgradeToAndCall(
            mockImplRouter.target, "0x"
        )).to.be.revertedWithoutReason();

        await expect(masterRouter.connect(admin).upgradeToAndCall(
            mockImplRouter.target, "0x"
        )).to.be.revertedWithoutReason();

        await expect(router.connect(admin).upgradeToAndCall(
            mockImplFactory.target, "0x"
        )).to.be.revertedWithoutReason();

        await expect(factory.connect(admin).upgradeToAndCall(
            mockImplRouter.target, "0x"
        )).to.be.revertedWithoutReason();

        await expect(dRouter.connect(admin).upgradeToAndCall(
            mockImplRouter.target, "0x"
        )).to.be.revertedWithoutReason();

        await registry.connect(admin).grantRole(approverRole, admin);

        await registry.connect(admin).approveRequestBatch([[
            registry.target,
            admin.address,
            registry.target,
            globalProtocolVersion
        ]]);

        expect(await registry.totalDeployments()).to.equal(1n);
    });
});