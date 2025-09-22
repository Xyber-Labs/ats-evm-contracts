const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { encodeParamsToRedeem, encodeParamsToDeploy, AbiCoder } = require("../utils/SimpleTokenUtilFunctions");
const { SimpleTokenFixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/SimpleTokenFixture");

describe("SingletonRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { masterRouter, gasEstimator, singletonFactory, singletonRouter, dstRedeemGas, dstDeployGas } = await loadFixture(SimpleTokenFixture);

            expect(await singletonRouter.MASTER_ROUTER()).to.equal(masterRouter.target);
            expect(await singletonRouter.GAS_ESTIMATOR()).to.equal(gasEstimator.target);
            expect(await singletonRouter.SINGLETON_FACTORY()).to.equal(singletonFactory.target);
            expect(await singletonRouter.dstSingletonRouter(testDstChainId)).to.equal(singletonRouter.target.toLowerCase());
            expect(await singletonRouter.dstRedeemGas(testDstChainId)).to.equal(dstRedeemGas);
            expect(await singletonRouter.dstDeployGas(testDstChainId)).to.equal(dstDeployGas);
            expect(await singletonRouter.router()).to.equal(singletonRouter.target);
            expect(await singletonRouter.dstSingletonRouter(testCurChainId)).to.equal("0x");
            expect(await singletonRouter.dstRedeemGas(testCurChainId)).to.equal(220000n);
            expect(await singletonRouter.dstDeployGas(testCurChainId)).to.equal(1000000n);
            expect(await singletonRouter.paused()).to.equal(false);
            expect(await singletonRouter.supportsInterface("0xd265585d")).to.equal(true);
            expect(await singletonRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await singletonRouter.SYSTEM_CONTRACT_TYPE()).to.equal("0x05");
        });

        it("Proxy test", async function () {
            const { admin, user, singletonRouter, adminRole, pauserRole } = await loadFixture(SimpleTokenFixture);

            expect(await singletonRouter.hasRole(adminRole, admin)).to.equal(true);

            await expect(singletonRouter.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(singletonRouter, "AccessControlUnauthorizedAccount");

            await expect(singletonRouter.connect(user).initialize(
                user
            )).to.be.revertedWithCustomError(singletonRouter, "InvalidInitialization");

            await singletonRouter.connect(admin).grantRole(pauserRole, admin);
            await singletonRouter.connect(admin).pause();

            expect(await singletonRouter.paused()).to.equal(true);

            const SingletonRouterImplMock = await ethers.getContractFactory("SingletonRouter", admin);
            const singletonRouterImplementation = await SingletonRouterImplMock.deploy(user.address, admin.address, singletonRouter.target, 13);
            await singletonRouterImplementation.waitForDeployment();

            await singletonRouter.connect(admin).upgradeToAndCall(singletonRouterImplementation.target, "0x");

            expect(await singletonRouter.MASTER_ROUTER()).to.equal(user.address);
            expect(await singletonRouter.GAS_ESTIMATOR()).to.equal(admin.address);
            expect(await singletonRouter.SINGLETON_FACTORY()).to.equal(singletonRouter.target);

            expect(await singletonRouter.paused()).to.equal(true);
        });
    });

    describe("Admin's functions", function () {
        it("setDstSingletonRouter", async function () {
            const { singletonRouter, admin, user } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).setDstSingletonRouter(
                [1],
                ["0xff"]
            )).to.be.revertedWithCustomError(singletonRouter, "AccessControlUnauthorizedAccount");

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [1],
                ["0xff"]
            );

            expect(await singletonRouter.dstSingletonRouter(1)).to.equal("0xff");

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [1, 2, 3],
                ["0xf5", "0xf4", "0xf3"]
            );

            expect(await singletonRouter.dstSingletonRouter(1)).to.equal("0xf5");
            expect(await singletonRouter.dstSingletonRouter(2)).to.equal("0xf4");
            expect(await singletonRouter.dstSingletonRouter(3)).to.equal("0xf3");

            await expect(singletonRouter.connect(admin).setDstSingletonRouter(
                [1, 2],
                ["0xff"]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");

            await expect(singletonRouter.connect(admin).setDstSingletonRouter(
                [],
                ["0xff"]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");

            await expect(singletonRouter.connect(admin).setDstSingletonRouter(
                [1],
                ["0xff", "0xff"]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");
        });

        it("setDstRedeemGas", async function () {
            const { singletonRouter, admin, user } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).setDstRedeemGas(
                [1],
                [1]
            )).to.be.revertedWithCustomError(singletonRouter, "AccessControlUnauthorizedAccount");

            await singletonRouter.connect(admin).setDstRedeemGas(
                [12],
                [13]
            );

            expect(await singletonRouter.dstRedeemGas(12)).to.equal(13);

            await singletonRouter.connect(admin).setDstRedeemGas(
                [12, 23, 34],
                [0, 78098, 987876]
            );

            expect(await singletonRouter.dstRedeemGas(12)).to.equal(220000n);
            expect(await singletonRouter.dstRedeemGas(23)).to.equal(78098n);
            expect(await singletonRouter.dstRedeemGas(34)).to.equal(987876n);

            await expect(singletonRouter.connect(admin).setDstRedeemGas(
                [1, 2],
                [12]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");

            await expect(singletonRouter.connect(admin).setDstRedeemGas(
                [],
                [1]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");

            await expect(singletonRouter.connect(admin).setDstRedeemGas(
                [1],
                [0, 1]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");
        });

        it("setDstDeployGas", async function () {
            const { singletonRouter, admin, user } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).setDstDeployGas(
                [1],
                [1]
            )).to.be.revertedWithCustomError(singletonRouter, "AccessControlUnauthorizedAccount");

            await singletonRouter.connect(admin).setDstDeployGas(
                [12],
                [13]
            );

            expect(await singletonRouter.dstDeployGas(12)).to.equal(13);

            await singletonRouter.connect(admin).setDstDeployGas(
                [12, 23, 34],
                [0, 78098, 987876]
            );

            expect(await singletonRouter.dstDeployGas(12)).to.equal(1000000n);
            expect(await singletonRouter.dstDeployGas(23)).to.equal(78098n);
            expect(await singletonRouter.dstDeployGas(34)).to.equal(987876n);

            await expect(singletonRouter.connect(admin).setDstDeployGas(
                [1, 2],
                [12]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");

            await expect(singletonRouter.connect(admin).setDstDeployGas(
                [],
                [1]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");

            await expect(singletonRouter.connect(admin).setDstDeployGas(
                [1],
                [0, 1]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E0");
        });

        it("pause", async function () {
            const { singletonRouter, admin, user, pauserRole } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).pause(
            )).to.be.revertedWithCustomError(singletonRouter, "AccessControlUnauthorizedAccount");

            await expect(singletonRouter.connect(user).unpause(
            )).to.be.revertedWithCustomError(singletonRouter, "AccessControlUnauthorizedAccount");

            await singletonRouter.connect(admin).grantRole(pauserRole, user);

            await singletonRouter.connect(user).pause();

            expect(await singletonRouter.paused()).to.equal(true);

            await singletonRouter.connect(user).unpause();

            expect(await singletonRouter.paused()).to.equal(false);
        });
    });

    describe("deployAndBridge", function () {
        it("paused", async function () {
            const { singletonRouter, admin, user, pauserRole } = await loadFixture(SimpleTokenFixture);

            await singletonRouter.connect(admin).grantRole(pauserRole, user);

            await singletonRouter.connect(user).pause();

            expect(await singletonRouter.paused()).to.equal(true);

            await expect(singletonRouter.connect(user).deployAndBridge(
                user.address,
                "0x",
                [[1, 0, "0x"]]
            )).to.be.revertedWithCustomError(singletonRouter, "EnforcedPause");
        });

        it("SingletonRouter E1", async function () {
            const { singletonRouter, user } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).deployAndBridge(
                user.address,
                "0x",
                [[1, 0, "0x"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E1");
        });

        it("SingletonRouter E2", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                []
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E2");
        });

        it("SingletonRouter E3", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[1, 1, "0x"]],
                { value: withDecimals("1") }
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E3");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[2, 0, "0x"], [1, 1, "0x"]],
                { value: withDecimals("10") }
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E3");
        });

        it("SingletonRouter E4", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 0, "0xff"], [testDstChainId, 0, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"], [testDstChainId, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");
        });

        it("SingletonRouter E6", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0x"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E6");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 0, "0xff"], [testDstChainId, 1, "0x"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E6");
        });

        it("Base only single deploy test", async function () {
            const { singletonRouter, user, token, tokenId, name, symbol, totalSupply, masterRouter, endpoint, functionSelector } = await loadFixture(SimpleTokenFixture);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            expect(await token.balanceOf(user.address)).to.equal(0);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply);

            const paymentValue = withDecimals("1");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 0, "0x"]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                testDstChainId
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(user.address)).to.equal(0);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply);
        });

        it("Base only multi deploy test", async function () {
            const {
                singletonRouter, user, token, tokenId, name, symbol, totalSupply, masterRouter, endpoint, functionSelector,
                dstRedeemGas, dstDeployGas, admin
            } = await loadFixture(SimpleTokenFixture);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            expect(await token.balanceOf(user.address)).to.equal(0);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply);

            const paymentValue = withDecimals("2");

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, 0, "0x"], [10, 0, "0x"], [56, 0, "0x"]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(endpoint, "MessageProposed").to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                testDstChainId
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                10
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                56
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(user.address)).to.equal(0);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply);
        });

        it("Base single deploy and bridge test", async function () {
            const {
                singletonRouter, user, token, tokenId, name, symbol, totalSupply, masterRouter, endpoint, functionSelector, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("1");
            const amountToBridge = withDecimals("100");

            await token.connect(user).approve(singletonRouter.target, amountToBridge);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, amountToBridge, admin.address]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                testDstChainId
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                admin.address.toLowerCase(),
                amountToBridge,
                testDstChainId
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - amountToBridge);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + amountToBridge);
        });

        it("Base multi deploy and bridge test", async function () {
            const {
                singletonRouter, user, token, tokenId, name, symbol, totalSupply, masterRouter, endpoint, functionSelector,
                executor, dstRedeemGas, dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("2");
            const baseAmount = withDecimals("123.37")

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            await token.connect(user).approve(singletonRouter.target, baseAmount * 6n);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, baseAmount * 2n, admin.address], [56, baseAmount * 3n, executor.address]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                testDstChainId
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                10
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                56
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                user.address.toLowerCase(),
                baseAmount,
                testDstChainId
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                admin.address.toLowerCase(),
                baseAmount * 2n,
                10
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                executor.address.toLowerCase(),
                baseAmount * 3n,
                56
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - baseAmount * 6n);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + baseAmount * 6n);
        });

        it("Base multi deploy and/or bridge test", async function () {
            const {
                singletonRouter, user, token, tokenId, name, symbol, totalSupply, masterRouter, endpoint, functionSelector,
                executor, dstRedeemGas, dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("2");
            const baseAmount = withDecimals("123.37")

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            await token.connect(user).approve(singletonRouter.target, baseAmount * 3n);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, 0, admin.address], [56, baseAmount * 2n, executor.address]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                testDstChainId
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                10
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                56
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                user.address.toLowerCase(),
                baseAmount,
                testDstChainId
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                executor.address.toLowerCase(),
                baseAmount * 2n,
                56
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - baseAmount * 3n);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + baseAmount * 3n);
        });

        it("Should revert by insufficient token balance", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector, executor,
                dstRedeemGas, dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("2");
            const baseAmount = withDecimals("1667")

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            await token.connect(user).approve(singletonRouter.target, baseAmount * 6n);

            expect(baseAmount * 6n).to.above(await token.balanceOf(user.address));

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, baseAmount * 2n, admin.address], [56, baseAmount * 3n, executor.address]],
                { value: paymentValue }
            )).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);
        });

        it("Should revert by insufficient token allowance", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector, executor,
                dstRedeemGas, dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("2");
            const baseAmount = withDecimals("1665")

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            expect(await token.balanceOf(user.address)).to.above(baseAmount * 6n);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, baseAmount * 2n, admin.address], [56, baseAmount * 3n, executor.address]],
                { value: paymentValue }
            )).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);
        });

        it("Multi deploy and/or bridge payment test", async function () {
            const {
                singletonRouter, user, token, tokenId, name, symbol, totalSupply, masterRouter, endpoint, functionSelector,
                executor, dstRedeemGas, dstDeployGas, admin, zeroHash, gasEstimator
            } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const deployAndBridgeFees = await singletonRouter.getDeployAndBridgeFees([testDstChainId, 56], "0x");
            const deployFees = await singletonRouter.getDeployFees([10], "0x");

            const paymentValue = deployAndBridgeFees[1] + deployFees[1];

            const manualPaymentValue =
                await gasEstimator.estimateExecutionWithGas(testDstChainId, await singletonRouter.dstDeployGas(testDstChainId)) +
                await gasEstimator.estimateExecutionWithGas(testDstChainId, await singletonRouter.dstRedeemGas(testDstChainId)) +
                await gasEstimator.estimateExecutionWithGas(56, await singletonRouter.dstDeployGas(56)) +
                await gasEstimator.estimateExecutionWithGas(56, await singletonRouter.dstRedeemGas(56)) +
                await gasEstimator.estimateExecutionWithGas(10, await singletonRouter.dstDeployGas(10));

            expect(paymentValue).to.equal(manualPaymentValue);

            const baseAmount = withDecimals("123.37")

            await token.connect(user).approve(singletonRouter.target, baseAmount * 3n);

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, 0, admin.address], [56, baseAmount * 2n, executor.address]],
                { value: paymentValue - 1n }
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).deployAndBridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, 0, admin.address], [56, baseAmount * 2n, executor.address]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                testDstChainId
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                10
            ).to.emit(singletonRouter, "DeployRequestSent").withArgs(
                user.address,
                tokenId,
                token.target,
                name,
                symbol,
                totalSupply,
                56
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                user.address.toLowerCase(),
                baseAmount,
                testDstChainId
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                executor.address.toLowerCase(),
                baseAmount * 2n,
                56
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - baseAmount * 3n);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + baseAmount * 3n);
        });
    });

    describe("bridge", function () {
        it("paused", async function () {
            const { singletonRouter, admin, user, pauserRole } = await loadFixture(SimpleTokenFixture);

            await singletonRouter.connect(admin).grantRole(pauserRole, user);

            await singletonRouter.connect(user).pause();

            expect(await singletonRouter.paused()).to.equal(true);

            await expect(singletonRouter.connect(user).bridge(
                user.address,
                "0x",
                []
            )).to.be.revertedWithCustomError(singletonRouter, "EnforcedPause");
        });

        it("SingletonRouter E1", async function () {
            const { singletonRouter, user } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).bridge(
                user.address,
                "0x",
                []
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E1");
        });

        it("SingletonRouter E2", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                []
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E2");
        });

        it("SingletonRouter E3", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[1, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E3");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"], [1, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E3");
        });

        it("SingletonRouter E4", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"], [testDstChainId, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"], [testDstChainId, 1, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");
        });

        it("SingletonRouter E6", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0x"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E6");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"], [testDstChainId, 1, "0x"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E6");
        });

        it("SingletonRouter E8", async function () {
            const { singletonRouter, user, token } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 0, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E8");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, 1, "0xff"], [testDstChainId, 0, "0xff"]]
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E8");
        });

        it("Base single bridge test", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("1");
            const amountToBridge = withDecimals("100");

            await token.connect(user).approve(singletonRouter.target, amountToBridge);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, amountToBridge, user.address]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                user.address.toLowerCase(),
                amountToBridge,
                testDstChainId
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - amountToBridge);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + amountToBridge);
        });

        it("Base multi bridge test", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector, executor, dstRedeemGas,
                dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("1");
            const baseAmount = withDecimals("1233.37")

            await token.connect(user).approve(singletonRouter.target, baseAmount * 6n);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, baseAmount * 3n, admin.address], [56, baseAmount * 2n, executor.address]],
                { value: paymentValue }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                user.address.toLowerCase(),
                baseAmount,
                testDstChainId
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                admin.address.toLowerCase(),
                baseAmount * 3n,
                10
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                executor.address.toLowerCase(),
                baseAmount * 2n,
                56
            );

            expect(userEtherBalanceBefore - paymentValue).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - baseAmount * 6n);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + baseAmount * 6n);
        });

        it("Should revert by insufficient token balance", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector, executor,
                dstRedeemGas, dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("2");
            const baseAmount = withDecimals("1667")

            await token.connect(user).approve(singletonRouter.target, baseAmount * 6n);

            expect(baseAmount * 6n).to.above(await token.balanceOf(user.address));

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, baseAmount * 2n, admin.address], [56, baseAmount * 3n, executor.address]],
                { value: paymentValue }
            )).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);
        });

        it("Should revert by insufficient token allowance", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector, executor,
                dstRedeemGas, dstDeployGas, admin, zeroHash
            } = await loadFixture(SimpleTokenFixture);

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = withDecimals("2");
            const baseAmount = withDecimals("1665");

            expect(await token.balanceOf(user.address)).to.above(baseAmount * 6n);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, baseAmount * 2n, admin.address], [56, baseAmount * 3n, executor.address]],
                { value: paymentValue }
            )).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);
        });

        it("Multi bridge payment test", async function () {
            const {
                singletonRouter, user, token, tokenId, totalSupply, masterRouter, endpoint, functionSelector,
                executor, dstRedeemGas, dstDeployGas, admin, zeroHash, gasEstimator
            } = await loadFixture(SimpleTokenFixture);

            await network.provider.send("hardhat_setBalance", [
                singletonRouter.target,
                "0x100000000000000000000000"
            ]);

            await masterRouter.connect(admin).setDstMasterRouter(
                [10, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await singletonRouter.connect(admin).setDstSingletonRouter(
                [10, 56],
                [singletonRouter.target, singletonRouter.target]
            );

            await singletonRouter.connect(admin).setDstRedeemGas([10, 56], [dstRedeemGas, dstRedeemGas]);
            await singletonRouter.connect(admin).setDstDeployGas([10, 56], [dstDeployGas, dstDeployGas]);

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            const initUserBalance = withDecimals("10000")
            const redeemParams = encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                initUserBalance
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await endpoint.connect(admin).execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        redeemParams,
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

            expect(await token.balanceOf(user.address)).to.equal(initUserBalance);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance);

            const paymentValue = await singletonRouter.getBridgeFees([testDstChainId, 10, 56], "0x");

            const manualPaymentValue =
                await gasEstimator.estimateExecutionWithGas(testDstChainId, await singletonRouter.dstRedeemGas(testDstChainId)) +
                await gasEstimator.estimateExecutionWithGas(56, await singletonRouter.dstRedeemGas(56)) +
                await gasEstimator.estimateExecutionWithGas(10, await singletonRouter.dstRedeemGas(10));

            expect(paymentValue[1]).to.equal(manualPaymentValue);

            const baseAmount = withDecimals("123.37")

            await token.connect(user).approve(singletonRouter.target, baseAmount * 3n + 1n);

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, 1, admin.address], [56, baseAmount * 2n, executor.address]],
                { value: paymentValue[1] - 1n }
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E4");

            await expect(singletonRouter.connect(user).bridge(
                token.target,
                "0x",
                [[testDstChainId, baseAmount, user.address], [10, 1, admin.address], [56, baseAmount * 2n, executor.address]],
                { value: paymentValue[1] }
            )).to.emit(endpoint, "MessageProposed").to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                user.address.toLowerCase(),
                baseAmount,
                testDstChainId
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                admin.address.toLowerCase(),
                1,
                10
            ).to.emit(singletonRouter, "Bridged").withArgs(
                tokenId,
                token.target,
                user.address,
                executor.address.toLowerCase(),
                baseAmount * 2n,
                56
            );

            expect(userEtherBalanceBefore - paymentValue[1]).to.above(await ethers.provider.getBalance(user.address));
            expect(await token.balanceOf(admin.address)).to.equal(0);
            expect(await token.balanceOf(executor.address)).to.equal(0);
            expect(await token.balanceOf(user.address)).to.equal(initUserBalance - baseAmount * 3n - 1n);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply - initUserBalance + baseAmount * 3n + 1n);
        });
    });

    describe("execute", function () {
        it("SingletonRouter E5", async function () {
            const { singletonRouter, user, admin } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).execute(
                testCurChainId,
                user.address,
                "0xff",
                "0x"
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E5");

            await expect(singletonRouter.connect(admin).execute(
                testDstChainId,
                user.address,
                "0xff",
                "0x"
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E5");
        });

        it("Should return result code by invalid dstPeerAddress", async function () {
            const { singletonRouter, tokenId, user, mock, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

            const params = await encodeParamsToRedeem(
                mock,
                tokenId,
                user.address,
                1
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
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
                5,
                mock.target,
                singletonRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            );
        });

        it("Should return result code by paused singletonRouter", async function () {
            const { pauserRole, admin, singletonRouter, tokenId, user, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

            const params = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                1
            );

            await singletonRouter.connect(admin).grantRole(pauserRole, admin);
            await singletonRouter.connect(admin).pause();

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await expect(await endpoint.execute(
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
                3,
                singletonRouter.target,
                singletonRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            );
        });

        it("Should return result code by paused singletonFactory", async function () {
            const { singletonFactory, pauserRole, admin, singletonRouter, tokenId, user, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

            const params = await encodeParamsToDeploy(
                singletonRouter,
                tokenId,
                "1",
                "1",
                1,
                user.address,
                0
            );

            await singletonFactory.connect(admin).grantRole(pauserRole, admin);
            await singletonFactory.connect(admin).pause();

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
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
                3,
                singletonRouter.target,
                singletonRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            );
        });

        it("Should return result code by invalid messageType", async function () {
            const { singletonRouter, tokenId, user, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

            const localParams = AbiCoder.encode([
                "bytes32",
                "bytes",
                "uint256"
            ], [
                tokenId,
                user.address,
                1
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                singletonRouter.target,
                "0xff",
                localParams
            ]);

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
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
                12,
                singletonRouter.target,
                singletonRouter.target,
                params,
                testDstChainId,
                [zeroHash, zeroHash]
            );
        });

        describe("_executeRedeem", function () {
            it("Should return result code by zero redeem amount", async function () {
                const { token, singletonRouter, tokenId, user, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const userTokenBalanceBefore = await token.balanceOf(user.address);
                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    user.address,
                    0
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.balanceOf(user.address)).to.equal(userTokenBalanceBefore);
                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            });

            it("Should return result code by invalid receiver address", async function () {
                const { token, singletonRouter, tokenId, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    "0xff",
                    1
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    17,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            });

            it("Should return result code by zero receiver address", async function () {
                const { zeroAddress, token, singletonRouter, tokenId, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    zeroAddress,
                    1
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    17,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            });

            it("Should return result code by non-existing token", async function () {
                const { user, token, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167",
                    user.address,
                    1
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    16,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            });

            it("Should return result code by failed redeem (insufficient liquidity)", async function () {
                const { admin, totalSupply, user, token, singletonRouter, tokenId, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const amountToRedeemTest = totalSupply;

                const paramsTest = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    admin.address,
                    amountToRedeemTest
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
                ]);

                await expect(endpoint.execute(
                    [
                        [
                            testCurChainId,
                            0n,
                            functionSelector,
                            ethers.zeroPadValue(masterRouter.target, 32),
                            ethers.zeroPadValue(masterRouter.target, 32),
                            paramsTest,
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    paramsTest,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.balanceOf(singletonRouter.target)).to.equal(0);
                expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

                const userTokenBalanceBefore = await token.balanceOf(user.address);
                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const amountToRedeem = withDecimals("1");

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    user.address,
                    amountToRedeem
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
                            (testDstChainId) << 128n,
                            [zeroHash, zeroHash]
                        ]
                    ],
                    [[0n, zeroHash, zeroHash]],
                    "0x"
                )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                    15,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.balanceOf(user.address)).to.equal(userTokenBalanceBefore);
                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            });

            it("Should return success result code", async function () {
                const { user, token, singletonRouter, tokenId, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const userTokenBalanceBefore = await token.balanceOf(user.address);
                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const amountToRedeem = withDecimals("1");

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    user.address,
                    amountToRedeem
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "Redeemed").withArgs(
                    tokenId,
                    token.target,
                    user.address,
                    amountToRedeem
                );

                expect(await token.balanceOf(user.address)).to.equal(userTokenBalanceBefore + amountToRedeem);
                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore - amountToRedeem);
            });
        });

        describe("_executeDeploy", function () {
            it("Should return result code by token already deployed", async function () {
                const { singletonFactory, token, singletonRouter, tokenId, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                expect(await singletonRouter.token(tokenId)).to.equal(token.target);
                expect(await singletonRouter.tokenId(token.target)).to.equal(tokenId);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    tokenId,
                    "name",
                    "symbol",
                    0,
                    "0x",
                    0
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.not.emit(singletonRouter, 'NewTokenDeployed').to.not.emit(singletonFactory, 'Deployed');

                expect(await singletonRouter.token(tokenId)).to.equal(token.target);
                expect(await singletonRouter.tokenId(token.target)).to.equal(tokenId);
            });

            it("Should return result code by failed deploy (wrong factory)", async function () {
                const { zeroAddress, gasEstimator, routerRole, admin, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const singletonFactoryFutureAddress = ethers.getCreateAddress({
                    from: admin.address,
                    nonce: await ethers.provider.getTransactionCount(admin.address) + 3
                });
                const initCalldata = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

                const SingletonRouter = await ethers.getContractFactory("SingletonRouter", admin);
                const singletonRouterImplementation = await SingletonRouter.deploy(
                    masterRouter.target,
                    gasEstimator.target,
                    singletonFactoryFutureAddress,
                    3000
                );
                await singletonRouterImplementation.waitForDeployment();

                const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy", admin);
                const singletonRouterProxy = await ERC1967Proxy.deploy(singletonRouterImplementation.target, initCalldata);
                await singletonRouterProxy.waitForDeployment();

                const singletonRouter = await ethers.getContractAt("SingletonRouter", singletonRouterProxy);

                const SingletonFactory = await ethers.getContractFactory("SingletonFactory", admin);
                const singletonFactoryImplementation = await SingletonFactory.deploy(admin.address);
                await singletonFactoryImplementation.waitForDeployment();

                const singletonFactoryProxy = await ERC1967Proxy.deploy(singletonFactoryImplementation.target, initCalldata);
                await singletonFactoryProxy.waitForDeployment();

                const singletonFactory = await ethers.getContractAt("SingletonFactory", singletonFactoryProxy);

                expect(singletonFactoryProxy.target).to.equal(singletonFactoryFutureAddress);

                await masterRouter.connect(admin).grantRole(routerRole, singletonRouter.target);
                await singletonRouter.connect(admin).setDstSingletonRouter([testDstChainId], [singletonRouter.target]);

                expect(await singletonRouter.token("0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167")).to.equal(zeroAddress);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167",
                    "name",
                    "symbol",
                    0,
                    "0x",
                    0
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    18,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.not.emit(singletonRouter, 'NewTokenDeployed').to.not.emit(singletonFactory, 'Deployed');
            });

            it("Should return result code by failed deploy (zero address)", async function () {
                const { zeroAddress, gasEstimator, routerRole, admin, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const singletonFactoryFutureAddress = ethers.getCreateAddress({
                    from: admin.address,
                    nonce: await ethers.provider.getTransactionCount(admin.address) + 2
                });
                const initCalldata = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

                const SingletonRouter = await ethers.getContractFactory("SingletonRouter", admin);
                const singletonRouterImplementation = await SingletonRouter.deploy(
                    masterRouter.target,
                    gasEstimator.target,
                    singletonFactoryFutureAddress,
                    3000
                );
                await singletonRouterImplementation.waitForDeployment();

                const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy", admin);
                const singletonRouterProxy = await ERC1967Proxy.deploy(singletonRouterImplementation.target, initCalldata);
                await singletonRouterProxy.waitForDeployment();

                const singletonRouter = await ethers.getContractAt("SingletonRouter", singletonRouterProxy);

                const Mock = await ethers.getContractFactory("Mock", admin);
                const mock = await Mock.deploy(singletonRouter.target);
                await mock.waitForDeployment();

                expect(mock.target).to.equal(singletonFactoryFutureAddress);

                await masterRouter.connect(admin).grantRole(routerRole, singletonRouter.target);
                await singletonRouter.connect(admin).setDstSingletonRouter([testDstChainId], [singletonRouter.target]);

                expect(await singletonRouter.token("0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167")).to.equal(zeroAddress);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167",
                    "name",
                    "symbol",
                    0,
                    "0x",
                    0
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    18,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.not.emit(singletonRouter, 'NewTokenDeployed').to.not.emit(mock, 'Deployed');
            });

            it("Should return result code by failed deploy and failed redeem", async function () {
                const { zeroAddress, gasEstimator, routerRole, admin, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const singletonFactoryFutureAddress = ethers.getCreateAddress({
                    from: admin.address,
                    nonce: await ethers.provider.getTransactionCount(admin.address) + 2
                });
                const initCalldata = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

                const SingletonRouter = await ethers.getContractFactory("SingletonRouter", admin);
                const singletonRouterImplementation = await SingletonRouter.deploy(
                    masterRouter.target,
                    gasEstimator.target,
                    singletonFactoryFutureAddress,
                    3000
                );
                await singletonRouterImplementation.waitForDeployment();

                const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy", admin);
                const singletonRouterProxy = await ERC1967Proxy.deploy(singletonRouterImplementation.target, initCalldata);
                await singletonRouterProxy.waitForDeployment();

                const singletonRouter = await ethers.getContractAt("SingletonRouter", singletonRouterProxy);

                const Mock = await ethers.getContractFactory("Mock", admin);
                const mock = await Mock.deploy(singletonRouter.target);
                await mock.waitForDeployment();

                expect(mock.target).to.equal(singletonFactoryFutureAddress);

                await masterRouter.connect(admin).grantRole(routerRole, singletonRouter.target);
                await singletonRouter.connect(admin).setDstSingletonRouter([testDstChainId], [singletonRouter.target]);

                expect(await singletonRouter.token("0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167")).to.equal(zeroAddress);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167",
                    "name",
                    "symbol",
                    0,
                    "0x",
                    1
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    19,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.not.emit(singletonRouter, 'NewTokenDeployed').to.not.emit(mock, 'Deployed').to.not.emit(singletonRouter, 'Redeemed');
            });

            it("Should return result code by succeed deploy and failed redeem", async function () {
                const { user, zeroAddress, singletonFactory, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint, defaultDecimals } = await loadFixture(SimpleTokenFixture);

                const tokenId = "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167";
                const name = "name";
                const symbol = "symbol";
                const initTotalSupply = withDecimals("100");
                const amountToRedeem = withDecimals("1000");

                const tokenFutureAddress = ethers.getCreateAddress({
                    from: singletonFactory.target,
                    nonce: await ethers.provider.getTransactionCount(singletonFactory.target)
                });

                expect(await singletonRouter.token(tokenId)).to.equal(zeroAddress);
                expect(await singletonRouter.tokenId(tokenFutureAddress)).to.equal(zeroHash);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    tokenId,
                    name,
                    symbol,
                    initTotalSupply,
                    user.address,
                    amountToRedeem
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    15,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "NewTokenDeployed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    name,
                    symbol,
                    initTotalSupply
                ).to.emit(singletonFactory, "Deployed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    name,
                    symbol
                ).to.not.emit(singletonRouter, "Redeemed");

                const deployedToken = await ethers.getContractAt("ERC20Token", tokenFutureAddress);

                expect(await deployedToken.name()).to.equal(name);
                expect(await deployedToken.symbol()).to.equal(symbol);
                expect(await deployedToken.decimals()).to.equal(defaultDecimals);
                expect(await deployedToken.totalSupply()).to.equal(initTotalSupply);
                expect(await deployedToken.balanceOf(singletonRouter.target)).to.equal(initTotalSupply);
                expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(0);
                expect(await deployedToken.balanceOf(user.address)).to.equal(0);
                expect(await singletonRouter.token(tokenId)).to.equal(tokenFutureAddress);
                expect(await singletonRouter.tokenId(tokenFutureAddress)).to.equal(tokenId);
            });

            it("Should return success result code only deploy", async function () {
                const { zeroAddress, singletonFactory, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint, defaultDecimals } = await loadFixture(SimpleTokenFixture);

                const tokenId = "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167";
                const name = "name";
                const symbol = "symbol";
                const initTotalSupply = withDecimals("100");

                const tokenFutureAddress = ethers.getCreateAddress({
                    from: singletonFactory.target,
                    nonce: await ethers.provider.getTransactionCount(singletonFactory.target)
                });

                expect(await singletonRouter.token(tokenId)).to.equal(zeroAddress);
                expect(await singletonRouter.tokenId(tokenFutureAddress)).to.equal(zeroHash);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    tokenId,
                    name,
                    symbol,
                    initTotalSupply,
                    singletonFactory.target,
                    0
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "NewTokenDeployed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    name,
                    symbol,
                    initTotalSupply
                ).to.emit(singletonFactory, "Deployed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    name,
                    symbol
                ).to.not.emit(singletonRouter, 'Redeemed');

                const deployedToken = await ethers.getContractAt("ERC20Token", tokenFutureAddress);

                expect(await deployedToken.name()).to.equal(name);
                expect(await deployedToken.symbol()).to.equal(symbol);
                expect(await deployedToken.decimals()).to.equal(defaultDecimals);
                expect(await deployedToken.totalSupply()).to.equal(initTotalSupply);
                expect(await deployedToken.balanceOf(singletonRouter.target)).to.equal(initTotalSupply);
                expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(0);
                expect(await deployedToken.balanceOf(singletonFactory.target)).to.equal(0);

                expect(await singletonRouter.token(tokenId)).to.equal(tokenFutureAddress);
                expect(await singletonRouter.tokenId(tokenFutureAddress)).to.equal(tokenId);
            });

            it("Should return success result code deploy and bridge", async function () {
                const { user, zeroAddress, singletonFactory, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint, defaultDecimals } = await loadFixture(SimpleTokenFixture);

                const tokenId = "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167";
                const name = "name";
                const symbol = "symbol";
                const initTotalSupply = withDecimals("100");
                const amountToRedeem = withDecimals("1");

                const tokenFutureAddress = ethers.getCreateAddress({
                    from: singletonFactory.target,
                    nonce: await ethers.provider.getTransactionCount(singletonFactory.target)
                });

                expect(await singletonRouter.token(tokenId)).to.equal(zeroAddress);
                expect(await singletonRouter.tokenId(tokenFutureAddress)).to.equal(zeroHash);

                const params = await encodeParamsToDeploy(
                    singletonRouter,
                    tokenId,
                    name,
                    symbol,
                    initTotalSupply,
                    user.address,
                    amountToRedeem
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "NewTokenDeployed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    name,
                    symbol,
                    initTotalSupply
                ).to.emit(singletonFactory, "Deployed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    name,
                    symbol
                ).to.emit(singletonRouter, "Redeemed").withArgs(
                    tokenId,
                    tokenFutureAddress,
                    user.address,
                    amountToRedeem
                );

                const deployedToken = await ethers.getContractAt("ERC20Token", tokenFutureAddress);

                expect(await deployedToken.name()).to.equal(name);
                expect(await deployedToken.symbol()).to.equal(symbol);
                expect(await deployedToken.decimals()).to.equal(defaultDecimals);
                expect(await deployedToken.totalSupply()).to.equal(initTotalSupply);
                expect(await deployedToken.balanceOf(singletonRouter.target)).to.equal(initTotalSupply - amountToRedeem);
                expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(0);
                expect(await deployedToken.balanceOf(user.address)).to.equal(amountToRedeem);

                expect(await singletonRouter.token(tokenId)).to.equal(tokenFutureAddress);
                expect(await singletonRouter.tokenId(tokenFutureAddress)).to.equal(tokenId);
            });
        });

        describe("_addFailedExecution", function () {
            it("Should add failed execution by non-existing token", async function () {
                const { user, token, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const tokenId = "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167";
                const amount = 1;

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    user.address,
                    amount
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
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
                    16,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                    tokenId,
                    user.address,
                    amount,
                    0
                ).to.not.emit(singletonRouter, 'Redeemed');

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            });

            it("Should add failed execution by failed call", async function () {
                const { tokenId, admin, totalSupply, user, token, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const amountToRedeemTest = totalSupply;

                const paramsTest = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    admin.address,
                    amountToRedeemTest
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
                ]);

                await expect(endpoint.execute(
                    [
                        [
                            testCurChainId,
                            0n,
                            functionSelector,
                            ethers.zeroPadValue(masterRouter.target, 32),
                            ethers.zeroPadValue(masterRouter.target, 32),
                            paramsTest,
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    paramsTest,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.balanceOf(singletonRouter.target)).to.equal(0);
                expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const amount = 1;

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);

                const params = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    user.address,
                    amount
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
                            (testDstChainId) << 128n,
                            [zeroHash, zeroHash]
                        ]
                    ],
                    [[0n, zeroHash, zeroHash]],
                    "0x"
                )).to.emit(masterRouter, "ProposalExecuted").withArgs(
                    15,
                    singletonRouter.target,
                    singletonRouter.target,
                    params,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                    tokenId,
                    user.address,
                    amount,
                    0
                ).to.not.emit(singletonRouter, 'Redeemed');

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
                expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            });

            it("Should retryNonce increased", async function () {
                const { tokenId, admin, totalSupply, user, token, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

                const amountToRedeemTest = totalSupply;

                const paramsTest = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    admin.address,
                    amountToRedeemTest
                );

                const transmitterParams = AbiCoder.encode([
                    "uint256",
                    "uint256"
                ], [
                    1n,
                    5000000n
                ]);

                await expect(endpoint.execute(
                    [
                        [
                            testCurChainId,
                            0n,
                            functionSelector,
                            ethers.zeroPadValue(masterRouter.target, 32),
                            ethers.zeroPadValue(masterRouter.target, 32),
                            paramsTest,
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
                    14,
                    singletonRouter.target,
                    singletonRouter.target,
                    paramsTest,
                    testDstChainId,
                    [zeroHash, zeroHash]
                );

                expect(await token.balanceOf(singletonRouter.target)).to.equal(0);
                expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

                const tokenTotalSupplyBefore = await token.totalSupply();
                const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

                const amount = 1n;

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);

                const paramsUser = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    user.address,
                    amount
                );

                await expect(endpoint.execute(
                    [
                        [
                            testCurChainId,
                            0n,
                            functionSelector,
                            ethers.zeroPadValue(masterRouter.target, 32),
                            ethers.zeroPadValue(masterRouter.target, 32),
                            paramsUser,
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
                    15,
                    singletonRouter.target,
                    singletonRouter.target,
                    paramsUser,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                    tokenId,
                    user.address,
                    amount,
                    0
                ).to.not.emit(singletonRouter, 'Redeemed');

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
                expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);

                const paramsAdmin = await encodeParamsToRedeem(
                    singletonRouter,
                    tokenId,
                    admin.address,
                    amount * 100n
                );

                await expect(endpoint.execute(
                    [
                        [
                            testCurChainId,
                            0n,
                            functionSelector,
                            ethers.zeroPadValue(masterRouter.target, 32),
                            ethers.zeroPadValue(masterRouter.target, 32),
                            paramsAdmin,
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
                    15,
                    singletonRouter.target,
                    singletonRouter.target,
                    paramsAdmin,
                    testDstChainId,
                    [zeroHash, zeroHash]
                ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                    tokenId,
                    admin.address,
                    amount * 100n,
                    1
                ).to.not.emit(singletonRouter, 'Redeemed');

                expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
                expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
                expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 1)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 0)).to.equal(false);
                expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 1)).to.equal(true);
            });
        });
    });

    describe("isExecutionFailed", function () {
        it("Should return false by zero address", async function () {
            const { zeroAddress, tokenId, admin, totalSupply, user, token, singletonRouter, zeroHash, masterRouter, functionSelector, endpoint } = await loadFixture(SimpleTokenFixture);

            const amountToRedeemTest = totalSupply;

            const paramsTest = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                admin.address,
                amountToRedeemTest
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsTest,
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
                14,
                singletonRouter.target,
                singletonRouter.target,
                paramsTest,
                testDstChainId,
                [zeroHash, zeroHash]
            );

            expect(await token.balanceOf(singletonRouter.target)).to.equal(0);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            const tokenTotalSupplyBefore = await token.totalSupply();
            const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

            const amount = 1n;

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);

            const paramsUser = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                amount
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsUser,
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
                15,
                singletonRouter.target,
                singletonRouter.target,
                paramsUser,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                tokenId,
                user.address,
                amount,
                0
            ).to.not.emit(singletonRouter, 'Redeemed');

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, zeroAddress, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, zeroAddress, amount, 1)).to.equal(false);

            const paramsAdmin = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                admin.address,
                amount * 100n
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsAdmin,
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
                15,
                singletonRouter.target,
                singletonRouter.target,
                paramsAdmin,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                tokenId,
                admin.address,
                amount * 100n,
                1
            ).to.not.emit(singletonRouter, 'Redeemed');

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 1)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, zeroAddress, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, zeroAddress, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, zeroAddress, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, zeroAddress, amount * 100n, 1)).to.equal(false);
        });
    });

    describe("retryRedeem", function () {
        it("SingletonRouter E1", async function () {
            const { user, singletonRouter, admin } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).retryRedeem(
                "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0167",
                user.address,
                0,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E1");

            await expect(singletonRouter.connect(user).retryRedeem(
                "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0168",
                admin.address,
                1,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E1");
        });

        it("SingletonRouter E7", async function () {
            const { totalSupply, token, endpoint, functionSelector, masterRouter, zeroHash, admin, tokenId, user, singletonRouter, zeroAddress } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                0,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                zeroAddress,
                1,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            const amountToRedeemTest = totalSupply;

            const paramsTest = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                admin.address,
                amountToRedeemTest
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsTest,
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
                14,
                singletonRouter.target,
                singletonRouter.target,
                paramsTest,
                testDstChainId,
                [zeroHash, zeroHash]
            );

            expect(await token.balanceOf(singletonRouter.target)).to.equal(0);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            const tokenTotalSupplyBefore = await token.totalSupply();
            const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

            const amount = 1n;

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            const paramsUser = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                amount
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsUser,
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
                15,
                singletonRouter.target,
                singletonRouter.target,
                paramsUser,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                tokenId,
                user.address,
                amount,
                0
            ).to.not.emit(singletonRouter, 'Redeemed');

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount + 1n,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            const paramsAdmin = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                admin.address,
                amount * 100n
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsAdmin,
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
                15,
                singletonRouter.target,
                singletonRouter.target,
                paramsAdmin,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                tokenId,
                admin.address,
                amount * 100n,
                1
            ).to.not.emit(singletonRouter, 'Redeemed');

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 1)).to.equal(true);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount + 1n,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                admin.address,
                amount,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                admin.address,
                amount * 100n + 1n,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(admin).retryRedeem(
                tokenId,
                user.address,
                amount,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(admin).retryRedeem(
                tokenId,
                user.address,
                amount * 100n,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");
        });

        it("Success test", async function () {
            const { totalSupply, token, endpoint, functionSelector, masterRouter, zeroHash, admin, tokenId, user, singletonRouter, zeroAddress } = await loadFixture(SimpleTokenFixture);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                0,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                zeroAddress,
                1,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            const amountToRedeemTest = totalSupply;

            const paramsTest = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                admin.address,
                amountToRedeemTest
            );

            const transmitterParams = AbiCoder.encode([
                "uint256",
                "uint256"
            ], [
                1n,
                5000000n
            ]);

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsTest,
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
                14,
                singletonRouter.target,
                singletonRouter.target,
                paramsTest,
                testDstChainId,
                [zeroHash, zeroHash]
            );

            expect(await token.balanceOf(singletonRouter.target)).to.equal(0);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            const tokenTotalSupplyBefore = await token.totalSupply();
            const routerTokenBalanceBefore = await token.balanceOf(singletonRouter.target);

            const amount = 1n;

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            const paramsUser = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                user.address,
                amount
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsUser,
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
                15,
                singletonRouter.target,
                singletonRouter.target,
                paramsUser,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                tokenId,
                user.address,
                amount,
                0
            ).to.not.emit(singletonRouter, 'Redeemed');

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount + 1n,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            const paramsAdmin = await encodeParamsToRedeem(
                singletonRouter,
                tokenId,
                admin.address,
                amount * 100n
            );

            await expect(endpoint.execute(
                [
                    [
                        testCurChainId,
                        0n,
                        functionSelector,
                        ethers.zeroPadValue(masterRouter.target, 32),
                        ethers.zeroPadValue(masterRouter.target, 32),
                        paramsAdmin,
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
                15,
                singletonRouter.target,
                singletonRouter.target,
                paramsAdmin,
                testDstChainId,
                [zeroHash, zeroHash]
            ).to.emit(singletonRouter, "ExecutionFailed").withArgs(
                tokenId,
                admin.address,
                amount * 100n,
                1
            ).to.not.emit(singletonRouter, 'Redeemed');

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBefore);
            expect(await token.balanceOf(admin.address)).to.equal(amountToRedeemTest);

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(true);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount * 100n, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount, 1)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 0)).to.equal(false);
            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 1)).to.equal(true);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount + 1n,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                admin.address,
                amount,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                admin.address,
                amount * 100n + 1n,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            await token.connect(admin).transfer(singletonRouter.target, amountToRedeemTest);

            const userTokenBalanceBeforeTwo = await token.balanceOf(user.address);
            const routerTokenBalanceBeforeTwo = await token.balanceOf(singletonRouter.target);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                0
            )).to.emit(singletonRouter, "Redeemed").withArgs(
                tokenId,
                token.target,
                user.address,
                amount
            );

            expect(await singletonRouter.isExecutionFailed(tokenId, user.address, amount, 0)).to.equal(false);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                user.address,
                amount,
                0
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBeforeTwo - amount);
            expect(await token.balanceOf(user.address)).to.equal(userTokenBalanceBeforeTwo + amount);

            const userTokenBalanceBeforeThree = await token.balanceOf(user.address);
            const adminTokenBalanceBeforeThree = await token.balanceOf(admin.address);
            const routerTokenBalanceBeforeThree = await token.balanceOf(singletonRouter.target);

            await expect(singletonRouter.connect(user).retryRedeem(
                tokenId,
                admin.address,
                amount * 100n,
                1
            )).to.emit(singletonRouter, "Redeemed").withArgs(
                tokenId,
                token.target,
                admin.address,
                amount * 100n
            );

            expect(await singletonRouter.isExecutionFailed(tokenId, admin.address, amount * 100n, 1)).to.equal(false);

            await expect(singletonRouter.connect(admin).retryRedeem(
                tokenId,
                admin.address,
                amount * 100n,
                1
            )).to.be.revertedWithCustomError(singletonRouter, "SingletonRouter__E7");

            expect(await token.totalSupply()).to.equal(tokenTotalSupplyBefore);
            expect(await token.balanceOf(user.address)).to.equal(userTokenBalanceBeforeThree);
            expect(await token.balanceOf(singletonRouter.target)).to.equal(routerTokenBalanceBeforeThree - amount * 100n);
            expect(await token.balanceOf(admin.address)).to.equal(adminTokenBalanceBeforeThree + amount * 100n);
        });
    });
});