const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { convert, encodeParamsToRedeem, encodeParamsToUpdateConfig, deployTokenByFactory, deployConnectorByFactory, deployNativeConnectorByFactory, AbiCoder } = require("../utils/ERC20UtilFunctions");
const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/ERC20Fixture");
const { globalProtocolVersion, routerUpdateMessageType } = require("../utils/GlobalConstants");

describe("ATS Base", function () {
    describe("ATS Base E2", function () {
        it("Token", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, routerRole, mockRouter, masterRouter } = await loadFixture(ERC20Fixture);

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

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedToken.connect(user).setRouter(mockRouter.target);

            await expect(mockRouter.connect(user).redeem(
                deployedToken.target,
                zeroAddress,
                1,
                [user.address, allowedChainIds[0], configPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E2");
        });

        it("Connector", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, routerRole, mockRouter, masterRouter } = await loadFixture(ERC20Fixture);

            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedConnector.connect(user).setRouter(mockRouter.target);

            await expect(mockRouter.connect(user).redeem(
                deployedConnector.target,
                zeroAddress,
                1,
                [user.address, allowedChainIds[0], configPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E2");
        });
    });

    describe("ATS Base E3", function () {
        it("Token", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 6n;
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

            const amountToBridgeZeroInput = 0;

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridgeZeroInput,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E3");

            await expect(deployedToken.connect(user).bridge(
                user,
                ethers.zeroPadValue(user.address, 32),
                amountToBridgeZeroInput,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E3");

            const amountToBridgeZeroAfterConversion = withDecimals("0.0000001");

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridgeZeroAfterConversion,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E3");

            await expect(deployedToken.connect(user).bridge(
                user,
                ethers.zeroPadValue(user.address, 32),
                amountToBridgeZeroAfterConversion,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E3");
        });

        it("Connector", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken } = await loadFixture(ERC20Fixture);

            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 6n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await justToken.connect(user).approve(deployedConnector.target, withDecimals("1"))
            const amountToBridgeZeroInput = 0;

            await expect(deployedConnector.connect(user).bridge(
                user.address,
                user.address,
                amountToBridgeZeroInput,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E3");

            await expect(deployedConnector.connect(user).bridge(
                user.address,
                ethers.zeroPadValue(user.address, 32),
                amountToBridgeZeroInput,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E3");

            const amountToBridgeZeroAfterConversion = withDecimals("0.0000001");

            await expect(deployedConnector.connect(user).bridge(
                user.address,
                user.address,
                amountToBridgeZeroAfterConversion,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E3");

            await expect(deployedConnector.connect(user).bridge(
                user.address,
                ethers.zeroPadValue(user.address, 32),
                amountToBridgeZeroAfterConversion,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E3");
        });
    });

    describe("ATS Base E5", function () {
        it("Token bridge", async function () {
            const { baseFeePerGasInWei, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

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

            await deployedToken.connect(user).setChainConfig(
                allowedChainIds,
                [[configPeer, configMinGasLimit, configDecimals, true]]
            );

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                1n,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E5");

            await expect(deployedToken.connect(user).bridge(
                user,
                ethers.zeroPadValue(user.address, 32),
                1n,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E5");
        });

        it("Token redeem", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

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

            await deployedToken.connect(user).setChainConfig(
                allowedChainIds,
                [[configPeer, configMinGasLimit, configDecimals, true]]
            );

            await deployedToken.connect(user).setRouter(user);

            await expect(deployedToken.connect(user).redeem(
                user,
                1,
                "0x",
                [user.address, allowedChainIds[0], configPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E5");
        });

        it("Endpoint redeem", async function () {
            const { endpoint, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, functionSelector, masterRouter } = await loadFixture(ERC20Fixture);

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

            await deployedToken.connect(user).setChainConfig(
                allowedChainIds,
                [[configPeer, configMinGasLimit, configDecimals, true]]
            );

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                1n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            await deployedToken.connect(user).setChainConfig(
                allowedChainIds,
                [[configPeer, configMinGasLimit, configDecimals, false]]
            );

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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });
    });

    describe("ATS Base E7", function () {
        it("Token", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, mockRouter, routerRole, masterRouter } = await loadFixture(ERC20Fixture);

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

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedToken.connect(user).setRouter(mockRouter.target);

            let falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            await expect(mockRouter.connect(user).redeem(
                deployedToken.target,
                user,
                1,
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            await expect(mockRouter.connect(user).setChainConfigByRouter(
                deployedToken.target,
                [],
                [],
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            falseConfigPeer = "0x00";

            await expect(mockRouter.connect(user).redeem(
                deployedToken.target,
                user,
                1,
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            await expect(mockRouter.connect(user).setChainConfigByRouter(
                deployedToken.target,
                [],
                [],
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            falseConfigPeer = "0xff";

            await expect(mockRouter.connect(user).redeem(
                deployedToken.target,
                user,
                1,
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            await expect(mockRouter.connect(user).setChainConfigByRouter(
                deployedToken.target,
                [],
                [],
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d71666150b2c873c7c8d2859c07d9f9d7166619873f73769873f7376bb93b4fc3c3efb93eec00";

            await expect(mockRouter.connect(user).redeem(
                deployedToken.target,
                user,
                1,
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            await expect(mockRouter.connect(user).setChainConfigByRouter(
                deployedToken.target,
                [],
                [],
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");
        });

        it("Connector", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, routerRole, mockRouter, masterRouter } = await loadFixture(ERC20Fixture);

            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedConnector.connect(user).setRouter(mockRouter.target);

            const falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            await expect(mockRouter.connect(user).redeem(
                deployedConnector.target,
                user,
                1,
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E7");

            await expect(mockRouter.connect(user).setChainConfigByRouter(
                deployedConnector.target,
                [],
                [],
                [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
            )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E7");
        });

        it("Endpoint", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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

            const falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                falseConfigPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                1n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });
    });

    describe("Bridge", function () {
        it("Token bridge", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const tokenAmountToBridge = 1000n;
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            expect(estimateValues[1]).to.equal(await router.dstMinGasLimit(allowedChainIds[0]));

            const bridgePayment = await router.getBridgeFee(allowedChainIds[0], estimateValues[1], 0n, "0x");

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                estimateValues[1],
                "0x",
                "0x",
                { value: baseFeePerGasInWei * estimateValues[1] }
            );

            expect(await deployedToken.balanceOf(user) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
            expect(baseFeePerGasInWei * estimateValues[1]).to.equal(bridgePayment);
        });

        it("Token bridge from zero address", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 300000n;
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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const tokenAmountToBridge = 1000n;
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            expect(estimateValues[1]).to.equal(configMinGasLimit);

            await deployedToken.connect(user).bridge(
                zeroAddress,
                user.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            );

            expect(await deployedToken.balanceOf(user) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
        });

        it("Connector bridge", async function () {
            const { admin, executor, justToken, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                admin,
                justToken,
                false,
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

            const tokenBalanceBefore = await justToken.balanceOf(admin);
            const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
            const tokenAmountToBridge = 1000n;
            const estimateValues = await deployedConnector.estimateBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            expect(estimateValues[1]).to.equal(await router.dstMinGasLimit(allowedChainIds[0]));

            await justToken.connect(admin).approve(deployedConnector.target, tokenAmountToBridge);

            await deployedConnector.connect(admin).bridge(
                admin.address,
                admin.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                estimateValues[1],
                "0x",
                "0x",
                { value: baseFeePerGasInWei * estimateValues[1] }
            );

            expect(await justToken.balanceOf(admin) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
            expect(await justToken.balanceOf(deployedConnector.target) - tokenAmountToBridge).to.equal(connectorBalanceBefore);
        });
    });

    describe("Redeem", function () {
        it("Success case", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

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

            const amountToRedeem = withDecimals("1500");
            const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1] + 50000n;

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                "0x"
            );

            const userBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(await deployedToken.isExecutionFailed(
                user,
                amountToRedeem,
                "0x",
                [user.address, allowedChainIds[0], configPeer, configDecimals],
                1
            )).to.equal(false);

            expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());
        });

        it("Record case", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

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

            const amountToRedeem = withDecimals("1500");
            const gasLimit = 75001n;

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                "0x"
            );

            const userBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                1n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(await deployedToken.isExecutionFailed(
                user,
                amountToRedeem,
                "0x",
                [user.address, allowedChainIds[0], configPeer, configDecimals],
                1
            )).to.equal(true);

            expect(userBalanceBefore).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("Failure case", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const ATSTokenMock = await ethers.getContractFactory("ATSTokenMock", admin);
            const mock = await ATSTokenMock.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");
            const gasLimit = 204000n;

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                2n,
                mock.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(await mock.isExecutionFailed(
                user,
                amountToRedeem,
                "0x",
                [user.address, allowedChainIds[0], configPeer, configDecimals],
                1
            )).to.equal(false);
        });
    });

    describe("Retry", function () {
        it("Record case", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

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

            const amountToRedeem = withDecimals("1500");
            const invalidConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const payload = "0x";

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                invalidConfigPeer,
                configDecimals,
                500000n,
                payload
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                1n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            const filterBase = deployedToken.filters.ExecutionFailed;
            const eventsBase = await deployedToken.queryFilter(filterBase, -1);
            const argsBase = eventsBase[0].args;

            const origin = [user.address, allowedChainIds[0], invalidConfigPeer, configDecimals];

            expect(await argsBase[0]).to.equal(user);
            expect(await argsBase[1]).to.equal(amountToRedeem);
            expect(await argsBase[2]).to.equal(payload);
            expect(await argsBase[3].hash).to.equal("0xd5819e874241e3091c5eea263acf195d55c5c58857f6585c70136d713679e50b");
            expect(await argsBase[5].hash).to.equal("0x0f6760e4e2027b6763048d4124925b5006454aa383a21ea5fcd6fa1e253fd50a");
            expect(await argsBase[6]).to.equal(1);

            expect(await deployedToken.isExecutionFailed(
                user,
                amountToRedeem,
                payload,
                origin,
                0
            )).to.equal(false);

            expect(await deployedToken.isExecutionFailed(
                user,
                amountToRedeem,
                payload,
                origin,
                1
            )).to.equal(true);

            await deployedToken.connect(user).retryRedeem(
                user,
                amountToRedeem,
                payload,
                origin,
                0
            );

            expect(await deployedToken.isExecutionFailed(
                user,
                amountToRedeem,
                payload,
                origin,
                1
            )).to.equal(true);

            expect(await deployedToken.isExecutionFailed(
                zeroAddress,
                amountToRedeem,
                payload,
                origin,
                1
            )).to.equal(false);

            await deployedToken.connect(user).retryRedeem(
                zeroAddress,
                amountToRedeem,
                payload,
                origin,
                1
            );

            await expect(deployedToken.connect(user).retryRedeem(
                user,
                amountToRedeem,
                payload,
                origin,
                1
            )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E7");

            await deployedToken.connect(user).setChainConfig(
                allowedChainIds,
                [[invalidConfigPeer, configMinGasLimit, configDecimals, false]]
            );

            const chainConfigData = await deployedToken.getChainConfigs([allowedChainIds[0]]);

            expect(chainConfigData[0].peerAddress).to.equal(invalidConfigPeer);
            expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(chainConfigData[0].decimals).to.equal(configDecimals);
            expect(chainConfigData[0].paused).to.equal(false);

            const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
            const userBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();

            await deployedToken.connect(executor).retryRedeem(
                user,
                amountToRedeem,
                payload,
                origin,
                1
            );

            expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

            expect(await deployedToken.isExecutionFailed(
                user,
                amountToRedeem,
                payload,
                origin,
                1
            )).to.equal(false);

            await deployedToken.connect(executor).retryRedeem(
                user,
                amountToRedeem,
                payload,
                origin,
                1
            );

            expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());
        });
    });
});

describe("ATS BaseExtended", function () {
    describe("setChainConfigToDestination", function () {
        it("Base test token", async function () {
            const {
                managerRole, admin, endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory
            } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];
            const updateConfig = [[123, 456], [config, config]];

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

            await masterRouter.connect(admin).setDstMasterRouter(
                [123, 456],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await deployedToken.connect(user).setChainConfig(
                [123, 456],
                [[factory.target, configMinGasLimit, configDecimals, false], [factory.target, configMinGasLimit, configDecimals, false]]
            );

            await router.connect(admin).grantRole(managerRole, admin);

            await router.connect(admin).setDstUpdateGas(
                [123n, 456n],
                [123n, 456n]
            );

            const tx = await deployedToken.connect(user).setChainConfigToDestination(
                [123, 456],
                [updateConfig, updateConfig],
                { value: withDecimals("1") }
            );

            const params = await encodeParamsToUpdateConfig(
                user,
                factory,
                testCurChainId,
                deployedToken.target,
                updateConfig
            );

            const paramsTwo = await encodeParamsToUpdateConfig(
                user,
                factory,
                testCurChainId,
                deployedToken.target,
                updateConfig
            );

            await tx.wait();
            const filter = endpoint.filters.MessageProposed;
            const events = await endpoint.queryFilter(filter, -1);
            const argsT = events[0].args;
            const argsC = events[1].args;

            expect(argsT[0]).to.equal(123);
            expect(argsT[2]).to.equal(functionSelector);
            expect(argsT[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsT[5]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsT[6]).to.equal(params);
            expect(argsT[7]).to.equal("0x");

            expect(argsC[0]).to.equal(456);
            expect(argsC[2]).to.equal(functionSelector);
            expect(argsC[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsC[5]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsC[6]).to.equal(paramsTwo);
            expect(argsC[7]).to.equal("0x");
        });

        it("Base test connector", async function () {
            const {
                managerRole, justToken, admin, endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory
            } = await loadFixture(ERC20Fixture);

            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec0011";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];
            const updateConfig = [[123, 456], [config, config]];

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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
                adminRole,
                masterRouter
            );

            await masterRouter.connect(admin).setDstMasterRouter(
                [123],
                [ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await deployedConnector.connect(user).setChainConfig(
                [123],
                [[configPeer, configMinGasLimit, configDecimals, false]]
            );

            await router.connect(admin).grantRole(managerRole, admin);

            await router.connect(admin).setDstUpdateGas(
                [123n, 456n],
                [123n, 456n]
            );

            const tx = await deployedConnector.connect(user).setChainConfigToDestination(
                [123],
                [updateConfig],
                { value: withDecimals("1") }
            );

            const localParams = AbiCoder.encode([
                "bytes",
                "uint256",
                "bytes",
                "tuple(uint256[], tuple(bytes, uint64, uint8, bool)[])"
            ], [
                user.address,
                testCurChainId,
                deployedConnector.target,
                updateConfig
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                configPeer,
                routerUpdateMessageType,
                localParams
            ]);

            await tx.wait();
            const filter = endpoint.filters.MessageProposed;
            const events = await endpoint.queryFilter(filter, -1);
            const args = events[0].args;

            expect(args[0]).to.equal(123);
            expect(args[2]).to.equal(functionSelector);
            expect(args[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(args[5]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(args[6]).to.equal(params);
            expect(args[7]).to.equal("0x");
        });
    });

    describe("setChainConfigByRouter", function () {
        it("Base test token", async function () {
            const { endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

            const updateConfig = [[123, 345], [config, config]];

            const params = await encodeParamsToUpdateConfig(
                user,
                deployedToken,
                testDstChainId,
                configPeer,
                updateConfig
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            filter = deployedToken.filters.ChainConfigUpdated;
            events = await deployedToken.queryFilter(filter, -1);
            args = events[events.length - 1].args;

            expect(args[0]).to.equal(router.target);
            expect(args[1]).to.eql([123n, 345n]);
            expect(args[2]).to.eql([config, config]);

            filter = registry.filters.ChainConfigUpdated;
            events = await registry.queryFilter(filter, -1);
            args = events[events.length - 1].args;

            expect(args[0]).to.equal(deployedToken.target);
            expect(args[1]).to.eql([123n, 345n]);
            expect(args[2]).to.eql([config, config]);

            const configData = await deployedToken.getChainConfigs([testDstChainId, 123, 345]);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal("0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00");
            expect(configData[1].minGasLimit).to.equal(123);
            expect(configData[1].decimals).to.equal(243);
            expect(configData[1].paused).to.equal(true);
            expect(configData[2].peerAddress).to.equal("0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00");
            expect(configData[2].minGasLimit).to.equal(123);
            expect(configData[2].decimals).to.equal(243);
            expect(configData[2].paused).to.equal(true);
        });

        it("Should return error code by invalid peer", async function () {
            const { endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];
            const invalidPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec01";

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

            const updateConfig = [[123, 345], [config, config]];

            const params = await encodeParamsToUpdateConfig(
                user,
                deployedToken,
                testDstChainId,
                invalidPeer,
                updateConfig
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                2n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            const configData = await deployedToken.getChainConfigs([testDstChainId, 123, 345]);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal("0x");
            expect(configData[1].minGasLimit).to.equal(0);
            expect(configData[1].decimals).to.equal(0);
            expect(configData[1].paused).to.equal(false);
            expect(configData[2].peerAddress).to.equal("0x");
            expect(configData[2].minGasLimit).to.equal(0);
            expect(configData[2].decimals).to.equal(0);
            expect(configData[2].paused).to.equal(false);
        });

        it("Should return error code by invalid source chainId", async function () {
            const { endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

            const updateConfig = [[123, 345], [config, config]];

            const params = await encodeParamsToUpdateConfig(
                user,
                deployedToken,
                testCurChainId,
                configPeer,
                updateConfig
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                6n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            const configData = await deployedToken.getChainConfigs([testDstChainId, 123, 345]);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal("0x");
            expect(configData[1].minGasLimit).to.equal(0);
            expect(configData[1].decimals).to.equal(0);
            expect(configData[1].paused).to.equal(false);
            expect(configData[2].peerAddress).to.equal("0x");
            expect(configData[2].minGasLimit).to.equal(0);
            expect(configData[2].decimals).to.equal(0);
            expect(configData[2].paused).to.equal(false);
        });

        it("Should return error code by invalid source chainId (current)", async function () {
            const { endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

            const updateConfig = [[123, 345], [config, config]];

            const params = await encodeParamsToUpdateConfig(
                user,
                deployedToken,
                testCurChainId,
                configPeer,
                updateConfig
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                6n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            const configData = await deployedToken.getChainConfigs([testDstChainId, 123, 345]);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal("0x");
            expect(configData[1].minGasLimit).to.equal(0);
            expect(configData[1].decimals).to.equal(0);
            expect(configData[1].paused).to.equal(false);
            expect(configData[2].peerAddress).to.equal("0x");
            expect(configData[2].minGasLimit).to.equal(0);
            expect(configData[2].decimals).to.equal(0);
            expect(configData[2].paused).to.equal(false);
        });

        it("Should return error code by invalid source chainId (different)", async function () {
            const { endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

            const updateConfig = [[123, 345], [config, config]];

            const params = await encodeParamsToUpdateConfig(
                user,
                deployedToken,
                testCurChainId,
                configPeer,
                updateConfig
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                6n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            const configData = await deployedToken.getChainConfigs([testDstChainId, 123, 345]);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal("0x");
            expect(configData[1].minGasLimit).to.equal(0);
            expect(configData[1].decimals).to.equal(0);
            expect(configData[1].paused).to.equal(false);
            expect(configData[2].peerAddress).to.equal("0x");
            expect(configData[2].minGasLimit).to.equal(0);
            expect(configData[2].decimals).to.equal(0);
            expect(configData[2].paused).to.equal(false);
        });

        it("Should return error code by empty peer", async function () {
            const { endpoint, functionSelector, masterRouter, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
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

            const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

            const updateConfig = [[123, 345], [config, config]];

            const params = await encodeParamsToUpdateConfig(
                user,
                deployedToken,
                testDstChainId,
                "0x",
                updateConfig
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                8n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            const configData = await deployedToken.getChainConfigs([testDstChainId, 123, 345]);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal("0x");
            expect(configData[1].minGasLimit).to.equal(0);
            expect(configData[1].decimals).to.equal(0);
            expect(configData[1].paused).to.equal(false);
            expect(configData[2].peerAddress).to.equal("0x");
            expect(configData[2].minGasLimit).to.equal(0);
            expect(configData[2].decimals).to.equal(0);
            expect(configData[2].paused).to.equal(false);
        });
    });
});

describe("ATS Connector", function () {
    it("Redeem to connector", async function () {
        const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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
            adminRole,
            masterRouter
        );

        const amountToRedeem = withDecimals("150");
        await justToken.connect(admin).transfer(deployedConnector.target, withDecimals("200"));

        const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
        const userBalanceBefore = await justToken.balanceOf(user);
        const totalSupplyBefore = await justToken.totalSupply();

        const params = await encodeParamsToRedeem(
            user,
            deployedConnector,
            deployedConnector,
            amountToRedeem,
            allowedChainIds[0],
            configPeer,
            configDecimals,
            500000n,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.emit(masterRouter, "ProposalExecuted").withArgs(
            0n,
            deployedConnector.target,
            router.target,
            params,
            allowedChainIds[0],
            [zeroHash, zeroHash]
        ).to.emit(endpoint, "MessageExecuted").withArgs(
            anyValue
        );

        expect(connectorBalanceBefore).to.equal(await justToken.balanceOf(deployedConnector.target));
        expect(userBalanceBefore).to.equal(await justToken.balanceOf(user));
        expect(totalSupplyBefore).to.equal(await justToken.totalSupply());
    });

    it("Redeem to user", async function () {
        const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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
            adminRole,
            masterRouter
        );

        const amountToRedeem = withDecimals("150");
        await justToken.connect(admin).transfer(deployedConnector.target, withDecimals("200"));

        const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
        const userBalanceBefore = await justToken.balanceOf(user);
        const totalSupplyBefore = await justToken.totalSupply();

        const params = await encodeParamsToRedeem(
            user,
            deployedConnector,
            user,
            amountToRedeem,
            allowedChainIds[0],
            configPeer,
            configDecimals,
            500000n,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.emit(masterRouter, "ProposalExecuted").withArgs(
            0n,
            deployedConnector.target,
            router.target,
            params,
            allowedChainIds[0],
            [zeroHash, zeroHash]
        ).to.emit(endpoint, "MessageExecuted").withArgs(
            anyValue
        );

        expect(connectorBalanceBefore - amountToRedeem).to.equal(await justToken.balanceOf(deployedConnector.target));
        expect(userBalanceBefore + amountToRedeem).to.equal(await justToken.balanceOf(user));
        expect(totalSupplyBefore).to.equal(await justToken.totalSupply());
    });
});

describe("ATS ConnectorNative", function () {
    it("Redeem to connector", async function () {
        const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            justToken,
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
            adminRole,
            masterRouter
        );

        const amountToRedeem = withDecimals("10");
        const txData = {
            to: deployedConnector.target,
            value: withDecimals("200")
        }

        const tx = await admin.sendTransaction(txData)
        await tx.wait();

        const connectorBalanceBefore = await ethers.provider.getBalance(deployedConnector.target);
        const userBalanceBefore = await ethers.provider.getBalance(user.address);

        expect(await deployedConnector.underlyingBalance()).to.equal(connectorBalanceBefore);

        const params = await encodeParamsToRedeem(
            user,
            deployedConnector,
            deployedConnector,
            amountToRedeem,
            allowedChainIds[0],
            configPeer,
            configDecimals,
            500000n,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.emit(masterRouter, "ProposalExecuted").withArgs(
            0n,
            deployedConnector.target,
            router.target,
            params,
            allowedChainIds[0],
            [zeroHash, zeroHash]
        ).to.emit(endpoint, "MessageExecuted").withArgs(
            anyValue
        );

        expect(connectorBalanceBefore).to.equal(await ethers.provider.getBalance(deployedConnector.target));
        expect(userBalanceBefore).to.equal(await ethers.provider.getBalance(user.address));
    });

    it("Redeem to user", async function () {
        const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            justToken,
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
            adminRole,
            masterRouter
        );

        const amountToRedeem = withDecimals("10");
        const txData = {
            to: deployedConnector.target,
            value: withDecimals("200")
        }

        const tx = await admin.sendTransaction(txData)
        await tx.wait();

        const connectorBalanceBefore = await ethers.provider.getBalance(deployedConnector.target);
        const userBalanceBefore = await ethers.provider.getBalance(user.address);

        const params = await encodeParamsToRedeem(
            user,
            deployedConnector,
            user,
            amountToRedeem,
            allowedChainIds[0],
            configPeer,
            configDecimals,
            500000n,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.emit(masterRouter, "ProposalExecuted").withArgs(
            0n,
            deployedConnector.target,
            router.target,
            params,
            allowedChainIds[0],
            [zeroHash, zeroHash]
        ).to.emit(endpoint, "MessageExecuted").withArgs(
            anyValue
        );

        expect(connectorBalanceBefore - amountToRedeem).to.equal(await ethers.provider.getBalance(deployedConnector.target));
        expect(connectorBalanceBefore - amountToRedeem).to.equal(await deployedConnector.underlyingBalance());
        expect(userBalanceBefore + amountToRedeem).to.equal(await ethers.provider.getBalance(user.address));
    });

    it("Bridge base test", async function () {
        const { adminRole, registry, executor, endpoint, masterRouter, functionSelector, user, factory, router, zeroAddress, zeroHash } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 290000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            executor,
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
            adminRole,
            masterRouter
        );

        const connectorBalanceBefore = await ethers.provider.getBalance(deployedConnector.target);
        const userBalanceBefore = await ethers.provider.getBalance(user.address);
        const payment = await deployedConnector.estimateBridgeFee(testDstChainId, configMinGasLimit, 0, "0x");
        const amount = withDecimals("1");
        const localParams = AbiCoder.encode([
            "bytes",
            "bytes",
            "uint256",
            "uint256",
            "bytes",
            "uint8",
            "uint64",
            "bytes"
        ], [
            user.address,
            user.address,
            amount,
            testCurChainId,
            deployedConnector.target,
            18n,
            configMinGasLimit,
            "0x"
        ]);

        const params = AbiCoder.encode([
            "bytes",
            "bytes1",
            "bytes"
        ], [
            configPeer,
            "0x01",
            localParams
        ]);

        expect(payment[0]).to.above(0);

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            configMinGasLimit
        ]);

        await expect(deployedConnector.connect(user).bridge(
            zeroAddress,
            user.address,
            amount,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: payment[0] + amount }
        )).to.emit(endpoint, "MessageProposed").withArgs(
            testDstChainId,
            anyValue,
            functionSelector,
            transmitterParams,
            ethers.zeroPadValue(masterRouter.target, 32),
            ethers.zeroPadValue(masterRouter.target, 32),
            params,
            "0x"
        ).to.emit(deployedConnector, "Bridged").withArgs(
            user.address,
            user.address,
            configPeer.toLowerCase(),
            configPeer,
            user.address.toLowerCase(),
            amount,
            testDstChainId
        );

        expect(await deployedConnector.underlyingBalance()).to.equal(amount);
        expect(connectorBalanceBefore + amount).to.equal(await ethers.provider.getBalance(deployedConnector.target));
        expect(userBalanceBefore - amount - payment[0]).to.closeTo(await ethers.provider.getBalance(user.address), withDecimals("0.0005"));
    });

    it("ATSConnectorNative E0", async function () {
        const { masterRouter, adminRole, registry, executor, user, factory, router, zeroAddress, zeroHash } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 250000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            executor,
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
            adminRole,
            masterRouter
        );

        const amount = withDecimals("1");

        await expect(deployedConnector.connect(user).bridge(
            zeroAddress,
            user.address,
            amount,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: amount - 1n }
        )).to.be.revertedWithCustomError(deployedConnector, "ATSConnectorNative__E0");
    });

    it("ATSConnectorNative E3", async function () {
        const { masterRouter, adminRole, registry, executor, admin, user, factory, router, zeroAddress, zeroHash } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 250000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            executor,
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
            adminRole,
            masterRouter
        );

        const amount = withDecimals("1");

        await expect(deployedConnector.connect(user).bridge(
            admin.address,
            user.address,
            amount,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: amount }
        )).to.be.revertedWithCustomError(deployedConnector, "ATSConnectorNative__E3");
    });

    it("ATSRouter E0", async function () {
        const { adminRole, masterRouter, executor, registry, user, factory, router, zeroAddress, zeroHash } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 290000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            executor,
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
            adminRole,
            masterRouter
        );

        const amount = withDecimals("1");

        await expect(deployedConnector.connect(user).bridge(
            zeroAddress,
            user.address,
            amount,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: amount }
        )).to.be.revertedWithCustomError(router, "ATSRouter__E0");
    });

    it("ATSConnectorNative E1", async function () {
        const { adminRole, executor, endpoint, masterRouter, functionSelector, registry, user, factory, router, zeroAddress, zeroHash } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 250000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            executor,
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
            adminRole,
            masterRouter
        );

        const connectorBalanceBefore = await ethers.provider.getBalance(deployedConnector.target);
        const amountToRedeem = withDecimals("0.001");
        const amountToReceive = await convert(amountToRedeem, configDecimals, await deployedConnector.underlyingDecimals());
        const origin = [user.address, allowedChainIds[0], configPeer, 18n];

        const params = await encodeParamsToRedeem(
            user,
            deployedConnector,
            user,
            amountToRedeem,
            allowedChainIds[0],
            configPeer,
            configDecimals,
            configMinGasLimit,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.emit(masterRouter, "ProposalExecuted").withArgs(
            1n,
            deployedConnector.target,
            router.target,
            params,
            allowedChainIds[0],
            [zeroHash, zeroHash]
        ).to.emit(deployedConnector, "ExecutionFailed");

        expect(await deployedConnector.isExecutionFailed(
            user.address,
            amountToReceive,
            "0x",
            origin,
            1
        )).to.equal(true);

        expect(connectorBalanceBefore).to.equal(await ethers.provider.getBalance(deployedConnector.target));
    });

    it("ATSConnectorNative E2", async function () {
        const { adminRole, registry, executor, endpoint, masterRouter, functionSelector, admin, user, factory, router, zeroAddress, zeroHash } = await loadFixture(ERC20Fixture);

        const feeModule = false;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 290000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 18n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const deployedConnector = await deployNativeConnectorByFactory(
            executor,
            user,
            executor,
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
            adminRole,
            masterRouter
        );

        const payment = await deployedConnector.estimateBridgeFee(testDstChainId, configMinGasLimit, 0, "0x");
        const amount = withDecimals("10");

        await deployedConnector.connect(user).bridge(
            zeroAddress,
            user.address,
            amount,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: payment[0] + amount }
        );

        const connectorBalanceBefore = await ethers.provider.getBalance(deployedConnector.target);
        const amountToRedeem = amount / 10n;
        const amountToReceive = await convert(amountToRedeem, configDecimals, await deployedConnector.underlyingDecimals());
        const origin = [user.address, allowedChainIds[0], configPeer, 18n];

        const ERC20Mock = await ethers.getContractFactory("ERC20Mock", admin);
        const mock = await ERC20Mock.deploy(18);
        await mock.waitForDeployment();

        const params = await encodeParamsToRedeem(
            user,
            deployedConnector,
            mock,
            amountToRedeem,
            allowedChainIds[0],
            configPeer,
            configDecimals,
            configMinGasLimit,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.emit(masterRouter, "ProposalExecuted").withArgs(
            1n,
            deployedConnector.target,
            router.target,
            params,
            allowedChainIds[0],
            [zeroHash, zeroHash]
        ).to.emit(deployedConnector, "ExecutionFailed");

        expect(await deployedConnector.isExecutionFailed(
            mock.target,
            amountToReceive,
            "0x",
            origin,
            1
        )).to.equal(true);

        expect(connectorBalanceBefore).to.equal(await ethers.provider.getBalance(deployedConnector.target));
    });
});

describe("ATS Token", function () {
    describe("Mintable", function () {
        it("Mint by role if mintable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("1000");
            const mintable = true;
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

            const minterRole = await deployedToken.MINTER_ROLE();

            await deployedToken.connect(user).grantRole(minterRole, executor);

            const tokenBalanceBefore = await deployedToken.balanceOf(executor);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToMint = withDecimals("10000");

            await deployedToken.connect(executor).mint(executor, tokenAmountToMint);

            expect(tokenBalanceBefore + tokenAmountToMint).to.equal(await deployedToken.balanceOf(executor));
            expect(totalSupplyBefore + tokenAmountToMint).to.equal(await deployedToken.totalSupply());
        });

        it("ATS Token E0 Should revert mint by third party if mintable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("1000");
            const mintable = true;
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

            const tokenBalanceBefore = await deployedToken.balanceOf(executor);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToMint = withDecimals("10000");

            await expect(deployedToken.connect(executor).mint(
                executor,
                tokenAmountToMint
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E0");

            expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("ATS Token E1 Should revert mint if non-mintable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("1000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToMint = withDecimals("10000");

            const nonMintableToken = await ethers.getContractAt("ATSTokenMintable", deployedToken.target);

            await expect(nonMintableToken.connect(user).mint(
                user,
                tokenAmountToMint
            )).to.be.reverted;

            expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });
    });

    describe("Burnable", function () {
        it("ATS Token E0 Should revert burn by third party if burnable only role", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("1000");
            const mintable = true;
            const globalBurnable = false;
            const onlyRoleBurnable = true;
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

            const tokenBalanceBefore = await deployedToken.balanceOf(executor);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToBurn = withDecimals("10000");

            await expect(deployedToken.connect(user).burn(
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E0");

            await expect(deployedToken.connect(executor).burn(
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E0");

            expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("ATS Token E1 Should revert burn if global non-burnable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
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

            const tokenAmountToBurn = withDecimals("10000");

            await expect(deployedToken.connect(user).burn(
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E1");

            const burnerRole = await deployedToken.BURNER_ROLE();

            await deployedToken.connect(user).grantRole(burnerRole, user);

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();

            await expect(deployedToken.connect(user).burn(
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E1");

            await deployedToken.connect(user).approve(executor, tokenAmountToBurn);

            await expect(deployedToken.connect(executor).burnFrom(
                user,
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E1");

            expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("Should revert burn by insufficient allowance if burnable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check1";
            const symbol = "check2";
            const decimals = 16n;
            const initialSupply = withDecimals("1000");
            const mintable = true;
            const globalBurnable = true;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3cfefb93eec00";
            const configDecimals = 16n;
            const salt = "0x04050b2c873c7c8d2859cf7d9f9d7166619873f7376bb93b4fc3c33fb93eec90";

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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToBurn = withDecimals("10000");

            await expect(deployedToken.connect(executor).burnFrom(
                user,
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");

            expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("Should burn global burnable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = true;
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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToBurn = withDecimals("10000");

            await deployedToken.connect(user).burn(tokenAmountToBurn);

            expect(tokenBalanceBefore - tokenAmountToBurn).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore - tokenAmountToBurn).to.equal(await deployedToken.totalSupply());

            const tokenBalanceBeforeTwo = await deployedToken.balanceOf(user);
            const totalSupplyBeforeTwo = await deployedToken.totalSupply();

            await deployedToken.connect(user).approve(executor, tokenAmountToBurn);

            await deployedToken.connect(executor).burnFrom(user, tokenAmountToBurn);

            expect(tokenBalanceBeforeTwo - tokenAmountToBurn).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeTwo - tokenAmountToBurn).to.equal(await deployedToken.totalSupply());
        });

        it("Should burn only role burnable", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = true;
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

            const burnerRole = await deployedToken.BURNER_ROLE();

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const tokenAmountToBurn = withDecimals("10000");

            await deployedToken.connect(user).grantRole(burnerRole, executor);
            await deployedToken.connect(user).approve(executor, tokenAmountToBurn);

            await expect(deployedToken.connect(user).burn(
                tokenAmountToBurn
            )).to.be.revertedWithCustomError(deployedToken, "ATSToken__E0()");

            await deployedToken.connect(executor).burnFrom(user, tokenAmountToBurn);

            expect(tokenBalanceBefore - tokenAmountToBurn).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore - tokenAmountToBurn).to.equal(await deployedToken.totalSupply())
        });
    });

    describe("Bridge from", function () {
        it("Burn from", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
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

            const amountToBridge = withDecimals("100");

            await deployedToken.connect(user).approve(executor, amountToBridge);

            const userBalanceBefore = await deployedToken.balanceOf(user);
            const executorBalanceBefore = await deployedToken.balanceOf(executor);
            const totalSupplyBefore = await deployedToken.totalSupply();
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            await deployedToken.connect(executor).bridge(
                user.address,
                executor.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBefore - amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(executorBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
            expect(totalSupplyBefore - amountToBridge).to.equal(await deployedToken.totalSupply());
        });

        it("Should revert burn from by insufficient allowance", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
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

            const amountToBridge = withDecimals("100");

            const userBalanceBefore = await deployedToken.balanceOf(user);
            const executorBalanceBefore = await deployedToken.balanceOf(executor);
            const totalSupplyBefore = await deployedToken.totalSupply();

            await expect(deployedToken.connect(executor).bridge(
                user.address,
                executor.address,
                amountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");

            expect(userBalanceBefore).to.equal(await deployedToken.balanceOf(user));
            expect(executorBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });
    });

    describe("Decimals conversion", function () {
        it("Should redeem if same decimals", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
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

            const amountToBridge = withDecimals("100");

            const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
            const totalSupplyBeforeBridge = await deployedToken.totalSupply();
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

            const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
            const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToBridge,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBeforeRedeem + amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeRedeem + amountToBridge).to.equal(await deployedToken.totalSupply());
        });

        it("Should redeem if higher decimals", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 22n;
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

            const totalSupplyBefore = await deployedToken.totalSupply();
            const amountToBridge = withDecimals("1000");

            const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
            const totalSupplyBeforeBridge = await deployedToken.totalSupply();
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

            const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
            const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

            const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
            const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                convertedAmountToBridge,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("Should redeem if lower decimals", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const totalSupplyBefore = await deployedToken.totalSupply();
            const amountToBridge = withDecimals("1000");

            const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
            const totalSupplyBeforeBridge = await deployedToken.totalSupply();
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

            const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
            const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

            const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
            const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                convertedAmountToBridge,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("Should redeem if same decimals with dust", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
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

            const amountToBridge = withDecimals("100.000000000009");

            const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
            const totalSupplyBeforeBridge = await deployedToken.totalSupply();
            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

            const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
            const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToBridge,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBeforeRedeem + amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeRedeem + amountToBridge).to.equal(await deployedToken.totalSupply());
        });

        it("Should redeem if higher decimals with dust", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 22n;
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

            const totalSupplyBefore = await deployedToken.totalSupply();
            const amountToBridge = withDecimals("1000.000000000009");

            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
            const totalSupplyBeforeBridge = await deployedToken.totalSupply();

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

            const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
            const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

            const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
            const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                convertedAmountToBridge,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });

        it("Should redeem if lower decimals with dust", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, functionSelector, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const totalSupplyBefore = await deployedToken.totalSupply();

            const amountToBridge = withDecimals("1000.00000000000009");
            const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
            const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            expect(amountToReceive).to.equal(withDecimals("1000"));

            const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
            const totalSupplyBeforeBridge = await deployedToken.totalSupply();

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            );

            expect(userBalanceBeforeBridge - amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeBridge - amountToReceive).to.equal(await deployedToken.totalSupply());

            const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
            const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                convertedAmountToBridge,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                500000n
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
                        (allowedChainIds[0]) << 128n,
                        [zeroHash, zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                0n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
            expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
        });
    });
});

describe("ATS Token Pure", function () {
    it("Init settings", async function () {
        const { factory, router, user } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("10000");
        const pureToken = true;
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

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            0,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply);
        expect(await deployedToken.totalSupply()).to.equal(initialSupply);
        expect(await deployedToken.balanceOf(user)).to.equal(0);
        expect(await deployedToken.decimals()).to.equal(decimals);
        expect(await deployedToken.underlyingToken()).to.equal(deployedToken.target);

        const newSalt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec01";
        const newInitialSupply = 0;

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            newInitialSupply,
            newInitialSupply,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            newSalt
        ]);

        const precomputeTwo = await factory.getPrecomputedAddress(4, user.address, newSalt, false);
        const deployedTokenTwo = await ethers.getContractAt("ATSTokenPure", precomputeTwo.deployment);
        expect(precomputeTwo.hasCode).to.equal(true);

        expect(await deployedTokenTwo.balanceOf(deployedTokenTwo.target)).to.equal(newInitialSupply);
        expect(await deployedTokenTwo.totalSupply()).to.equal(newInitialSupply);
        expect(await deployedTokenTwo.balanceOf(user)).to.equal(newInitialSupply);
        expect(await deployedTokenTwo.decimals()).to.equal(decimals);
        expect(await deployedTokenTwo.underlyingToken()).to.equal(deployedTokenTwo.target);

        const newSaltTwo = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec11";
        const mintedAmountToOwner = withDecimals("3579");

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            mintedAmountToOwner,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            newSaltTwo
        ]);

        const precomputeThree = await factory.getPrecomputedAddress(4, user.address, newSaltTwo, false);
        const deployedTokenThree = await ethers.getContractAt("ATSTokenPure", precomputeThree.deployment);
        expect(precomputeThree.hasCode).to.equal(true);

        expect(await deployedTokenThree.balanceOf(deployedTokenThree.target)).to.equal(initialSupply - mintedAmountToOwner);
        expect(await deployedTokenThree.balanceOf(user)).to.equal(mintedAmountToOwner);
        expect(await deployedTokenThree.totalSupply()).to.equal(initialSupply);
        expect(await deployedTokenThree.decimals()).to.equal(decimals);
        expect(await deployedTokenThree.underlyingToken()).to.equal(deployedTokenThree.target);
    });

    it("AccessControl", async function () {
        const { factory, router, user, admin } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("10000");
        const pureToken = true;
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

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            initialSupply,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply - initialSupply);
        expect(await deployedToken.balanceOf(user)).to.equal(initialSupply);
        expect(await deployedToken.totalSupply()).to.equal(initialSupply);

        await expect(deployedToken.connect(admin).setRouter(
            admin.address
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

        await expect(deployedToken.connect(admin).setChainConfig(
            [1],
            [[admin.address, 0, 0, true]]
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");
    });

    it("Should revert bridge by insufficient allowance", async function () {
        const { admin, factory, router, user } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 12n;
        const initialSupply = withDecimals("1");
        const pureToken = true;
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

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            initialSupply,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        const amountToTransfer = 1n

        await expect(deployedToken.connect(user).bridge(
            admin,
            user.address,
            amountToTransfer,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");

        await expect(deployedToken.connect(user).bridge(
            deployedToken.target,
            user.address,
            amountToTransfer,
            testDstChainId,
            configMinGasLimit,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");
    });

    it("Bridge", async function () {
        const { factory, router, user } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("1000");
        const pureToken = true;
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

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            0,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply);
        expect(await deployedToken.balanceOf(user)).to.equal(0);
        expect(await deployedToken.totalSupply()).to.equal(initialSupply);

        await deployedToken.connect(user).setRouter(user);

        await expect(() => deployedToken.connect(user).redeem(
            user.address,
            initialSupply,
            "0x",
            [user.address, testDstChainId, configPeer, configDecimals]
        )).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [initialSupply, -initialSupply]);

        await deployedToken.connect(user).setRouter(router.target);

        const amountToBridge = withDecimals("100");

        const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
        const gasLimit = estimateValues[1];

        const bridgePayment = await router.getBridgeFee(testDstChainId, gasLimit, 0n, "0x");

        await expect(() => deployedToken.connect(user).bridge(
            user.address,
            user.address,
            amountToBridge,
            testDstChainId,
            gasLimit,
            "0x",
            "0x",
            { value: bridgePayment }
        )).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [-amountToBridge, amountToBridge]);
    });

    it("Redeem", async function () {
        const { functionSelector, masterRouter, zeroHash, endpoint, factory, router, user } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("10000");
        const pureToken = true;
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

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            0,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply);
        expect(await deployedToken.balanceOf(user)).to.equal(0);
        expect(await deployedToken.totalSupply()).to.equal(initialSupply);

        const amountToBridge = withDecimals("100");

        const params = await encodeParamsToRedeem(
            user,
            deployedToken,
            user,
            amountToBridge,
            testDstChainId,
            configPeer,
            configDecimals,
            500000n,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [amountToBridge, -amountToBridge]);

        let filter = masterRouter.filters.ProposalExecuted;
        let events = await masterRouter.queryFilter(filter, -1);
        let args = events[0].args;

        expect(args[0]).to.equal(0);
    });

    it("Redeem to token test", async function () {
        const { functionSelector, masterRouter, zeroHash, endpoint, factory, router, user } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("10000");
        const pureToken = true;
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

        await factory.connect(user).deployToken([
            user.address,
            name,
            symbol,
            decimals,
            initialSupply,
            initialSupply,
            pureToken,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        const amountToBridge = withDecimals("100");

        const params = await encodeParamsToRedeem(
            user,
            deployedToken,
            deployedToken,
            amountToBridge,
            testDstChainId,
            configPeer,
            configDecimals,
            500000n,
            "0x"
        );

        const transmitterParams = AbiCoder.encode([
            "uint256",
            "uint256"
        ], [
            1n,
            500000n
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
                    (allowedChainIds[0]) << 128n,
                    [zeroHash, zeroHash]
                ]
            ],
            [[0n, zeroHash, zeroHash]],
            "0x"
        )).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [0, 0]);

        let filter = masterRouter.filters.ProposalExecuted;
        let events = await masterRouter.queryFilter(filter, -1);
        let args = events[0].args;

        expect(args[0]).to.equal(0);
    });
});

describe("ATS FeeModule", function () {
    it("Init settings", async function () {
        const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = false;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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
    });

    it("AccessControl", async function () {
        const { admin, justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = false;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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

        await expect(deployedToken.connect(admin).setFeeCollector(
            admin
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

        await expect(deployedToken.connect(admin).setBridgeFeeRate(
            [1],
            [1]
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

        await expect(deployedConnector.connect(admin).setFeeCollector(
            admin
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

        await expect(deployedConnector.connect(admin).setBridgeFeeRate(
            [1],
            [1]
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");
    });

    it("Setters", async function () {
        const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = false;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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

        await deployedToken.connect(user).setFeeCollector(user);
        await deployedToken.connect(user).setBridgeFeeRate([1, 999], [777, 1]);
        await deployedConnector.connect(user).setFeeCollector(executor);
        await deployedConnector.connect(user).setBridgeFeeRate([3], [9999]);
        await deployedConnector.connect(user).setBridgeFeeRate([111], [123]);

        expect(await deployedToken.feeCollector()).to.equal(user);
        expect(await deployedToken.bridgeFeeRate(1)).to.equal(777);
        expect(await deployedToken.bridgeFeeRate(999)).to.equal(1);
        expect(await deployedConnector.feeCollector()).to.equal(executor);
        expect(await deployedConnector.bridgeFeeRate(3)).to.equal(9999);
        expect(await deployedConnector.bridgeFeeRate(111)).to.equal(123);

        await expect(deployedConnector.connect(user).setBridgeFeeRate(
            [1, 2],
            [1]
        )).to.be.revertedWithCustomError(deployedConnector, "ATSFeeModule__E2");

        await expect(deployedConnector.connect(user).setBridgeFeeRate(
            [1],
            [1, 2]
        )).to.be.revertedWithCustomError(deployedConnector, "ATSFeeModule__E2");

        await expect(deployedToken.connect(user).setBridgeFeeRate(
            [1, 2],
            [1]
        )).to.be.revertedWithCustomError(deployedConnector, "ATSFeeModule__E2");

        await expect(deployedToken.connect(user).setBridgeFeeRate(
            [1],
            [1, 2]
        )).to.be.revertedWithCustomError(deployedConnector, "ATSFeeModule__E2");
    });

    it("ATS FeeModule E0", async function () {
        const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = false;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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

        await expect(deployedToken.connect(user).setBridgeFeeRate(
            [1],
            [10000]
        )).to.be.revertedWithCustomError(deployedToken, "ATSFeeModule__E0");

        await expect(deployedConnector.connect(user).setBridgeFeeRate(
            [2, 3],
            [9999, 10000]
        )).to.be.revertedWithCustomError(deployedToken, "ATSFeeModule__E0");

        await expect(deployedToken.connect(user).setBridgeFeeRate(
            [3, 4, 5],
            [0, 111, 11111]
        )).to.be.revertedWithCustomError(deployedToken, "ATSFeeModule__E0");

        await expect(deployedConnector.connect(user).setBridgeFeeRate(
            [4, 5, 6, 7],
            [11000, 0, 0, 0]
        )).to.be.revertedWithCustomError(deployedToken, "ATSFeeModule__E0");
    });

    it("ATS FeeModule E1", async function () {
        const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = false;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 100000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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

        const bridgeFeeRate = 1999n;

        await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [bridgeFeeRate]);
        await deployedConnector.connect(user).setBridgeFeeRate(allowedChainIds, [bridgeFeeRate]);

        expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(bridgeFeeRate);
        expect(await deployedConnector.bridgeFeeRate(allowedChainIds[0])).to.equal(bridgeFeeRate);

        await expect(deployedToken.connect(user).bridgeWithSlippageCheck(
            user,
            user.address,
            bridgeFeeRate,
            allowedChainIds[0],
            configMinGasLimit,
            bridgeFeeRate + 1n,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedConnector, "ATSFeeModule__E1");

        await expect(deployedConnector.connect(user).bridgeWithSlippageCheck(
            user,
            user.address,
            bridgeFeeRate,
            allowedChainIds[0],
            configMinGasLimit,
            bridgeFeeRate - 1n,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedConnector, "ATSFeeModule__E1");
    });

    it("Token bridge with fee", async function () {
        const { adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = true;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 150000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const feeRate = 1111n;

        await deployedToken.connect(user).setFeeCollector(executor);
        await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

        expect(await deployedToken.feeCollector()).to.equal(executor);
        expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

        const amountToBridge = withDecimals("1");
        const feeAmount = amountToBridge * feeRate / 10000n;

        const totalSupplyBefore = await deployedToken.totalSupply();

        const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
        const gasLimit = estimateValues[1];

        const bridgePayment = await router.getBridgeFee(allowedChainIds[0], gasLimit, 0n, "0x");

        await expect(() => deployedToken.connect(user).bridge(
            user,
            user.address,
            amountToBridge,
            allowedChainIds[0],
            gasLimit,
            "0x",
            "0x",
            { value: bridgePayment }
        )).to.changeTokenBalances(deployedToken, [user, executor], [-amountToBridge, feeAmount]);

        const totalSupplyAfter = await deployedToken.totalSupply();

        expect(totalSupplyBefore - amountToBridge + feeAmount).to.equal(totalSupplyAfter);
        expect(await deployedToken.balanceOf(executor)).to.equal(feeAmount);

        const filter = deployedToken.filters.Bridged;
        const events = await deployedToken.queryFilter(filter, -1);
        const args = events[0].args;

        expect(await args[5]).to.equal(amountToBridge - feeAmount);
    });

    it("Token bridge with fee onBehalfOf", async function () {
        const { admin, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = true;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 150000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const feeRate = 1111n;

        await deployedToken.connect(user).setFeeCollector(executor);
        await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

        expect(await deployedToken.feeCollector()).to.equal(executor);
        expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

        const amountToBridge = withDecimals("1");
        const feeAmount = amountToBridge * feeRate / 10000n;

        const totalSupplyBefore = await deployedToken.totalSupply();
        const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
        const gasLimit = estimateValues[1];
        const bridgePayment = await router.getBridgeFee(allowedChainIds[0], gasLimit, 0n, "0x");

        await deployedToken.connect(user).transfer(admin, amountToBridge);
        await deployedToken.connect(admin).approve(user, amountToBridge);

        await expect(() => deployedToken.connect(user).bridge(
            admin,
            user.address,
            amountToBridge,
            allowedChainIds[0],
            gasLimit,
            "0x",
            "0x",
            { value: bridgePayment }
        )).to.changeTokenBalances(deployedToken, [admin, executor], [-amountToBridge, feeAmount]);

        const totalSupplyAfter = await deployedToken.totalSupply();

        expect(totalSupplyBefore - amountToBridge + feeAmount).to.equal(totalSupplyAfter);
        expect(await deployedToken.balanceOf(executor)).to.equal(feeAmount);

        const filter = deployedToken.filters.Bridged;
        const events = await deployedToken.queryFilter(filter, -1);
        const args = events[0].args;

        expect(await args[5]).to.equal(amountToBridge - feeAmount);
    });

    it("Token bridgeWithSlippageCheck with fee", async function () {
        const { adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const name = "check0";
        const symbol = "check1";
        const decimals = 18n;
        const initialSupply = withDecimals("100000");
        const mintable = false;
        const globalBurnable = false;
        const onlyRoleBurnable = false;
        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 150000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
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

        const feeRate = 7987n;

        await deployedToken.connect(user).setFeeCollector(executor);
        await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

        expect(await deployedToken.feeCollector()).to.equal(executor);
        expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

        const amountToBridge = withDecimals("1");
        const feeAmount = amountToBridge * feeRate / 10000n;

        const totalSupplyBefore = await deployedToken.totalSupply();
        const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
        const gasLimit = estimateValues[1];
        const bridgePayment = await router.getBridgeFee(allowedChainIds[0], gasLimit, 0n, "0x");

        await expect(() => deployedToken.connect(user).bridgeWithSlippageCheck(
            user,
            user.address,
            amountToBridge,
            allowedChainIds[0],
            gasLimit,
            feeRate,
            "0x",
            "0x",
            { value: bridgePayment }
        )).to.changeTokenBalances(deployedToken, [user, executor], [-amountToBridge, feeAmount]);

        const totalSupplyAfter = await deployedToken.totalSupply();

        expect(totalSupplyBefore - amountToBridge + feeAmount).to.equal(totalSupplyAfter);
        expect(await deployedToken.balanceOf(executor)).to.equal(feeAmount);
    });

    it("Connector bridge with fee", async function () {
        const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 150000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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

        const feeRate = 7777n;

        await deployedConnector.connect(user).setFeeCollector(executor);
        await deployedConnector.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

        expect(await deployedConnector.feeCollector()).to.equal(executor);
        expect(await deployedConnector.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

        const amountToBridge = withDecimals("99");
        const feeAmount = amountToBridge * feeRate / 10000n;

        const totalSupplyBefore = await justToken.totalSupply();
        const userBalanceBefore = await justToken.balanceOf(user);
        const executorBalanceBefore = await justToken.balanceOf(executor);
        const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
        const estimateValues = await deployedConnector.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
        const gasLimit = estimateValues[1];
        const bridgePayment = await router.getBridgeFee(allowedChainIds[0], gasLimit, 0n, "0x");

        await justToken.connect(user).approve(deployedConnector.target, amountToBridge);

        await expect(() => deployedConnector.connect(user).bridge(
            user,
            user.address,
            amountToBridge,
            allowedChainIds[0],
            gasLimit,
            "0x",
            "0x",
            { value: bridgePayment }
        )).to.changeTokenBalances(justToken, [user, executor, deployedConnector], [-amountToBridge, feeAmount, amountToBridge - feeAmount]);

        const totalSupplyAfter = await justToken.totalSupply();
        const userBalanceAfter = await justToken.balanceOf(user);
        const executorBalanceAfter = await justToken.balanceOf(executor);
        const connectorBalanceAfter = await justToken.balanceOf(deployedConnector.target);

        expect(totalSupplyBefore).to.equal(totalSupplyAfter);
        expect(userBalanceBefore - amountToBridge).to.equal(userBalanceAfter);
        expect(executorBalanceBefore + feeAmount).to.equal(executorBalanceAfter);
        expect(connectorBalanceBefore + amountToBridge - feeAmount).to.equal(connectorBalanceAfter);

        const filter = deployedConnector.filters.Bridged;
        const events = await deployedConnector.queryFilter(filter, -1);
        const args = events[0].args;

        expect(await args[5]).to.equal(amountToBridge - feeAmount);
    });

    it("Connector bridgeWithSlippageCheck with fee", async function () {
        const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

        const feeModule = true;
        const allowedChainIds = [testDstChainId];
        const configMinGasLimit = 150000n;
        const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimals = 10n;
        const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

        const { deployedConnector } = await deployConnectorByFactory(
            executor,
            user,
            justToken,
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

        const feeRate = 111n;

        await deployedConnector.connect(user).setFeeCollector(executor);
        await deployedConnector.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

        expect(await deployedConnector.feeCollector()).to.equal(executor);
        expect(await deployedConnector.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

        const amountToBridge = withDecimals("99");
        const feeAmount = amountToBridge * feeRate / 10000n;

        const totalSupplyBefore = await justToken.totalSupply();
        const userBalanceBefore = await justToken.balanceOf(user);
        const executorBalanceBefore = await justToken.balanceOf(executor);
        const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
        const estimateValues = await deployedConnector.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
        const gasLimit = estimateValues[1];
        const bridgePayment = await router.getBridgeFee(allowedChainIds[0], gasLimit, 0n, "0x");

        await justToken.connect(user).approve(deployedConnector.target, amountToBridge);

        await expect(() => deployedConnector.connect(user).bridgeWithSlippageCheck(
            user,
            user.address,
            amountToBridge,
            allowedChainIds[0],
            gasLimit,
            feeRate,
            "0x",
            "0x",
            { value: bridgePayment }
        )).to.changeTokenBalances(justToken, [user, executor, deployedConnector], [-amountToBridge, feeAmount, amountToBridge - feeAmount]);

        const totalSupplyAfter = await justToken.totalSupply();
        const userBalanceAfter = await justToken.balanceOf(user);
        const executorBalanceAfter = await justToken.balanceOf(executor);
        const connectorBalanceAfter = await justToken.balanceOf(deployedConnector.target);

        expect(totalSupplyBefore).to.equal(totalSupplyAfter);
        expect(userBalanceBefore - amountToBridge).to.equal(userBalanceAfter);
        expect(executorBalanceBefore + feeAmount).to.equal(executorBalanceAfter);
        expect(connectorBalanceBefore + amountToBridge - feeAmount).to.equal(connectorBalanceAfter);
    });
});