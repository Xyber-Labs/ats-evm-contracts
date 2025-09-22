const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testDstChainId, withDecimals } = require("./utils/ERC20Fixture");
const { deployTokenByFactory } = require("./utils/ERC20UtilFunctions");
const { globalProtocolVersion } = require("./utils/GlobalConstants");

describe("ATS Registry", function () {
    describe("Deployments", function () {
        it("AccessControl", async function () {
            const { user, admin, registry, factory } = await loadFixture(ERC20Fixture);

            expect(await registry.validateFactory(factory.target)).to.equal(true);
            expect(await registry.validateFactory(admin)).to.equal(false);
            expect(await registry.SYSTEM_CONTRACT_TYPE()).to.equal("0x01");

            await expect(registry.connect(user).approveRequestBatch([[
                admin,
                admin.address,
                admin,
                "0x0103"
            ]])).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

            await expect(registry.connect(user).registerDeployment(
                admin,
                admin.address,
                admin,
                "0x0103"
            )).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
        });

        it("Add deployment", async function () {
            const { executor, user, admin, registry, router, factory, zeroAddress, zeroHash, approverRole, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const totalDeploymentsBefore = await registry.totalDeployments();

            await registry.connect(admin).grantRole(approverRole, admin);

            const { deployedToken } = await deployTokenByFactory(
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                configMinGasLimit,
                configPeer,
                configDecimals,
                salt,
                factory,
                registry,
                zeroAddress,
                zeroHash,
                adminRole
            );

            let underlyingTokens = await registry.underlyingTokens();
            let deployments = await registry.deployments();
            let deploymentData = await registry.deploymentData(deployedToken.target);
            let deploymentByIndex = await registry.deploymentsByIndex([totalDeploymentsBefore]);
            let deploymentsByUnderlying = await registry.deploymentsByUnderlying(deployedToken.target);
            let deploymentsByDeployer = await registry.deploymentsByDeployer(user.address);
            let deploymentsByDeployerTwo = await registry.deploymentsByDeployer(executor.address);

            expect(underlyingTokens.includes(deployedToken.target)).to.equal(true);
            expect(deployments.includes(deployedToken.target)).to.equal(true);
            expect(deploymentData.deployer).to.equal(executor.address.toLowerCase());
            expect(deploymentData.underlyingToken).to.equal(deployedToken.target);
            expect(deploymentData.initProtocolVersion).to.equal(globalProtocolVersion);
            expect(deploymentByIndex[0]).to.equal(deployedToken.target);
            expect(deploymentsByUnderlying.includes(deployedToken.target)).to.equal(true);
            expect(deploymentsByDeployer.includes(deployedToken.target)).to.equal(false);
            expect(deploymentsByDeployerTwo.includes(deployedToken.target)).to.equal(true);

            expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
            expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);
            expect(await registry.totalDeployments()).to.equal(totalDeploymentsBefore + 1n);

            await registry.connect(admin).approveRequestBatch([[
                deployedToken.target,
                admin.address,
                registry.target,
                "0x0102"
            ]]);

            underlyingTokens = await registry.underlyingTokens();
            deployments = await registry.deployments();
            deploymentData = await registry.deploymentData(deployedToken.target);
            deploymentByIndex = await registry.deploymentsByIndex([totalDeploymentsBefore]);
            let deploymentByIndexNew = await registry.deploymentsByIndex([totalDeploymentsBefore + 1n]);
            let deploymentsByUnderlyingOld = await registry.deploymentsByUnderlying(deployedToken.target);
            let deploymentsByDeployerOld = await registry.deploymentsByDeployer(user.address);
            deploymentsByDeployer = await registry.deploymentsByDeployer(admin.address);
            const deploymentsByIndexNew = await registry.deploymentsByIndex([totalDeploymentsBefore, totalDeploymentsBefore + 1n]);

            expect(underlyingTokens.includes(deployedToken.target)).to.equal(true);
            expect(deployments.includes(deployedToken.target)).to.equal(true);
            expect(deploymentData.deployer).to.equal(admin.address.toLowerCase());
            expect(deploymentData.underlyingToken).to.equal(deployedToken.target);
            expect(deploymentData.initProtocolVersion).to.equal("0x0102");
            expect(deploymentByIndex[0]).to.equal(deployedToken.target);
            expect(deploymentByIndexNew[0]).to.equal(zeroAddress);
            expect(deploymentsByIndexNew[0]).to.equal(deployedToken.target);
            expect(deploymentsByIndexNew[1]).to.equal(zeroAddress);
            expect(deploymentsByDeployer.includes(deployedToken.target)).to.equal(true);
            expect(deploymentsByUnderlyingOld.includes(deployedToken.target)).to.equal(true);
            expect(deploymentsByDeployerOld.includes(deployedToken.target)).to.equal(false);

            expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
            expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);
            expect(await registry.totalDeployments()).to.equal(totalDeploymentsBefore + 1n);

            await registry.connect(admin).approveRequestBatch([[
                deployedToken.target,
                admin.address,
                admin,
                "0x0103"
            ]]);

            underlyingTokens = await registry.underlyingTokens();
            deployments = await registry.deployments();
            deploymentData = await registry.deploymentData(deployedToken.target);
            deploymentByIndex = await registry.deploymentsByIndex([totalDeploymentsBefore]);
            deploymentByIndexNew = await registry.deploymentsByIndex([totalDeploymentsBefore + 1n]);
            deploymentsByUnderlyingOld = await registry.deploymentsByUnderlying(deployedToken.target);
            deploymentsByDeployerOld = await registry.deploymentsByDeployer(user.address);
            deploymentsByDeployer = await registry.deploymentsByDeployer(admin.address);

            expect(underlyingTokens.includes(deployedToken.target)).to.equal(true);
            expect(deployments.includes(deployedToken.target)).to.equal(true);
            expect(deploymentData.deployer).to.equal(admin.address.toLowerCase());
            expect(deploymentData.underlyingToken).to.equal(deployedToken.target);
            expect(deploymentData.initProtocolVersion).to.equal("0x0103");
            expect(deploymentByIndex[0]).to.equal(deployedToken.target);
            expect(deploymentByIndexNew[0]).to.equal(zeroAddress);
            expect(deploymentsByDeployer.includes(deployedToken.target)).to.equal(true);
            expect(deploymentsByUnderlyingOld.includes(deployedToken.target)).to.equal(true);
            expect(deploymentsByDeployerOld.includes(deployedToken.target)).to.equal(false);

            expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
            expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);
            expect(await registry.totalDeployments()).to.equal(totalDeploymentsBefore + 1n);
        });

        it("ATS Registry E0", async function () {
            const { admin, registry, approverRole, factoryRole } = await loadFixture(ERC20Fixture);

            await registry.connect(admin).grantRole(approverRole, admin);
            await registry.connect(admin).grantRole(factoryRole, admin);

            await expect(registry.connect(admin).approveRequestBatch([[
                admin,
                "0x",
                admin,
                "0x0103"
            ]])).to.be.revertedWithCustomError(registry, "ATSRegistry__E0");

            await expect(registry.connect(admin).registerDeployment(
                admin,
                "0x",
                admin,
                "0x0103"
            )).to.be.revertedWithCustomError(registry, "ATSRegistry__E0");
        });

        it("ATS Registry E1", async function () {
            const { registry, admin } = await loadFixture(ERC20Fixture);

            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const gasLimit = 1000000n;

            const chainConfigs = [[configPeer, gasLimit, configDecimals, false]];

            await expect(registry.connect(admin).updateChainConfigs(
                allowedChainIds,
                chainConfigs
            )).to.be.revertedWithCustomError(registry, "ATSRegistry__E1");

            await expect(registry.connect(admin).updateRouter(
                admin
            )).to.be.revertedWithCustomError(registry, "ATSRegistry__E1");
        });
    });
});