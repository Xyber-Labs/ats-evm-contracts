const { coreFixture, testCurChainId, testDstChainId, withDecimals } = require("./CoreFixture");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const SingletonFactoryProxyModule = require("../../ignition/modules/SingletonFactoryProxyModule");
const SingletonRouterProxyModule = require("../../ignition/modules/SingletonRouterProxyModule");

const { encodeParamsToDeploy, AbiCoder } = require("./SimpleTokenUtilFunctions");

async function SimpleTokenFixture() {
    const {
        admin, user, executor, zeroHash, zeroAddress, adminRole, routerRole, endpoint, masterRouter, protocolId, functionSelector, providerRole,
        baseFeePerGasInWei, gasEstimator, prices, groupId, initCalldata,
    } = await loadFixture(coreFixture);

    const singletonFactoryFutureAddress = ethers.getCreateAddress({
        from: admin.address,
        nonce: await ethers.provider.getTransactionCount(admin.address) + 3
    });

    const { singletonRouterProxy } = await ignition.deploy(SingletonRouterProxyModule, {
        parameters: {
            SingletonRouterProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                gasEstimatorAddress: gasEstimator.target,
                singletonFactoryAddress: singletonFactoryFutureAddress,
                paymentTransferGasLimit: 3000
            },
        },
    });

    const { singletonFactoryProxy } = await ignition.deploy(SingletonFactoryProxyModule, {
        parameters: {
            SingletonFactoryProxyModule: {
                initializeCalldata: initCalldata,
                singletonRouterAddress: singletonRouterProxy.target
            },
        },
    });

    expect(singletonFactoryProxy.target).to.equal(singletonFactoryFutureAddress);

    const Mock = await ethers.getContractFactory("Mock", admin);
    const mock = await Mock.deploy(singletonRouterProxy.target);
    await mock.waitForDeployment();

    const singletonFactory = await ethers.getContractAt("SingletonFactory", singletonFactoryProxy);
    const singletonRouter = await ethers.getContractAt("SingletonRouter", singletonRouterProxy);

    const pauserRole = await singletonRouter.PAUSER_ROLE();
    const managerRole = await singletonRouter.MANAGER_ROLE();

    const dstRedeemGas = 130000n;
    const dstDeployGas = 700000n;
    const defaultDecimals = 18;
    const solanaChainId = 11100000000000000501n;

    await masterRouter.connect(admin).grantRole(routerRole, singletonRouter.target);

    await singletonRouter.connect(admin).grantRole(managerRole, admin);
    await singletonRouter.connect(admin).setDstSingletonRouter([testDstChainId], [singletonRouterProxy.target]);
    await singletonRouter.connect(admin).setDstRedeemGas([testDstChainId], [dstRedeemGas]);
    await singletonRouter.connect(admin).setDstDeployGas([testDstChainId], [dstDeployGas]);

    await singletonRouter.connect(admin).setDstSingletonRouter([solanaChainId], [singletonRouterProxy.target]);
    await singletonRouter.connect(admin).setDstRedeemGas([solanaChainId], [dstRedeemGas]);
    await singletonRouter.connect(admin).setDstDeployGas([solanaChainId], [dstDeployGas]);

    const tokenId = "0x87e2530f7c666e8c9e1ffcd871aa028f89e9b0e46ec70b0926c1032ab6ed0166";
    const name = "PrecompiledToken";
    const symbol = "PT";
    const totalSupply = withDecimals("100000");

    const params = encodeParamsToDeploy(
        singletonRouter,
        tokenId,
        name,
        symbol,
        totalSupply,
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

    await endpoint.connect(admin).execute(
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

    const token = await ethers.getContractAt("ERC20Token", await singletonRouter.token(tokenId));

    expect(await token.totalSupply()).to.equal(totalSupply);
    expect(await token.name()).to.equal(name);
    expect(await token.symbol()).to.equal(symbol);
    expect(await token.decimals()).to.equal(defaultDecimals);
    expect(await token.balanceOf(singletonRouter.target)).to.equal(totalSupply);

    return {
        admin, user, executor, zeroHash, zeroAddress, adminRole, routerRole, endpoint, masterRouter, protocolId, functionSelector, pauserRole,
        managerRole, providerRole, baseFeePerGasInWei, gasEstimator, prices, groupId, singletonFactory, singletonRouter, dstRedeemGas, 
        dstDeployGas, token, tokenId, name, symbol, totalSupply, mock, defaultDecimals, solanaChainId
    };
};

module.exports = { SimpleTokenFixture, testCurChainId, testDstChainId, withDecimals };