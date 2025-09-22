const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { convertToBytes, encodeParamsToRedeem, validateBridgeFee, deployTokenByFactory, AbiCoder } = require("../utils/ERC20UtilFunctions");
const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/ERC20Fixture");
const { globalProtocolVersion, routerBridgeMessageType } = require("../utils/GlobalConstants");

describe("ATS Router", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { router, masterRouter, minGasLimit } = await loadFixture(ERC20Fixture);

            expect(await router.dstMinGasLimit(0)).to.equal(285000);
            expect(await router.dstMinGasLimit(testDstChainId)).to.equal(minGasLimit);
            expect(await router.dstMinGasLimit(testCurChainId)).to.equal(285000);
            expect(await router.MASTER_ROUTER()).to.equal(masterRouter.target);
            expect(await router.protocolVersion()).to.equal(globalProtocolVersion);
            expect(await router.SYSTEM_CONTRACT_TYPE()).to.equal("0x02");
        });
    });

    describe("AccessControl", function () {
        it("setDstMinGasLimit", async function () {
            const { admin, user, router, managerRole } = await loadFixture(ERC20Fixture);

            await expect(router.connect(user).setDstMinGasLimit(
                [1],
                [1]
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).grantRole(managerRole, user);

            await router.connect(user).setDstMinGasLimit([1], [1]);

            expect(await router.dstMinGasLimit(1)).to.equal(1);
        });

        it("setDstUpdateGas", async function () {
            const { admin, user, router, managerRole } = await loadFixture(ERC20Fixture);

            await expect(router.connect(user).setDstUpdateGas(
                [1], [1]
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).grantRole(managerRole, user);

            await router.connect(admin).setDstUpdateGas([1], [1]);

            expect(await router.dstUpdateGas(1)).to.equal(1);
        });

        it("pause", async function () {
            const { admin, pauserRole, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(admin).pause(
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).grantRole(pauserRole, admin);
            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);
        });

        it("unpause", async function () {
            const { admin, user, router, pauserRole } = await loadFixture(ERC20Fixture);

            await router.connect(admin).grantRole(pauserRole, admin);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

            await expect(router.connect(user).unpause(
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);
        });
    });

    describe("Pausable", function () {
        it("bridge", async function () {
            const { admin, router, pauserRole } = await loadFixture(ERC20Fixture);

            expect(await router.paused()).to.equal(false);

            await router.connect(admin).grantRole(pauserRole, admin);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

            await expect(router.connect(admin).bridge(
                ethers.zeroPadValue(router.target, 32),
                admin.address,
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                123,
                1234,
                "0x",
                "0x",
            )).to.be.revertedWithCustomError(router, "EnforcedPause");

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);
        });

        it("requestToUpdateConfig", async function () {
            const { admin, router, pauserRole } = await loadFixture(ERC20Fixture);

            expect(await router.paused()).to.equal(false);

            await router.connect(admin).grantRole(pauserRole, admin);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

            await expect(router.connect(admin).requestToUpdateConfig(
                admin.address,
                [],
                [],
                []
            )).to.be.revertedWithCustomError(router, "EnforcedPause");

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);
        });

        it("redeem", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, admin, factory, router, endpoint, zeroHash, functionSelector, pauserRole } = await loadFixture(ERC20Fixture);

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

            await router.connect(admin).grantRole(pauserRole, admin);

            expect(await router.paused()).to.equal(false);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

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
                3n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);

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

    describe("getBridgeFee", function () {
        it("Math test", async function () {
            const { router } = await loadFixture(ERC20Fixture);

            let chainId = testDstChainId;
            let gasLimit = 0n;
            let payloadLength = 0n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 1237890n;
            payloadLength = 123n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 0n;
            payloadLength = 1234n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 1237790n;
            payloadLength = 0n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            chainId = 0n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            chainId = 56n;
            gasLimit = 7989789n;
            payloadLength = 777n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 777890n;
            payloadLength = 1n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 99999n;
            payloadLength = 0n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 1n;
            payloadLength = 77n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            chainId = 100n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 0n;
            payloadLength = 100000n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);

            gasLimit = 999999n;
            payloadLength = 999n;

            await validateBridgeFee(router, router, chainId, gasLimit, payloadLength);
        });
    });

    describe("getUpdateFee", function () {
        it("Math test", async function () {
            const { router, admin, managerRole } = await loadFixture(ERC20Fixture);

            await router.connect(admin).grantRole(managerRole, admin);

            await router.connect(admin).setDstUpdateGas([testDstChainId, 56n], [13333n, 77777n]);

            let estimatedPayment = await router.getUpdateFee([testDstChainId], [0]);

            expect(estimatedPayment).to.equal(testDstChainId * 13333n * 4n);

            estimatedPayment = await router.getUpdateFee([testDstChainId, 56n], [13n, 7n]);

            expect(estimatedPayment).to.equal((testDstChainId * 13333n * (4n + 13n)) + (56n * 77777n * (4n + 7n)));
        });
    });

    describe("Redeem", function () {
        it("Infinite redeem return data", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const ATSTokenMockTwo = await ethers.getContractFactory("ATSTokenMockTwo", admin);
            const mock = await ATSTokenMockTwo.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");
            const gasLimit = 1000000n;
            const customPayload = "0xffaa0011";

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                customPayload
            );

            const userBalanceBefore = await mock.balanceOf(user);
            const totalSupplyBefore = await mock.totalSupply();

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
                mock.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );

            expect(userBalanceBefore).to.equal(await mock.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await mock.totalSupply());

            expect(await mock.isExecutionFailed(
                user,
                amountToRedeem,
                customPayload,
                [user.address, allowedChainIds[0], configPeer, configDecimals],
                1
            )).to.equal(true);

            filter = mock.filters.ExecutionFailed;
            events = await mock.queryFilter(filter, -1);
            args = events[0].args;

            expect(args[0]).to.equal(user.address);
            expect(args[1]).to.equal(amountToRedeem);
            expect(args[2]).to.equal(customPayload);
        });

        it("Infinite storeFailedExecution return data", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

            const ATSTokenMock = await ethers.getContractFactory("ATSTokenMock", admin);
            const mock = await ATSTokenMock.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");
            const gasLimit = 1000000n;

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                "0xff"
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

        it("Should return error code by invalid protocol version", async function () {
            const { adminRole, zeroAddress, registry, factory, executor, user, router, zeroHash, endpoint, masterRouter, functionSelector } = await loadFixture(ERC20Fixture);

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
            const gasLimit = 1000000n;

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
                amountToRedeem,
                testDstChainId,
                configPeer,
                configDecimals,
                gasLimit,
                "0x"
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                deployedToken.target,
                "0xff",
                localParams
            ]);

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
                12n,
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

    describe("Errors", function () {
        it("Should return error code by srcToken eq zero address", async function () {
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

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                "0x",
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
                8n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by invalid source chain id (current)", async function () {
            const { admin, masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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
                999n,
                allowedChainIds[0],
                "0x",
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
                8n,
                deployedToken.target,
                router.target,
                params,
                allowedChainIds[0],
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("Should return error code by invalid source chain id (different)", async function () {
            const { admin, masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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
                [0],
                ["0x00"]
            );

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
                999n,
                allowedChainIds[0],
                "0x",
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
                        0n,
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
                0n,
                [zeroHash, zeroHash]
            ).to.emit(endpoint, "MessageExecuted").withArgs(
                anyValue
            );
        });

        it("ATS Router E0 bridge", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

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

            await router.connect(admin).setDstMinGasLimit([allowedChainIds[0]], [1n]);

            const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], 0n, 0n, "0x");
            const gasLimit = estimateValues[1];

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit - 1n }
            )).to.be.revertedWithCustomError(router, "ATSRouter__E0");

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                allowedChainIds[0],
                gasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * gasLimit * 10n }
            );
        });

        it("ATS Router E0 update", async function () {
            const { admin, masterRouter, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

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

            await masterRouter.connect(admin).setDstMasterRouter(
                [testDstChainId, 138],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await router.connect(admin).setDstUpdateGas(
                [testDstChainId, 138],
                [123456, 78900]
            );

            const paymentAmount = await router.getUpdateFee([testDstChainId, 138], [10, 1]);
            const paymentAmountBase = await deployedToken.estimateUpdateFee([testDstChainId, 138], [10, 1]);

            expect(paymentAmount).to.equal(paymentAmountBase);

            const config = ["0xf4c3efb93eec00", 123n, 243n, true];
            const updateConfigTen = [
                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                [config, config, config, config, config, config, config, config, config, config]
            ];

            await deployedToken.connect(user).setChainConfig(
                [testDstChainId, 138],
                [config, config]
            );

            await deployedToken.connect(user).setChainConfigToDestination(
                [testDstChainId, 138],
                [updateConfigTen, [[1n], [config]]],
                { value: paymentAmount * 20n }
            );

            await expect(deployedToken.connect(user).setChainConfigToDestination(
                [testDstChainId, 138],
                [updateConfigTen, [[1n], [config]]],
                { value: paymentAmount - 10n }
            )).to.be.revertedWithCustomError(router, "ATSRouter__E0");
        });

        it("ATS Router E1 bridge", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

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

            await router.connect(admin).setDstMinGasLimit([testCurChainId], [1n]);

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                testCurChainId,
                configMinGasLimit,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(router, "ATSRouter__E1");
        });

        it("ATS Router E1 redeem", async function () {
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

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                testCurChainId,
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
                6n,
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

        it("ATS Router E2", async function () {
            const { mockRouter, admin, router } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion("0xffff");

            expect(await router.protocolVersion()).to.equal(globalProtocolVersion);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(router.target, 32),
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                31336,
                1234,
                "0x",
                "0x",
            )).to.be.revertedWithCustomError(router, "ATSRouter__E2");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [],
                [],
                []
            )).to.be.revertedWithCustomError(router, "ATSRouter__E2");
        });

        it("ATS Router E3", async function () {
            const { admin, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(admin).execute(
                0,
                admin,
                "0xff",
                "0x"
            )).to.be.revertedWithCustomError(router, "ATSRouter__E3");
        });

        it("ATS Router E4", async function () {
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

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                zeroAddress,
                999n,
                allowedChainIds[0],
                zeroHash,
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
                7n,
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

        it("ATS Router E5 bridge", async function () {
            const { adminRole, zeroAddress, registry, factory, user, executor, router, zeroHash } = await loadFixture(ERC20Fixture);

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

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                allowedChainIds[0] + 1n,
                500000n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(router, "ATSRouter__E5");
        });

        it("ATS Router E5 redeem empty address", async function () {
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

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                zeroAddress,
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
                7n,
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

        it("ATS Router E5 redeem zero address", async function () {
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
                zeroAddress,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            ]);

            let params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                await convertToBytes(deployedToken),
                routerBridgeMessageType,
                localParams
            ]);

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
                7n,
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

        it("ATS Router E6", async function () {
            const { mockRouter, admin, router, managerRole } = await loadFixture(ERC20Fixture);

            const gasLimit = 1000n;
            const testDstChainId = 31336n;
            await mockRouter.setProtocolVersion(globalProtocolVersion);
            await router.connect(admin).grantRole(managerRole, admin);
            await router.connect(admin).setDstMinGasLimit([testDstChainId], [gasLimit]);

            expect(await router.dstMinGasLimit(testDstChainId)).to.equal(gasLimit);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(mockRouter.target, 32),
                ethers.zeroPadValue(mockRouter.target, 32),
                1,
                12,
                testDstChainId,
                gasLimit - 1n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(router, "ATSRouter__E6");
        });

        it("ATS Router E7", async function () {
            const { mockRouter, admin, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(admin).setDstMinGasLimit(
                [1], [1, 2]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(router.connect(admin).setDstMinGasLimit(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(router.connect(admin).setDstUpdateGas(
                [1], [1, 2]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(router.connect(admin).setDstUpdateGas(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await mockRouter.setProtocolVersion("0xf000");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [1],
                [],
                []
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [],
                ["0x01"],
                []
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [],
                ["0x01"],
                [[[1], []]]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [1],
                ["0x01"],
                []
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(router.connect(admin).getUpdateFee(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");

            await expect(router.connect(admin).getUpdateFee(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "ATSRouter__E7");
        });
    });
});