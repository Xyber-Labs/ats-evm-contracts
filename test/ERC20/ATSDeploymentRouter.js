const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/ERC20Fixture");
const { globalProtocolVersion, routerBridgeMessageType } = require("../utils/GlobalConstants");
const {
    convertToBytes, encodeParamsToDeployToken, encodeParamsToDeployConnector,
    encodeParamsToDeploy, validateDeployFee, deployTokenByFactory, AbiCoder
} = require("../utils/ERC20UtilFunctions");

describe("ATS DeploymentRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { dRouter, factory, masterRouter, registry, deployTokenGas, deployConnectorGas } = await loadFixture(ERC20Fixture);

            expect(await dRouter.dstFactory(testDstChainId)).to.equal(factory.target.toLowerCase());
            expect(await dRouter.MASTER_ROUTER()).to.equal(masterRouter.target);
            expect(await dRouter.FACTORY()).to.equal(factory.target);
            expect(await dRouter.REGISTRY()).to.equal(registry.target);
            expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(deployTokenGas);
            expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(deployConnectorGas);
            expect(await dRouter.protocolVersion()).to.equal(globalProtocolVersion);
            expect(await dRouter.SYSTEM_CONTRACT_TYPE()).to.equal("0x04");
        });
    });

    describe("Pausable", function () {
        it("sendDeployRequest", async function () {
            const { admin, router, dRouter, pauserRole } = await loadFixture(ERC20Fixture);

            const [tokenDeployParams, ,] = await encodeParamsToDeployToken(
                dRouter,
                admin,
                admin,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await dRouter.paused()).to.equal(false);

            await dRouter.connect(admin).grantRole(pauserRole, admin);
            await dRouter.connect(admin).pause();

            expect(await dRouter.paused()).to.equal(true);

            await expect(dRouter.connect(admin).sendDeployRequest([[
                testDstChainId,
                false,
                tokenDeployParams
            ]], admin.address, { value: withDecimals("1") }
            )).to.be.revertedWithCustomError(dRouter, "EnforcedPause");

            await dRouter.connect(admin).unpause();

            expect(await dRouter.paused()).to.equal(false);

            const tokenChainIds = [testDstChainId];
            const connectorChainIds = [];
            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            await dRouter.connect(admin).sendDeployRequest(
                [[
                    testDstChainId,
                    false,
                    tokenDeployParams
                ]], admin.address, { value: withDecimals("1") }
            );
        });

        it("execute", async function () {
            const { endpoint, user, factory, functionSelector, masterRouter, zeroHash, admin, router, dRouter, pauserRole } = await loadFixture(ERC20Fixture);

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await dRouter.paused()).to.equal(false);

            await dRouter.connect(admin).grantRole(pauserRole, admin);
            await dRouter.connect(admin).pause();

            expect(await dRouter.paused()).to.equal(true);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                3n,
                factory.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            await dRouter.connect(admin).unpause();

            expect(await dRouter.paused()).to.equal(false);

            const tx = await endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            );
            await tx.wait();

            const filter = factory.filters.Deployed;
            const events = await factory.queryFilter(filter, -1);
            const args = events[events.length - 1].args;

            const deployedToken = await ethers.getContractAt("ATSToken", args[0]);

            expect(args[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(args[4]).to.equal(args[0]);
            expect(await deployedToken.name()).to.equal("name");
        });
    });

    describe("AccessControl", function () {
        it("pause", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).pause(
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("unpause", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).unpause(
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstDeployConfig", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).setDstDeployConfig(
                [testDstChainId],
                [[ethers.zeroPadValue(user.address, 32), 99999n, 99999n, 0n]]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstDeployGas", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).setDstDeployGas(
                [1], [1], [1]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstProtocolFee", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).setDstProtocolFee(
                [1], [1]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstFactory", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const newChainId = 999;

            await expect(dRouter.connect(user).setDstFactory(
                [newChainId],
                [newAddress]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });
    });

    describe("sendDeployRequest", function () {
        it("ATS DeploymentRouter E0", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).sendDeployRequest(
                [], dRouter.target
            )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E0");
        });

        it("ATS DeploymentRouter E1", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [138, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E1");
        });

        it("ATS DeploymentRouter E3", async function () {
            const { user, router, dRouter } = await loadFixture(ERC20Fixture);

            let tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [1],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [["0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00", 1, 1, false]],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

            let connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [1],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, true, connectorDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

            connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [],
                [["0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00", 1, 1, false]],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, true, connectorDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams], [137, true, connectorDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");
        });

        it("ATS DeploymentRouter E4", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            let tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                false,
                true,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                false,
                false,
                true,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                true,
                true,
                true,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E4");

            const tokenDeployParamsTwo = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParamsTwo], [137, false, tokenDeployParams]
            ], dRouter.target, { value: withDecimals("1") })).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E4");
        });

        it("ATS DeploymentRouter E5", async function () {
            const { admin, masterRouter, router, user, dRouter, zeroAddress, factory, managerRole } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).setDstMasterRouter(
                [137, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await dRouter.connect(admin).setDstFactory(
                [137, 56],
                [ethers.zeroPadValue(factory.target, 32), ethers.zeroPadValue(factory.target, 32)]
            );

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstDeployGas(
                [137, 56],
                [3300000n, 3300000n],
                [2500000n, 2500000n]
            );

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams]],
                zeroAddress
            )).to.be.revertedWithoutReason();

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams]],
                dRouter.target
            )).to.be.revertedWithoutReason();

            let paymentAmount = await dRouter.estimateDeployTotal([137], []);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams]],
                dRouter.target,
                { value: paymentAmount[1] - 1n }
            )).to.be.revertedWithoutReason();

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            paymentAmount = await dRouter.estimateDeployTotal([137], [56]);

            await dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams], [56, true, connectorDeployParams]],
                dRouter.target,
                { value: paymentAmount[1] * 10n }
            );

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams], [56, true, connectorDeployParams]],
                dRouter.target,
                { value: paymentAmount[1] - 1n }
            )).to.be.revertedWithoutReason();
        });

        it("ATS DeploymentRouter E6", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            let tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000001,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E6");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                0,
                1,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E6");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000001,
                false,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E6");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                0,
                1,
                false,
                false,
                true,
                false,
                true,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E6");
        });

        it("ATS DeploymentRouter E7", async function () {
            const { justToken, executor, factory, user, router, dRouter } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00ff";
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const config = [configPeer, 150000n, 18, true];

            const chainIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
            const configs = [config, config, config, config, config, config, config, config, config, config, config, config, config]

            const [tokenDeployParams, ,] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                false,
                true,
                true,
                true,
                router,
                chainIds,
                configs,
                salt
            );

            const [connectorDeployParams, ,] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                true,
                router,
                chainIds,
                configs,
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E7");

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, true, connectorDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E7");
        });

        it("Should revert by wrong encoded params", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                salt
            ]);

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [],
                [],
                salt
            ]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, tokenDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, connectorDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, salt]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, salt]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, tokenDeployParams], [testDstChainId, false, tokenDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, connectorDeployParams], [testDstChainId, true, connectorDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, salt], [testDstChainId, false, tokenDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, salt], [testDstChainId, false, tokenDeployParams]], dRouter.target
            )).to.be.reverted;
        });

        it("Single token deploy current chain case", async function () {
            const { masterRouter, factory, registry, router, user, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            expect(await registry.totalDeployments()).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams]
            ], user.address);

            const tokenChainIds = [testCurChainId];
            const connectorChainIds = [];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            await tx.wait();
            const filter = factory.filters.Deployed;
            const events = await factory.queryFilter(filter, -1);
            const args = events[0].args;

            const deployedToken = await ethers.getContractAt("ATSToken", args[0]);

            expect(args[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(args[4]).to.equal(args[0]);
            expect(await deployedToken.name()).to.equal("name");
            expect(await deployedToken.decimals()).to.equal(18n);

            expect(await registry.totalDeployments()).to.equal(1n);

            const data = await registry.deploymentData(deployedToken.target);

            expect(data.deployer).to.equal(user.address.toLowerCase());
            expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
            expect(data.underlyingToken).to.equal(deployedToken.target);
        });

        it("Single connector deploy current chain case", async function () {
            const { masterRouter, factory, registry, justToken, router, user, dRouter } = await loadFixture(ERC20Fixture);

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                justToken.target,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            expect(await registry.totalDeployments()).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, true, connectorDeployParams]
            ], user.address);

            const tokenChainIds = [];
            const connectorChainIds = [testCurChainId];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            await tx.wait();
            const filter = factory.filters.Deployed;
            const events = await factory.queryFilter(filter, -1);
            const args = events[0].args;

            const deployedConnector = await ethers.getContractAt("ATSConnector", args[0]);

            expect(args[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(args[4]).to.equal(justToken.target);
            expect(await deployedConnector.underlyingToken()).to.equal(justToken.target);

            expect(await registry.totalDeployments()).to.equal(1n);

            const data = await registry.deploymentData(deployedConnector.target);

            expect(data.deployer).to.equal(user.address.toLowerCase());
            expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
            expect(data.underlyingToken).to.equal(justToken.target);
        });

        it("Single token deploy remote chain case", async function () {
            const { gasEstimator, masterRouter, admin, endpoint, factory, registry, router, user, dRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const estimateValue = await gasEstimator.estimateExecutionWithGas(testDstChainId, await dRouter.dstTokenDeployGas(testDstChainId));

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                await dRouter.dstTokenDeployGas(testDstChainId)
            ]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, tokenDeployParams]],
                admin.address,
                { value: withDecimals("1") })
            ).to.emit(endpoint, "MessageProposed").withArgs(
                testDstChainId,
                estimateValue,
                functionSelector,
                transmitterParams,
                anyValue,
                ethers.zeroPadValue(masterRouter.target, 32),
                params,
                "0x"
            );

            expect(await registry.totalDeployments()).to.equal(0n);
        });

        it("Single connector deploy remote chain case", async function () {
            const { gasEstimator, justToken, masterRouter, admin, endpoint, factory, registry, router, user, dRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const [connectorDeployParams, , params] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const estimateValue = await gasEstimator.estimateExecutionWithGas(testDstChainId, await dRouter.dstConnectorDeployGas(testDstChainId));

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                await dRouter.dstConnectorDeployGas(testDstChainId)
            ]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, connectorDeployParams]],
                admin.address,
                { value: withDecimals("1") })
            ).to.emit(endpoint, "MessageProposed").withArgs(
                testDstChainId,
                estimateValue,
                functionSelector,
                transmitterParams,
                anyValue,
                ethers.zeroPadValue(masterRouter.target, 32),
                params,
                "0x"
            );

            expect(await registry.totalDeployments()).to.equal(0n);
        });

        it("Multi deploy remote chain case", async function () {
            const { justToken, masterRouter, admin, endpoint, factory, registry, router, user, dRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const [tokenDeployParams, , paramsT] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                true,
                true,
                false,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const [connectorDeployParams, , paramsC] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            await expect(dRouter.connect(user).sendDeployRequest([
                [testDstChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams]
            ], admin.address, { value: withDecimals("1") })).to.emit(endpoint, "MessageProposed").withArgs(
                testDstChainId,
                anyValue,
                functionSelector,
                anyValue,
                anyValue,
                ethers.zeroPadValue(masterRouter.target, 32),
                paramsT,
                "0x"
            ).to.emit(endpoint, "MessageProposed").withArgs(
                testDstChainId,
                anyValue,
                functionSelector,
                anyValue,
                anyValue,
                ethers.zeroPadValue(masterRouter.target, 32),
                paramsC,
                "0x"
            );

            expect(await registry.totalDeployments()).to.equal(0n);
        });

        it("Multi deploy arbitrary chain case native payment", async function () {
            const { deployTokenGas, deployConnectorGas, justToken, masterRouter, admin, endpoint, zeroAddress, factory, registry, router, user, dRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const testDstChainIdTwo = 100n;

            await masterRouter.connect(admin).setDstMasterRouter([testDstChainIdTwo], [ethers.zeroPadValue(masterRouter.target, 32)]);

            await dRouter.connect(admin).setDstDeployConfig(
                [testDstChainIdTwo],
                [[factory.target, deployTokenGas, deployConnectorGas, 0n]]
            );

            const etherBalanceBefore = await ethers.provider.getBalance(user.address);

            const [tokenDeployParams, ,] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const [connectorDeployParams, , paramsC] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const tokenChainIds = [testCurChainId, testDstChainIdTwo];
            const connectorChainIds = [testCurChainId, testDstChainId];
            validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            const deployFee = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);
            const deployFeeNative = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);

            expect(deployFee[1]).to.equal(deployFeeNative[2]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams],
                [testDstChainIdTwo, false, tokenDeployParams],
                [testCurChainId, true, connectorDeployParams]
            ], zeroAddress, { value: deployFee[1] - 1n }
            )).to.be.revertedWithoutReason();

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams],
                [testDstChainIdTwo, false, tokenDeployParams],
                [testCurChainId, true, connectorDeployParams]
            ], zeroAddress, { value: deployFee[1] });

            expect(etherBalanceBefore - deployFee[1]).to.above(await ethers.provider.getBalance(user.address));

            await tx.wait();
            const filterE = endpoint.filters.MessageProposed;
            const eventsE = await endpoint.queryFilter(filterE, -1);
            const argsCD = eventsE[0].args;
            const argsTD = eventsE[1].args;

            const filterF = factory.filters.Deployed;
            const eventsF = await factory.queryFilter(filterF, -1);
            const argsTC = eventsF[0].args;
            const argsCC = eventsF[1].args;

            expect(argsTD[0]).to.equal(testDstChainIdTwo);
            expect(argsTD[2]).to.equal(functionSelector);
            expect(argsTD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsTD[5]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));

            expect(argsCD[0]).to.equal(testDstChainId);
            expect(argsCD[2]).to.equal(functionSelector);
            expect(argsCD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsCD[5]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));

            const deployedToken = await ethers.getContractAt("ATSToken", argsTC[0]);

            expect(argsTC[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(argsTC[4]).to.equal(argsTC[0]);
            expect(await deployedToken.name()).to.equal("name");

            const deployedConnector = await ethers.getContractAt("ATSConnector", argsCC[0]);

            expect(argsCC[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(argsCC[4]).to.equal(justToken.target);
            expect(await deployedConnector.underlyingToken()).to.equal(justToken.target);

            expect(await registry.totalDeployments()).to.equal(2n);
            expect(etherBalanceBefore).to.above(await ethers.provider.getBalance(user.address));
        });
    });

    describe("execute", function () {
        it("ATS DeploymentRouter E2", async function () {
            const { admin, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(admin).execute(
                0,
                admin,
                "0xff",
                "0x"
            )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E2");
        });

        it("Should return error code by zero factory address", async function () {
            const { zeroAddress, endpoint, user, functionSelector, masterRouter, zeroHash, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                zeroAddress,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                5n,
                zeroAddress,
                zeroAddress,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by EOA factory address", async function () {
            const { endpoint, user, functionSelector, masterRouter, zeroHash, zeroAddress, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                user,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                5n,
                user.address,
                zeroAddress,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by incompatible router type", async function () {
            const { adminRole, zeroAddress, registry, factory, executor, endpoint, user, functionSelector, masterRouter, zeroHash, router } = await loadFixture(ERC20Fixture);

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

            const tokenDeployParams = AbiCoder.encode([
                "tuple(bytes, string, string, uint8, uint256, bool, bool, bool, bool, bool, bytes, uint256[], tuple(bytes, uint64, uint8, bool)[], bytes32)"
            ], [[
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]]);

            const localParams = AbiCoder.encode([
                "bool",
                "bytes",
                "bytes"
            ], [
                false,
                user.address,
                tokenDeployParams
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                deployedToken.target,
                routerBridgeMessageType,
                localParams
            ]);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                10n,
                deployedToken.target,
                router.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by router zero address", async function () {
            const { routerRole, adminRole, zeroAddress, registry, factory, executor, endpoint, user, functionSelector, masterRouter, zeroHash, admin, router, dRouter } = await loadFixture(ERC20Fixture);

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

            await deployedToken.connect(user).setRouter(zeroAddress);
            await masterRouter.connect(admin).grantRole(routerRole, zeroAddress);

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                deployedToken,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                10n,
                deployedToken.target,
                zeroAddress,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by unauthorized factory", async function () {
            const { mockRouter, endpoint, user, functionSelector, masterRouter, zeroHash, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion(globalProtocolVersion);
            await mockRouter.setRouter(dRouter.target);

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                mockRouter,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                4n,
                mockRouter.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by invalid token deploy params", async function () {
            const { justToken, factory, endpoint, user, functionSelector, masterRouter, zeroHash, router, dRouter } = await loadFixture(ERC20Fixture);

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                justToken.target,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            const [, params] = await encodeParamsToDeploy(factory, false, user, connectorDeployParams);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                9n,
                factory.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by invalid connector deploy params", async function () {
            const { factory, endpoint, user, functionSelector, masterRouter, zeroHash, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                admin.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            const [, params] = await encodeParamsToDeploy(factory, true, user, tokenDeployParams);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                9n,
                factory.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by deploy to same address", async function () {
            const { adminRole, registry, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, zeroAddress, router, dRouter } = await loadFixture(ERC20Fixture);

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

            await deployTokenByFactory(
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

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                false,
                false,
                false,
                router,
                [],
                [],
                salt
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                9n,
                factory.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by paused factory", async function () {
            const { admin, pauserRole, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, router, dRouter } = await loadFixture(ERC20Fixture);

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

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                chainConfigs,
                salt
            );

            await factory.connect(admin).grantRole(pauserRole, admin);
            await factory.connect(admin).pause();

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                3n,
                factory.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by invalid protocol version", async function () {
            const { factory, endpoint, user, functionSelector, masterRouter, zeroHash, router, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            const localParams = AbiCoder.encode([
                "bool",
                "bytes",
                "bytes"
            ], [
                false,
                user.address,
                tokenDeployParams
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                factory.target,
                "0xff",
                localParams
            ]);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testDstChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                12n,
                factory.target,
                dRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by invalid source chain Id", async function () {
            const { admin, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, router, dRouter, zeroAddress } = await loadFixture(ERC20Fixture);

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

            await masterRouter.connect(admin).setDstMasterRouter(
                [testCurChainId],
                ["0x00"]
            );

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            const [, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                chainConfigs,
                salt
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (testCurChainId) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                13n,
                zeroAddress,
                zeroAddress,
                params,
                testCurChainId,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });
    });

    describe("estimateDeployTotal", function () {
        it("Math test", async function () {
            const { admin, dRouter, deployTokenGas, deployConnectorGas, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            let tokenChainIds = [1n, 10n, 56n];
            let connectorChainIds = [testCurChainId, 10n, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstDeployGas(
                connectorChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            tokenChainIds = [56n, 100n, 81457n];
            connectorChainIds = [];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstProtocolFee([56n, 100n, 81457n], [1n, 111n, 999n]);

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            tokenChainIds = [];
            connectorChainIds = [];

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            tokenChainIds = [1n, 56n, testDstChainId];
            connectorChainIds = [81457n, 559999n, 17n];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstDeployGas(
                connectorChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstProtocolFee([81457n, 56n, testDstChainId], [100n, 0n, 7690n]);

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);

            tokenChainIds = [1n, testCurChainId, 56n, testDstChainId, 81457n, 5000n, 8453n];
            connectorChainIds = [testCurChainId, 559999n, 17n, 1n];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstDeployGas(
                connectorChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 5000n, 17n], [1000n, 3n, 7690n]);

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, dRouter);
        });

        it("Master test", async function () {
            const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const paymentAmount = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

            expect(paymentAmount[0]).to.equal(0n);
            expect(paymentAmount[1]).to.equal(56103855944n);
        });
    });

    describe("estimateDeployNative", function () {
        it("Master test", async function () {
            const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const deploymentsPayment = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);
            const deploymentsPaymentTotal = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

            expect(deploymentsPayment[0][0]).to.equal(34000000n);
            expect(deploymentsPayment[0][1]).to.equal(10000000n);
            expect(deploymentsPayment[0][2]).to.equal(56000055944n);
            expect(deploymentsPayment[1][0]).to.equal(0n);
            expect(deploymentsPayment[1][1]).to.equal(5000000n);
            expect(deploymentsPayment[1][2]).to.equal(54800000n);
            expect(deploymentsPayment[2]).to.equal(56103855944n);
            expect(deploymentsPayment[2]).to.equal(deploymentsPaymentTotal[1]);
        });

        it("Compare test", async function () {
            const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const deploymentsPayment = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);
            const deploymentsPaymentTotal = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

            expect(deploymentsPayment[2]).to.equal(56103855944n);
            expect(deploymentsPayment[2]).to.equal(deploymentsPaymentTotal[1]);
        });
    });

    describe("Admin's functions", function () {
        describe("setDstProtocolFee", function () {
            it("Base test", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstProtocolFee([1], [1]);

                expect(await dRouter.dstProtocolFee(1)).to.equal(1);

                await dRouter.connect(admin).setDstProtocolFee([1, testDstChainId], [9, 999]);

                expect(await dRouter.dstProtocolFee(1)).to.equal(9);
                expect(await dRouter.dstProtocolFee(testDstChainId)).to.equal(999);
            });

            it("ATS DeploymentRouter E3", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await expect(dRouter.connect(admin).setDstProtocolFee(
                    [1], [1, 2]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstProtocolFee(
                    [1, 2], [1]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");
            });
        });

        describe("setDstDeployConfig", function () {
            it("Base test", async function () {
                const { admin, dRouter } = await loadFixture(ERC20Fixture);

                const newConfig = [
                    ethers.zeroPadValue(dRouter.target, 32),
                    8889789n,
                    1234567n,
                    3333n
                ];

                await dRouter.connect(admin).setDstDeployConfig(
                    [testDstChainId],
                    [newConfig]
                );

                expect(await dRouter.dstDeployConfig(testDstChainId)).to.eql(newConfig);
            });

            it("ATS DeploymentRouter E3", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                const newConfig = [
                    ethers.zeroPadValue(dRouter.target, 32),
                    8889789n,
                    1234567n,
                    3333n
                ];

                await expect(dRouter.connect(admin).setDstDeployConfig(
                    [1, 2], [newConfig]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstDeployConfig(
                    [1], [newConfig, newConfig]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");
            });
        });

        describe("setDstDeployGas", function () {
            it("Base test", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstDeployGas(
                    [testDstChainId, testCurChainId],
                    [1000n, 888n],
                    [500n, 777n]
                );

                expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(1000n);
                expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(500n);
                expect(await dRouter.dstTokenDeployGas(testCurChainId)).to.equal(888n);
                expect(await dRouter.dstConnectorDeployGas(testCurChainId)).to.equal(777n);
            });

            it("ATS DeploymentRouter E3", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await expect(dRouter.connect(admin).setDstDeployGas(
                    [1, 2], [1], [1, 2]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstDeployGas(
                    [1, 2], [1, 2], [1]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");
            });
        });

        describe("setDstFactory", function () {
            it("Base test", async function () {
                const { admin, dRouter } = await loadFixture(ERC20Fixture);

                const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const newChainId = 999;

                await dRouter.connect(admin).setDstFactory(
                    [newChainId],
                    [newAddress]
                );

                expect(await dRouter.dstFactory(newChainId)).to.equal(newAddress);
            });

            it("ATS DeploymentRouter E3", async function () {
                const { admin, dRouter } = await loadFixture(ERC20Fixture);

                const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const newChainId = 999;

                await expect(dRouter.connect(admin).setDstFactory(
                    [newChainId, 1],
                    [newAddress]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstFactory(
                    [newChainId],
                    [newAddress, newAddress]
                )).to.be.revertedWithCustomError(dRouter, "ATSDeploymentRouter__E3");

                await dRouter.connect(admin).setDstFactory([newChainId, testCurChainId], [newAddress, newAddress]);

                expect(await dRouter.dstFactory(newChainId)).to.equal(newAddress);
                expect(await dRouter.dstFactory(testCurChainId)).to.equal(newAddress);
            });
        });
    });
});