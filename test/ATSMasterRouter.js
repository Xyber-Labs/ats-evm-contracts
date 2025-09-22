const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("./utils/ERC20Fixture");
const { encodeParamsToRedeem, deployTokenByFactory, AbiCoder } = require("./utils/ERC20UtilFunctions");
const { globalProtocolVersion } = require("./utils/GlobalConstants");

describe("ATS MasterRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { router, masterRouter } = await loadFixture(ERC20Fixture);

            expect(await masterRouter.dstMasterRouter(testDstChainId)).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(await masterRouter.validateRouter(router.target)).to.equal(true);
            expect(await masterRouter.SYSTEM_CONTRACT_TYPE()).to.equal("0x00");
        });

        it("ATS MasterRouter E3", async function () {
            const { admin, masterRouter } = await loadFixture(ERC20Fixture);

            const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const newChainId = 999;

            await expect(masterRouter.connect(admin).setDstMasterRouter(
                [newChainId, 1],
                [newAddress]
            )).to.be.revertedWithCustomError(masterRouter, "ATSMasterRouter__E3");

            await expect(masterRouter.connect(admin).setDstMasterRouter(
                [newChainId],
                [newAddress, newAddress]
            )).to.be.revertedWithCustomError(masterRouter, "ATSMasterRouter__E3");

            await masterRouter.connect(admin).setDstMasterRouter([newChainId, testCurChainId], [newAddress, newAddress]);

            expect(await masterRouter.dstMasterRouter(newChainId)).to.equal(newAddress);
            expect(await masterRouter.dstMasterRouter(testCurChainId)).to.equal(newAddress);
        });
    });

    describe("AccessControl", function () {
        it("sendProposal", async function () {
            const { user, masterRouter } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(user).sendProposal(
                0,
                1,
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstMasterRouter", async function () {
            const { admin, user, masterRouter } = await loadFixture(ERC20Fixture);

            const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const newChainId = 999;

            await expect(masterRouter.connect(user).setDstMasterRouter(
                [newChainId],
                [newAddress]
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).setDstMasterRouter([newChainId], [newAddress]);

            expect(await masterRouter.dstMasterRouter(newChainId)).to.equal(newAddress);
        });

        it("pause", async function () {
            const { admin, masterRouter, pauserRole } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(admin).pause(
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).grantRole(pauserRole, admin);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);
        });

        it("unpause", async function () {
            const { admin, user, masterRouter, pauserRole } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).grantRole(pauserRole, admin);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);

            await expect(masterRouter.connect(user).unpause(
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).unpause();

            expect(await masterRouter.paused()).to.equal(false);
        });
    });

    describe("Pausable", function () {
        it("sendProposal", async function () {
            const { admin, routerRole, endpoint, masterRouter, pauserRole, functionSelector, gasEstimator } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).grantRole(pauserRole, admin);
            await masterRouter.connect(admin).grantRole(routerRole, admin);

            expect(await masterRouter.paused()).to.equal(false);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);

            await expect(masterRouter.connect(admin).sendProposal(
                0,
                0,
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "EnforcedPause");

            await masterRouter.connect(admin).unpause();

            expect(await masterRouter.paused()).to.equal(false);

            const dstGasLimit = 500000n;

            const estimateValue = await gasEstimator.estimateExecutionWithGas(testDstChainId, dstGasLimit);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                dstGasLimit
            ]);

            await expect(masterRouter.connect(admin).sendProposal(
                dstGasLimit,
                testDstChainId,
                "0x",
                { value: estimateValue }
            )).to.emit(endpoint, "MessageProposed").withArgs(
                testDstChainId,
                estimateValue,
                functionSelector,
                transmitterParams,
                anyValue,
                ethers.zeroPadValue(masterRouter.target, 32),
                "0x",
                "0x"
            );
        });

        it("executeProposal", async function () {
            const {
                adminRole, zeroAddress, registry, factory, router, user, executor, admin, zeroHash, endpoint, masterRouter, pauserRole, functionSelector
            } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).grantRole(pauserRole, admin);

            expect(await masterRouter.paused()).to.equal(false);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);

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
                        ["0xff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00", zeroHash]
                    ]
                ],
                [[0n, zeroHash, zeroHash]],
                "0x"
            )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                11n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                ["0xff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00", zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            await masterRouter.connect(admin).unpause();

            expect(await masterRouter.paused()).to.equal(false);
        });
    });

    describe("sendProposal", function () {
        it("Base test", async function () {
            const { admin, routerRole, endpoint, masterRouter, functionSelector, gasEstimator } = await loadFixture(ERC20Fixture);

            const chainId = 3n;
            const params = "0xf4a89e12bd90116bc12f";

            await masterRouter.connect(admin).grantRole(routerRole, admin);
            await masterRouter.connect(admin).setDstMasterRouter([chainId], [ethers.zeroPadValue(masterRouter.target, 32)]);

            const dstGasLimit = 500000n;
            const estimateValue = await gasEstimator.estimateExecutionWithGas(chainId, dstGasLimit);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                dstGasLimit
            ]);

            await expect(masterRouter.connect(admin).sendProposal(
                dstGasLimit,
                chainId,
                params,
                { value: estimateValue }
            )).to.emit(endpoint, "MessageProposed").withArgs(
                chainId,
                estimateValue,
                functionSelector,
                transmitterParams,
                anyValue,
                ethers.zeroPadValue(masterRouter.target, 32),
                params,
                "0x"
            );
        });

        it("Base non-evm test", async function () {
            const {
                user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, endpoint, functionSelector, masterRouter
            } = await loadFixture(ERC20Fixture);

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
            const configPeer = "0xfff4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00ff";
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

            const tokenAmountToBridge = await deployedToken.balanceOf(user);

            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 1n, 0n, "0x");
            const gasLimit = estimateValues[1];

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                gasLimit
            ]);

            await expect(deployedToken.connect(user).bridge(
                user.address,
                configPeer,
                tokenAmountToBridge,
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit }
            )).to.emit(endpoint, "MessageProposed").withArgs(
                testDstChainId,
                anyValue,
                functionSelector,
                transmitterParams,
                ethers.zeroPadValue(masterRouter.target, 32),
                ethers.zeroPadValue(masterRouter.target, 32),
                anyValue,
                "0x"
            );
        });

        it("ATS MasterRouter E2", async function () {
            const { mockRouter, masterRouter, admin, router, routerRole } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion(globalProtocolVersion);

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(router.target, 32),
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                81457,
                1000000,
                "0x",
                "0x",
                { value: withDecimals("1") }
            )).to.be.revertedWithCustomError(masterRouter, "ATSMasterRouter__E2");

            await masterRouter.connect(admin).grantRole(routerRole, admin.address);

            await expect(masterRouter.connect(admin).sendProposal(
                0n,
                testCurChainId,
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "ATSMasterRouter__E2");
        });
    });

    describe("executeProposal", function () {
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

            const invalidConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                invalidConfigPeer,
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
        });

        it("Failure case", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const ATSTokenMock = await ethers.getContractFactory("ATSTokenMock", admin);
            const mock = await ATSTokenMock.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");

            const invalidConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                invalidConfigPeer,
                configDecimals,
                165001n,
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
        });

        it("ATS MasterRouter E0", async function () {
            const { admin, masterRouter } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(admin).execute(
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "ATSMasterRouter__E0");
        });

        it("Unauthorized router", async function () {
            const {
                functionSelector, endpoint, routerRole, adminRole, zeroAddress, router, factory, executor, registry, user, admin, zeroHash, masterRouter
            } = await loadFixture(ERC20Fixture);

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

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
                "0x"
            );

            await masterRouter.connect(admin).revokeRole(routerRole, router);

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
                4n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Invalid dstPeer", async function () {
            const { functionSelector, endpoint, zeroAddress, registry, user, zeroHash, masterRouter } = await loadFixture(ERC20Fixture);

            const initialSupply = withDecimals("1");
            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const params = await encodeParamsToRedeem(
                user,
                registry,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000n
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
                5n,
                registry.target,
                zeroAddress,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Invalid router address", async function () {
            const { zeroAddress, functionSelector, endpoint, user, zeroHash, masterRouter } = await loadFixture(ERC20Fixture);

            const initialSupply = withDecimals("1");
            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const params = await encodeParamsToRedeem(
                user,
                zeroAddress,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
                "0x"
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                50000n
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
                5n,
                zeroAddress,
                zeroAddress,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Invalid source chain Id", async function () {
            const {
                functionSelector, endpoint, adminRole, zeroAddress, router, factory, executor, registry, user, admin, zeroHash, masterRouter
            } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).setDstMasterRouter([1n], [ethers.zeroPadValue(masterRouter.target, 32)]);

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

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
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
                        (1n) << 128n,
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
                1n,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        "0x",
                        ethers.zeroPadValue(masterRouter.target, 32),
                        params,
                        "0x",
                        transmitterParams
                    ], [
                        (187903n) << 128n,
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
                187903n,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            await masterRouter.connect(admin).setDstMasterRouter([testCurChainId], [ethers.zeroPadValue(masterRouter.target, 32)]);

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
});