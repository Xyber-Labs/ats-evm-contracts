const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { convert, encodeParamsToRedeem, deployTokenByFactory, deployConnectorByFactory, AbiCoder } = require("../utils/ERC20UtilFunctions");
const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/ERC20Fixture");
const { globalProtocolVersion } = require("../utils/GlobalConstants");

describe("ATS Factory", function () {
    it("Init settings", async function () {
        const {
            factory, codeStorage, codeStoragePure, codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, dRouter, registry,
            masterRouter, codeStorageConnectorWithFee, codeStorageConnectorNative, nativeAddress
        } = await loadFixture(ERC20Fixture);

        expect(await factory.codeStorage(0)).to.equal(codeStorage.target);
        expect(await factory.codeStorage(1)).to.equal(codeStorageMintable.target);
        expect(await factory.codeStorage(2)).to.equal(codeStorageTokenWithFee.target);
        expect(await factory.codeStorage(3)).to.equal(codeStorageMintableWithFee.target);
        expect(await factory.codeStorage(4)).to.equal(codeStoragePure.target);
        expect(await factory.codeStorage(5)).to.equal(codeStorageConnectorWithFee.target);
        expect(await factory.codeStorage(6)).to.equal(codeStorageConnectorNative.target);
        expect(await factory.router()).to.equal(dRouter.target);
        expect(await factory.REGISTRY()).to.equal(registry.target);
        expect(await factory.MASTER_ROUTER()).to.equal(masterRouter.target);
        expect(await factory.protocolVersion()).to.equal(globalProtocolVersion);
        expect(await factory.NATIVE_ADDRESS()).to.equal(nativeAddress);
        expect(await factory.SYSTEM_CONTRACT_TYPE()).to.equal("0x03");
    });

    describe("AccessControl", function () {
        it("setRouter", async function () {
            const { user, admin, factory } = await loadFixture(ERC20Fixture);

            await expect(factory.connect(user).setRouter(
                admin
            )).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");

            await factory.connect(admin).setRouter(admin);

            expect(await factory.router()).to.equal(admin);
        });

        it("setCodeStorage", async function () {
            const { user, admin, factory } = await loadFixture(ERC20Fixture);

            await expect(factory.connect(user).setCodeStorage(
                [1],
                [admin]
            )).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");

            await factory.connect(admin).setCodeStorage([1], [admin]);

            expect(await factory.codeStorage(1)).to.equal(admin);
        });
    });

    describe("Deploy", function () {
        it("Token init settings", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, routerRole, mockRouter, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

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
            const userBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
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
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedToken.connect(user).setRouter(mockRouter.target);

            const filter = registry.filters.RouterUpdated;
            const events = await registry.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(deployedToken.target);
            expect(await args[1]).to.equal(mockRouter.target);

            expect(await deployedToken.router()).to.equal(mockRouter.target);
        });

        it("Token init settings zero initialSupply", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, routerRole, mockRouter, masterRouter, endpoint, functionSelector } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = 0;
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

            expect(await deployedToken.balanceOf(user)).to.equal(0);
            expect(await deployedToken.totalSupply()).to.equal(0);

            const amountToRedeem = withDecimals("1500");
            const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
            const userBalanceBefore = await deployedToken.balanceOf(user);
            const totalSupplyBefore = await deployedToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
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
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
            expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedToken.connect(user).setRouter(mockRouter.target);

            expect(await deployedToken.router()).to.equal(mockRouter.target);
        });

        it("Connector init settings", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, mockRouter, routerRole, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const feeModule = true;
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

            const decimals = await justToken.decimals();
            const amountToRedeem = withDecimals("150");
            const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
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

            expect(connectorBalanceBefore - amountToReceive).to.equal(await justToken.balanceOf(deployedConnector.target));
            expect(userBalanceBefore + amountToReceive).to.equal(await justToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await justToken.totalSupply());

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
            await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
            await deployedConnector.connect(user).setRouter(mockRouter.target);

            expect(await deployedConnector.router()).to.equal(mockRouter.target);
        });

        it("ATS Factory E0", async function () {
            const { user, factory } = await loadFixture(ERC20Fixture);

            await expect(factory.connect(user).deployByRouter(
                true,
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(factory, "ATSFactory__E0");
        });
    });

    describe("Pausable", function () {
        it("deployToken", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, pauserRole } = await loadFixture(ERC20Fixture);

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

            await factory.connect(admin).grantRole(pauserRole, admin);

            await factory.connect(admin).pause();

            await expect(deployTokenByFactory(
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
            )).to.be.revertedWithCustomError(factory, "EnforcedPause");

            await factory.connect(admin).unpause();

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
        });

        it("deployConnector", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, pauserRole } = await loadFixture(ERC20Fixture);

            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            await factory.connect(admin).grantRole(pauserRole, admin);

            await factory.connect(admin).pause();

            await expect(deployConnectorByFactory(
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
            )).to.be.revertedWithCustomError(factory, "EnforcedPause");

            await factory.connect(admin).unpause();

            await deployConnectorByFactory(
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
    });

    describe("ATS Factory E1", function () {
        it("Token", async function () {
            const { executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

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
                executor,
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

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                false,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E1");
        });

        it("Connector", async function () {
            const { executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken } = await loadFixture(ERC20Fixture);

            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            await deployConnectorByFactory(
                executor,
                executor,
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

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await expect(factory.connect(executor).deployConnector([
                executor.address,
                justToken.target,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E1");
        });
    });

    describe("ATS Factory E2", function () {
        it("Token", async function () {
            const { executor, factory, router } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                true,
                true,
                false,
                false,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E2");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                true,
                true,
                true,
                false,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E2");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                true,
                false,
                true,
                false,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E2");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                true,
                false,
                false,
                true,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E2");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                true,
                false,
                false,
                false,
                true,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E2");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                true,
                true,
                true,
                true,
                true,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E2");
        });
    });

    describe("ATS Factory E3", function () {
        it("setCodeStorage", async function () {
            const { user, admin, factory } = await loadFixture(ERC20Fixture);

            await expect(factory.connect(admin).setCodeStorage(
                [1],
                [admin, user]
            )).to.be.revertedWithCustomError(factory, "ATSFactory__E3");

            await expect(factory.connect(admin).setCodeStorage(
                [1, 2],
                [admin]
            )).to.be.revertedWithCustomError(factory, "ATSFactory__E3");

            await expect(factory.connect(admin).setCodeStorage(
                [1],
                []
            )).to.be.revertedWithCustomError(factory, "ATSFactory__E3");

            await factory.connect(admin).setCodeStorage([1, 2, 3], [admin, user, factory.target]);

            expect(await factory.codeStorage(1)).to.equal(admin);
            expect(await factory.codeStorage(2)).to.equal(user);
            expect(await factory.codeStorage(3)).to.equal(factory.target);
        });
    });

    describe("ATS Factory E4", function () {
        it("Token", async function () {
            const { executor, factory, router } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply + 1n,
                true,
                false,
                false,
                false,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E4");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                0,
                1n,
                true,
                false,
                false,
                false,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E4");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply + 1n,
                initialSupply,
                false,
                true,
                true,
                true,
                true,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E4");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                initialSupply - 1n,
                initialSupply,
                false,
                true,
                true,
                true,
                true,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E4");

            expect(factory.connect(executor).deployToken([
                executor.address,
                name,
                symbol,
                decimals,
                1n,
                0,
                false,
                true,
                false,
                true,
                false,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ])).to.be.revertedWithCustomError(factory, "ATSFactory__E4");
        });
    });
});