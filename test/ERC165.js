const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { deployTokenByFactory, deployConnectorByFactory, deployNativeConnectorByFactory } = require("./utils/ERC20UtilFunctions");
const { ERC20Fixture, testDstChainId, withDecimals } = require("./utils/ERC20Fixture");

describe("ERC165", function () {
    it("Base test", async function () {
        const { dRouter, masterRouter, justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(ERC20Fixture);

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
            [[configPeer, configMinGasLimit, configDecimals, false]],
            salt
        ]);

        const deployedNativeConnector = await deployNativeConnectorByFactory(
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

        const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
        const deployedPureToken = await ethers.getContractAt("ATSTokenPure", precompute.deployment);
        expect(precompute.hasCode).to.equal(true);

        expect(await deployedPureToken.supportsInterface("0x950a21e1")).to.equal(true);
        expect(await deployedPureToken.supportsInterface("0x36372b07")).to.equal(true);
        expect(await deployedToken.supportsInterface("0x7965db0b")).to.equal(true);
        expect(await deployedToken.supportsInterface("0x36372b07")).to.equal(true);
        expect(await deployedToken.supportsInterface("0xfb0df930")).to.equal(true);
        expect(await deployedToken.supportsInterface("0x950a21e1")).to.equal(true);
        expect(await deployedConnector.supportsInterface("0x950a21e1")).to.equal(true);
        expect(await deployedConnector.supportsInterface("0x03ca2c97")).to.equal(true);
        expect(await deployedNativeConnector.supportsInterface("0x950a21e1")).to.equal(true);
        expect(await deployedNativeConnector.supportsInterface("0x03ca2c97")).to.equal(true);
        expect(await router.supportsInterface("0xeb315839")).to.equal(true);
        expect(await factory.supportsInterface("0x63e0baa3")).to.equal(true);
        expect(await masterRouter.supportsInterface("0x36b30700")).to.equal(true);
        expect(await registry.supportsInterface("0x483e45f1")).to.equal(true);
        expect(await dRouter.supportsInterface("0xbf2e2ed2")).to.equal(true);
        expect(await deployedToken.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await deployedConnector.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await router.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await factory.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await masterRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await registry.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await dRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
    });
});