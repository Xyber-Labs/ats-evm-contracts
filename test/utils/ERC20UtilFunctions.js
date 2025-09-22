const { expect } = require("chai");

const { routerBridgeMessageType, dRouterDeployMessageType, routerUpdateMessageType } = require("./GlobalConstants");
const { testCurChainId, testDstChainId, withDecimals } = require("./ERC20Fixture");

const AbiCoder = new ethers.AbiCoder();

async function convert(amount, decimalsIn, decimalsOut) {
    if (decimalsOut > decimalsIn) {
        return amount * (10n ** (decimalsOut - decimalsIn));
    } else {
        if (decimalsOut < decimalsIn) {
            return amount / (10n ** (decimalsIn - decimalsOut));
        }
    }

    return amount;
};

async function convertToBytes(instance) {
    let bytesAddress;

    const code = await ethers.provider.getCode(instance);

    if (instance == ethers.ZeroAddress || instance == ethers.ZeroHash) {
        bytesAddress = "0x";
    } else {
        if (code == "0x") {
            bytesAddress = instance.address;
        } else {
            bytesAddress = instance.target;
        }
    }

    return bytesAddress;
}

async function encodeParamsToRedeem(
    msgSender,
    dstToken,
    dstTo,
    amount,
    srcChainId,
    srcPeer,
    srcDecimals,
    gasLimit,
    customPayload
) {
    const dstTokenAddress = await convertToBytes(dstToken);
    const dstToAddress = await convertToBytes(dstTo);
    const senderAddress = await convertToBytes(msgSender);

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
        senderAddress,
        dstToAddress,
        amount,
        srcChainId,
        srcPeer,
        srcDecimals,
        gasLimit,
        customPayload
    ]);

    const params = AbiCoder.encode([
        "bytes",
        "bytes1",
        "bytes"
    ], [
        dstTokenAddress,
        routerBridgeMessageType,
        localParams
    ]);

    return params;
};

async function encodeParamsToUpdateConfig(msgSender, dstToken, srcChainId, srcPeer, updateConfig) {
    const senderAddress = await convertToBytes(msgSender);
    const dstTokenAddress = await convertToBytes(dstToken);

    const localParams = AbiCoder.encode([
        "bytes",
        "uint256",
        "bytes",
        "tuple(uint256[], tuple(bytes, uint64, uint8, bool)[])"
    ], [
        senderAddress,
        srcChainId,
        srcPeer,
        updateConfig
    ]);

    const params = AbiCoder.encode([
        "bytes",
        "bytes1",
        "bytes"
    ], [
        dstTokenAddress,
        routerUpdateMessageType,
        localParams
    ]);

    return params;
};

async function encodeParamsToDeployToken(
    dRouter,
    dstfactory,
    dstPayer,
    owner,
    name,
    symbol,
    decimals,
    initialSupply,
    mintedAmountToOwner,
    mintable,
    globalBurnable,
    onlyRoleBurnable,
    feeModule,
    router,
    allowedChainIds,
    chainConfigs,
    salt
) {
    const ownerAddress = await convertToBytes(owner);
    const routerAddress = await convertToBytes(router);

    const tokenDeployParams = AbiCoder.encode([
        "tuple(bytes, string, string, uint8, uint256, uint256, bool, bool, bool, bool, bool, bytes, uint256[], tuple(bytes, uint64, uint8, bool)[], bytes32)"
    ], [[
        ownerAddress,
        name,
        symbol,
        decimals,
        initialSupply,
        mintedAmountToOwner,
        false,
        mintable,
        globalBurnable,
        onlyRoleBurnable,
        feeModule,
        routerAddress,
        allowedChainIds,
        chainConfigs,
        salt
    ]]);

    const tokenDeployParamsOnchain = await dRouter.getDeployTokenParams([
        ownerAddress,
        name,
        symbol,
        decimals,
        initialSupply,
        mintedAmountToOwner,
        false,
        mintable,
        globalBurnable,
        onlyRoleBurnable,
        feeModule,
        routerAddress,
        allowedChainIds,
        chainConfigs,
        salt
    ]);

    expect(tokenDeployParams).to.equal(tokenDeployParamsOnchain);

    const [localParams, params] = await encodeParamsToDeploy(dstfactory, false, dstPayer, tokenDeployParams);

    return [tokenDeployParams, localParams, params];
};

async function encodeParamsToDeployConnector(
    dRouter,
    dstfactory,
    dstPayer,
    owner,
    underlyingToken,
    feeModule,
    router,
    allowedChainIds,
    chainConfigs,
    salt
) {
    const underlyingTokenAddress = await convertToBytes(underlyingToken);
    const ownerAddress = await convertToBytes(owner);
    const routerAddress = await convertToBytes(router);

    const connectorDeployParams = AbiCoder.encode([
        "tuple(bytes, bytes, bool, bytes, uint256[], tuple(bytes, uint64, uint8, bool)[], bytes32)"
    ], [[
        ownerAddress,
        underlyingTokenAddress,
        feeModule,
        routerAddress,
        allowedChainIds,
        chainConfigs,
        salt
    ]]);

    const connectorDeployParamsOnchain = await dRouter.getDeployConnectorParams([
        ownerAddress,
        underlyingTokenAddress,
        feeModule,
        routerAddress,
        allowedChainIds,
        chainConfigs,
        salt
    ]);

    expect(connectorDeployParams).to.equal(connectorDeployParamsOnchain);

    const [localParams, params] = await encodeParamsToDeploy(dstfactory, true, dstPayer, connectorDeployParams);

    return [connectorDeployParams, localParams, params];
};

async function encodeParamsToDeploy(dstfactory, isConnector, dstPayer, deployParams) {
    const dstFactoryAddress = await convertToBytes(dstfactory);
    const dstPayerAddress = await convertToBytes(dstPayer);

    const localParams = AbiCoder.encode([
        "bool",
        "bytes",
        "bytes"
    ], [
        isConnector,
        dstPayerAddress,
        deployParams
    ]);

    const params = AbiCoder.encode([
        "bytes",
        "bytes1",
        "bytes"
    ], [
        dstFactoryAddress,
        dRouterDeployMessageType,
        localParams
    ]);

    return [localParams, params];
};

async function validateBridgeFee(router, placeholder, chainId, gasLimit, payloadLength) {
    const fee = gasLimit == 0 ? 1n * chainId : chainId * gasLimit;

    expect(await router.getBridgeFee(chainId, gasLimit, payloadLength, "0x")).to.equal(fee);

    const baseFee = fee;
    const calcFee = fee;

    return fee, baseFee, calcFee;
};

async function validateDeployFee(tokenChainIds, connectorChainIds, dRouter, placeholder) {
    const deployTokenGas = await dRouter.dstTokenDeployGas(testDstChainId);
    const deployConnectorGas = await dRouter.dstConnectorDeployGas(testDstChainId);

    let baseNativePaymentAmount = 0n;
    let extraNativePaymentAmount = 0n;

    for (let i = 0n; tokenChainIds.length > i; i++) {
        if (tokenChainIds[i] != testCurChainId) baseNativePaymentAmount += deployTokenGas * tokenChainIds[i];
    }

    for (let i = 0n; connectorChainIds.length > i; i++) {
        if (connectorChainIds[i] != testCurChainId) baseNativePaymentAmount += deployConnectorGas * connectorChainIds[i];
    }

    const contractPaymentAmount = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

    expect(baseNativePaymentAmount * 2n + 1n).to.above(extraNativePaymentAmount);
    expect(contractPaymentAmount[1] + 1n).to.above(baseNativePaymentAmount);

    if (tokenChainIds.length == 0 && connectorChainIds.length == 0) {
        expect(baseNativePaymentAmount).to.equal(0n);
        expect(extraNativePaymentAmount).to.equal(0n);
    } else {
        if (baseNativePaymentAmount > 0) {
            expect(contractPaymentAmount[1]).to.above(0n);
        }
    }

    return contractPaymentAmount[1];
};

async function deployTokenByFactory(
    deployer,
    owner,
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
) {
    const deployerAddress = await convertToBytes(deployer);
    const ownerAddress = await convertToBytes(owner);

    const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];
    const deploymentsBefore = await registry.totalDeployments();
    let blueprint = 0;

    if (mintable) blueprint = 1;
    if (feeModule) blueprint = 2;
    if (mintable && feeModule) blueprint = 3;

    let precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, false);

    expect(precompute.hasCode).to.equal(false);

    const tx = await factory.connect(deployer).deployToken([
        ownerAddress,
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
    ]);

    await tx.wait();

    expect(await registry.totalDeployments()).to.equal(deploymentsBefore + 1n);

    const deploymentsByIndex = await registry.deploymentsByIndex([deploymentsBefore]);

    expect(precompute.deployment).to.equal(deploymentsByIndex[0]);

    precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, false);
    expect(precompute.deployment).to.equal(deploymentsByIndex[0]);
    expect(precompute.hasCode).to.equal(true);

    let deployedToken;

    if (blueprint == 0) deployedToken = await ethers.getContractAt("ATSToken", deploymentsByIndex[0]);
    if (blueprint == 1) {
        deployedToken = await ethers.getContractAt("ATSTokenMintable", deploymentsByIndex[0]);

        expect(await deployedToken.MINTER_ROLE()).to.equal("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6");
    }
    if (blueprint == 2) {
        deployedToken = await ethers.getContractAt("ATSTokenWithFee", deploymentsByIndex[0]);

        expect(await deployedToken.feeCollector()).to.equal(zeroAddress);
    }
    if (blueprint == 3) {
        deployedToken = await ethers.getContractAt("ATSTokenMintableWithFee", deploymentsByIndex[0]);

        expect(await deployedToken.MINTER_ROLE()).to.equal("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6");
        expect(await deployedToken.feeCollector()).to.equal(zeroAddress);
    }

    const data = await registry.deploymentData(deployedToken.target);
    const allowedChainId = allowedChainIds[0];
    const chainConfigData = await deployedToken.getChainConfigs([allowedChainId]);

    let filter = registry.filters.ChainConfigUpdated;
    let events = await registry.queryFilter(filter, -1);
    let args = events[0].args;

    expect(await args[0]).to.equal(deployedToken.target);

    filter = registry.filters.RouterUpdated;
    events = await registry.queryFilter(filter, -1);
    args = events[0].args;

    expect(await args[0]).to.equal(deployedToken.target);
    expect(await args[1]).to.equal(router.target);

    expect(deployedToken.target).to.equal(data.underlyingToken);
    expect(data.deployer).to.equal(deployer.address.toLowerCase());
    expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
    expect(data.underlyingToken).to.equal(deployedToken.target);
    expect(chainConfigData[0].peerAddress).to.equal(configPeer);
    expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
    expect(chainConfigData[0].decimals).to.equal(configDecimals);
    expect(chainConfigData[0].paused).to.equal(false);
    expect(await deployedToken.protocolVersion()).to.equal(await factory.protocolVersion());
    expect(await deployedToken.underlyingToken()).to.equal(deployedToken.target);
    expect(await deployedToken.totalSupply()).to.equal(initialSupply);
    expect(await deployedToken.balanceOf(owner)).to.equal(initialSupply);
    expect(await deployedToken.name()).to.equal(name);
    expect(await deployedToken.symbol()).to.equal(symbol);
    expect(await deployedToken.decimals()).to.equal(decimals);
    expect(await deployedToken.router()).to.equal(router.target);

    if (onlyRoleBurnable) {
        expect(await deployedToken.globalBurnable()).to.equal(true);
    } else {
        expect(await deployedToken.globalBurnable()).to.equal(globalBurnable);
    }

    expect(await deployedToken.onlyRoleBurnable()).to.equal(onlyRoleBurnable);
    expect(await deployedToken.hasRole(adminRole, owner)).to.equal(true);
    if (deployer != owner) expect(await deployedToken.hasRole(adminRole, deployer)).to.equal(false);
    expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
    expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);

    const allowedChainIdTwo = [997];
    const configMinGasLimitTwo = 100000n;
    const configPeerTwo = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsTwo = 18n;

    await deployedToken.connect(owner).setChainConfig(
        allowedChainIdTwo,
        [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, true]]
    );

    const chainConfigDataTwo = await deployedToken.getChainConfigs([allowedChainIdTwo[0]]);

    expect(chainConfigDataTwo[0].peerAddress).to.equal(configPeerTwo);
    expect(chainConfigDataTwo[0].minGasLimit).to.equal(configMinGasLimitTwo);
    expect(chainConfigDataTwo[0].decimals).to.equal(configDecimalsTwo);
    expect(chainConfigDataTwo[0].paused).to.equal(true);

    await deployedToken.connect(owner).setChainConfig(
        allowedChainIdTwo,
        [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, false]]
    );

    const allowedChainIdThree = [997, 999];
    const configMinGasLimitThreeOne = 100000n;
    const configMinGasLimitThreeTwo = 150000n;
    const configPeerThreeOne = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
    const configPeerThreeTwo = "0xf4050b2c873c7c8d2859c07d9f9d71fff19873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsThreeOne = 16n;
    const configDecimalsThreeTwo = 20n;

    await deployedToken.connect(owner).setChainConfig(
        allowedChainIdThree,
        [
            [configPeerThreeOne, configMinGasLimitThreeOne, configDecimalsThreeOne, false],
            [configPeerThreeTwo, configMinGasLimitThreeTwo, configDecimalsThreeTwo, true]
        ]
    );

    const chainConfigDataThreeOne = await deployedToken.getChainConfigs([allowedChainIdThree[0]]);
    const chainConfigDataThreeTwo = await deployedToken.getChainConfigs([allowedChainIdThree[1]]);

    expect(chainConfigDataThreeOne[0].peerAddress).to.equal(configPeerThreeOne);
    expect(chainConfigDataThreeOne[0].minGasLimit).to.equal(configMinGasLimitThreeOne);
    expect(chainConfigDataThreeOne[0].decimals).to.equal(configDecimalsThreeOne);
    expect(chainConfigDataThreeOne[0].paused).to.equal(false);
    expect(chainConfigDataThreeTwo[0].peerAddress).to.equal(configPeerThreeTwo);
    expect(chainConfigDataThreeTwo[0].minGasLimit).to.equal(configMinGasLimitThreeTwo);
    expect(chainConfigDataThreeTwo[0].decimals).to.equal(configDecimalsThreeTwo);
    expect(chainConfigDataThreeTwo[0].paused).to.equal(true);

    await expect(deployedToken.connect(owner).initializeToken([
        ownerAddress,
        "string name",
        "string symbol",
        1,
        1,
        1,
        false,
        false,
        false,
        false,
        false,
        registry.target,
        [],
        [],
        zeroHash
    ])).to.be.revertedWithCustomError(deployedToken, "ATSBase__E0");

    if (initialSupply > 2n) {
        const ownerBalanceBefore = await deployedToken.balanceOf(owner);
        const targetBalanceBefore = await deployedToken.balanceOf(registry.target);
        const amountToTransfer = 1n;

        await deployedToken.connect(owner).transfer(registry.target, amountToTransfer);

        expect(ownerBalanceBefore - amountToTransfer).to.equal(await deployedToken.balanceOf(owner));
        expect(targetBalanceBefore + amountToTransfer).to.equal(await deployedToken.balanceOf(registry.target));

        const ownerBalanceBeforeTwo = await deployedToken.balanceOf(owner);
        const targetBalanceBeforeTwo = await deployedToken.balanceOf(registry.target);

        await deployedToken.connect(owner).approve(deployer, amountToTransfer);
        expect(await deployedToken.allowance(owner, deployer)).to.equal(amountToTransfer);

        await deployedToken.connect(deployer).transferFrom(owner, registry.target, amountToTransfer);

        expect(await deployedToken.allowance(owner, deployer)).to.equal(0);
        expect(ownerBalanceBeforeTwo - amountToTransfer).to.equal(await deployedToken.balanceOf(owner));
        expect(targetBalanceBeforeTwo + amountToTransfer).to.equal(await deployedToken.balanceOf(registry.target));

        await deployedToken.connect(owner).approve(deployedToken.target, amountToTransfer);

        await expect(deployedToken.connect(owner).bridge(
            ownerAddress,
            ownerAddress,
            amountToTransfer,
            allowedChainId,
            configMinGasLimit - 1n,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E6");

        await expect(deployedToken.connect(owner).bridge(
            ownerAddress,
            ownerAddress,
            amountToTransfer,
            allowedChainId,
            configMinGasLimit - 1n,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E6");
    }

    const estimatedGasLimit = await deployedToken.estimateBridgeFee(
        allowedChainId,
        1n,
        0,
        "0x"
    );

    const minGasLimit = estimatedGasLimit[1];

    await expect(deployedToken.connect(owner).initializeToken([
        ownerAddress,
        "",
        "",
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
        zeroHash
    ])).to.be.revertedWithCustomError(deployedToken, "ATSBase__E0");

    if (deployer != owner) {
        await expect(deployedToken.connect(deployer).setRouter(
            router.target
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

        await expect(deployedToken.connect(deployer).setChainConfig(
            allowedChainIds, chainConfigs
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

        await expect(deployedToken.connect(deployer).setChainConfigToDestination(
            [1, 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");
    }

    await expect(deployedToken.connect(owner).redeem(
        owner,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E1");

    await expect(deployedToken.connect(deployer).redeem(
        deployer,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E1");

    await expect(deployedToken.connect(owner).storeFailedExecution(
        owner,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals],
        "0x"
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E1");

    await expect(deployedToken.connect(deployer).setChainConfigByRouter(
        [],
        [],
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E1");

    await expect(deployedToken.connect(owner).setChainConfig(
        [testDstChainId, 12], chainConfigs
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E4");

    await expect(deployedToken.connect(owner).setChainConfigToDestination(
        [1, 2, 3],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E4");

    await expect(deployedToken.connect(owner).setChainConfigToDestination(
        [1, 2],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(deployedToken, "ATSBase__E4");

    const allowedChainIdFour = [31338];
    const configMinGasLimitFour = 0n;
    const configPeerFour = zeroHash;
    const configDecimalsFour = 18n;

    await deployedToken.connect(owner).setChainConfig(
        allowedChainIdFour,
        [[configPeerFour, configMinGasLimitFour, configDecimalsFour, false]]
    );

    const tokenAmountToBridge = withDecimals("1");
    const ownerBalance = await deployedToken.balanceOf(owner);

    if (ownerBalance >= tokenAmountToBridge) {

        await expect(deployedToken.connect(owner).bridge(
            ownerAddress,
            zeroAddress,
            tokenAmountToBridge,
            allowedChainIdTwo[0],
            minGasLimit + 500000n,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "ATSRouter__E4");

        await expect(deployedToken.connect(owner).bridge(
            ownerAddress,
            "0x",
            tokenAmountToBridge,
            allowedChainIdTwo[0],
            minGasLimit + 500000n,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "ATSRouter__E4");

        await expect(deployedToken.connect(owner).bridge(
            ownerAddress,
            ownerAddress,
            tokenAmountToBridge,
            31338,
            minGasLimit + 500000n,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

        const allowedChainIdFive = [testCurChainId];
        const configMinGasLimitFive = 100000n;
        const configPeerFive = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
        const configDecimalsFive = 18n;

        const zeroChainConfig = [["0x", configMinGasLimit, configDecimals, false]];

        await deployedToken.connect(owner).setChainConfig(
            [testDstChainId],
            [["0x", configMinGasLimitFive, configDecimalsFive, false]]
        );

        await expect(deployedToken.connect(owner).setChainConfigToDestination(
            [testDstChainId, testDstChainId],
            [[allowedChainIds, zeroChainConfig], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

        await expect(deployedToken.connect(owner).setChainConfigToDestination(
            [testDstChainId, testDstChainId],
            [[allowedChainIds, chainConfigs], [allowedChainIds, zeroChainConfig]]
        )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

        await deployedToken.connect(owner).setChainConfig(
            allowedChainIdFive,
            [[configPeerFive, configMinGasLimitFive, configDecimalsFive, false]]
        );

        await expect(deployedToken.connect(owner).bridge(
            owner.address,
            owner.address,
            tokenAmountToBridge,
            allowedChainIdFive[0],
            minGasLimit + 500000n,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "ATSRouter__E1");

        await expect(deployedToken.connect(owner).setChainConfigToDestination(
            [allowedChainIdFive[0], 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(router, "ATSRouter__E1");

        await deployedToken.connect(owner).setChainConfig(
            [testDstChainId],
            chainConfigs
        );

        const ids = [
            allowedChainId,
            allowedChainIdThree[0],
            allowedChainIdTwo[0],
            allowedChainIdThree[1],
            allowedChainIdFour[0],
            allowedChainIdFive[0]
        ];

        const configData = await deployedToken.getChainConfigs(ids);

        expect(configData[0].peerAddress).to.equal(configPeer);
        expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
        expect(configData[0].decimals).to.equal(configDecimals);
        expect(configData[0].paused).to.equal(false);
        expect(configData[1].peerAddress).to.equal(configPeerThreeOne);
        expect(configData[1].minGasLimit).to.equal(configMinGasLimitThreeOne);
        expect(configData[1].decimals).to.equal(configDecimalsThreeOne);
        expect(configData[1].paused).to.equal(false);
        expect(configData[2].peerAddress).to.equal(configPeerThreeOne);
        expect(configData[2].minGasLimit).to.equal(configMinGasLimitThreeOne);
        expect(configData[2].decimals).to.equal(configDecimalsThreeOne);
        expect(configData[2].paused).to.equal(false);
        expect(configData[3].peerAddress).to.equal(configPeerThreeTwo);
        expect(configData[3].minGasLimit).to.equal(configMinGasLimitThreeTwo);
        expect(configData[3].decimals).to.equal(configDecimalsThreeTwo);
        expect(configData[3].paused).to.equal(true);
        expect(configData[4].peerAddress).to.equal(configPeerFour);
        expect(configData[4].minGasLimit).to.equal(configMinGasLimitFour);
        expect(configData[4].decimals).to.equal(configDecimalsFour);
        expect(configData[4].paused).to.equal(false);
        expect(configData[5].peerAddress).to.equal(configPeerFive);
        expect(configData[5].minGasLimit).to.equal(configMinGasLimitFive);
        expect(configData[5].decimals).to.equal(configDecimalsFive);
        expect(configData[5].paused).to.equal(false);
    }

    return { deployedToken };
};

async function deployConnectorByFactory(
    deployer,
    owner,
    underlyingToken,
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
) {
    const deployerAddress = await convertToBytes(deployer);
    const ownerAddress = await convertToBytes(owner);

    const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];
    const deploymentsBefore = await registry.totalDeployments();

    let blueprint = 0;

    if (feeModule) blueprint = 5;

    let precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, true);

    expect(precompute.hasCode).to.equal(false);

    await factory.connect(deployer).deployConnector([
        ownerAddress,
        underlyingToken.target,
        feeModule,
        router.target,
        allowedChainIds,
        chainConfigs,
        salt
    ]);

    expect(await registry.totalDeployments()).to.equal(deploymentsBefore + 1n);

    const deploymentsByIndex = await registry.deploymentsByIndex([deploymentsBefore]);

    expect(precompute.deployment).to.equal(deploymentsByIndex[0]);

    precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, true);
    expect(precompute.deployment).to.equal(deploymentsByIndex[0]);
    expect(precompute.hasCode).to.equal(true);

    let deployedConnector;

    if (blueprint == 0) deployedConnector = await ethers.getContractAt("ATSConnector", deploymentsByIndex[0]);
    if (blueprint == 5) {
        deployedConnector = await ethers.getContractAt("ATSConnectorWithFee", deploymentsByIndex[0]);

        expect(await deployedConnector.feeCollector()).to.equal(zeroAddress);
    }

    const data = await registry.deploymentData(deployedConnector.target);
    const allowedChainId = allowedChainIds[0];
    const chainConfigData = await deployedConnector.getChainConfigs([allowedChainId]);

    expect(data.deployer).to.equal(deployer.address.toLowerCase());
    expect(data.underlyingToken).to.equal(underlyingToken.target);
    expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
    expect(data.underlyingToken).to.equal(underlyingToken);
    expect(chainConfigData[0].peerAddress).to.equal(configPeer);
    expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
    expect(chainConfigData[0].decimals).to.equal(configDecimals);
    expect(chainConfigData[0].paused).to.equal(false);
    expect(await deployedConnector.protocolVersion()).to.equal(await factory.protocolVersion());
    expect(await deployedConnector.underlyingDecimals()).to.equal(await underlyingToken.decimals());
    expect(await deployedConnector.underlyingToken()).to.equal(underlyingToken.target);
    expect(await deployedConnector.underlyingBalance()).to.equal(0);
    expect(await deployedConnector.underlyingName()).to.equal(await underlyingToken.name());
    expect(await deployedConnector.underlyingSymbol()).to.equal(await underlyingToken.symbol());
    expect(await deployedConnector.router()).to.equal(router.target);

    expect(await deployedConnector.hasRole(adminRole, owner)).to.equal(true);
    if (deployer != owner) expect(await deployedConnector.hasRole(adminRole, deployer)).to.equal(false);
    expect(await registry.validateUnderlyingRegistered(underlyingToken.target)).to.equal(true);
    expect(await registry.validateDeploymentRegistered(deployedConnector.target)).to.equal(true);

    const amountToBridge = withDecimals("1");

    await underlyingToken.connect(owner).approve(deployedConnector.target, amountToBridge);

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        owner.address,
        amountToBridge,
        allowedChainId,
        configMinGasLimit - 1n,
        "0x",
        "0x"
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E6");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        ownerAddress,
        amountToBridge,
        allowedChainId,
        configMinGasLimit - 1n,
        "0x",
        "0x"
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E6");

    const allowedChainIdTwo = [997];
    const configMinGasLimitTwo = 100000n;
    const configPeerTwo = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsTwo = 18n;

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdTwo,
        [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, false]]
    );

    const chainConfigDataTwo = await deployedConnector.getChainConfigs([allowedChainIdTwo[0]]);

    expect(chainConfigDataTwo[0].peerAddress).to.equal(configPeerTwo);
    expect(chainConfigDataTwo[0].minGasLimit).to.equal(configMinGasLimitTwo);
    expect(chainConfigDataTwo[0].decimals).to.equal(configDecimalsTwo);
    expect(chainConfigDataTwo[0].paused).to.equal(false);

    const allowedChainIdThree = [997, 999];
    const configMinGasLimitThreeOne = 100000n;
    const configMinGasLimitThreeTwo = 150000n;
    const configPeerThreeOne = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
    const configPeerThreeTwo = "0xf4050b2c873c7c8d2859c07d9f9d71fff19873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsThreeOne = 16n;
    const configDecimalsThreeTwo = 20n;

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdThree,
        [
            [configPeerThreeOne, configMinGasLimitThreeOne, configDecimalsThreeOne, true],
            [configPeerThreeTwo, configMinGasLimitThreeTwo, configDecimalsThreeTwo, false]
        ]
    );

    const chainConfigDataThreeOne = await deployedConnector.getChainConfigs([allowedChainIdThree[0]]);
    const chainConfigDataThreeTwo = await deployedConnector.getChainConfigs([allowedChainIdThree[1]]);

    expect(chainConfigDataThreeOne[0].peerAddress).to.equal(configPeerThreeOne);
    expect(chainConfigDataThreeOne[0].minGasLimit).to.equal(configMinGasLimitThreeOne);
    expect(chainConfigDataThreeOne[0].decimals).to.equal(configDecimalsThreeOne);
    expect(chainConfigDataThreeOne[0].paused).to.equal(true);
    expect(chainConfigDataThreeTwo[0].peerAddress).to.equal(configPeerThreeTwo);
    expect(chainConfigDataThreeTwo[0].minGasLimit).to.equal(configMinGasLimitThreeTwo);
    expect(chainConfigDataThreeTwo[0].decimals).to.equal(configDecimalsThreeTwo);
    expect(chainConfigDataThreeTwo[0].paused).to.equal(false);

    await expect(deployedConnector.connect(owner).initializeConnector(
        ownerAddress,
        underlyingToken.target,
        router.target,
        allowedChainIds,
        chainConfigs
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E0");

    if (deployer != owner) {
        await expect(deployedConnector.connect(deployer).setRouter(
            router.target
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

        await expect(deployedConnector.connect(deployer).setChainConfig(
            allowedChainIds, chainConfigs
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

        await expect(deployedConnector.connect(deployer).setChainConfigToDestination(
            [1, 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");
    }

    await expect(deployedConnector.connect(owner).redeem(
        owner,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(deployer).redeem(
        deployer,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(owner).storeFailedExecution(
        owner,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals],
        "0x"
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(deployer).setChainConfigByRouter(
        [],
        [],
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(owner).setChainConfig(
        [testDstChainId, 12],
        chainConfigs
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E4");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [1, 2, 3],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E4");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [1, 2],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E4");

    const allowedChainIdFour = [31338];
    const configMinGasLimitFour = 0n;
    const configPeerFour = zeroHash;
    const configDecimalsFour = 18n;

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdFour,
        [[configPeerFour, configMinGasLimitFour, configDecimalsFour, false]]
    );

    const tokenAmountToBridge = withDecimals("100");

    await underlyingToken.connect(owner).approve(deployedConnector.target, tokenAmountToBridge);

    const estimatedGasLimit = await deployedConnector.estimateBridgeFee(
        allowedChainId,
        1n,
        0,
        "0x"
    );
    const minGasLimit = estimatedGasLimit[1];

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        zeroAddress,
        tokenAmountToBridge,
        allowedChainId,
        minGasLimit,
        "0x",
        "0x",
        { value: configMinGasLimit }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E4");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        "0x",
        tokenAmountToBridge,
        allowedChainId,
        minGasLimit,
        "0x",
        "0x",
        { value: configMinGasLimit }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E4");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        owner.address,
        tokenAmountToBridge,
        allowedChainIdFour[0],
        minGasLimit + 500000n,
        "0x",
        "0x",
        { value: configMinGasLimit }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

    const allowedChainIdFive = [testCurChainId];
    const configMinGasLimitFive = 100000n;
    const configPeerFive = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsFive = 16n;

    const zeroChainConfig = [["0x", configMinGasLimit, configDecimals, false]];

    await deployedConnector.connect(owner).setChainConfig(
        [testDstChainId],
        [["0x", configMinGasLimitFive, configDecimalsFive, false]]
    );

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [testDstChainId, testDstChainId],
        [[allowedChainIds, zeroChainConfig], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [testDstChainId, testDstChainId],
        [[allowedChainIds, chainConfigs], [allowedChainIds, zeroChainConfig]]
    )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdFive,
        [[configPeerFive, configMinGasLimitFive, configDecimalsFive, false]]
    );

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        owner.address,
        tokenAmountToBridge,
        allowedChainIdFive[0],
        minGasLimit + 500000n,
        "0x",
        "0x",
        { value: configMinGasLimit }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E1");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [allowedChainIdFive[0], 2],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(router, "ATSRouter__E1");

    await deployedConnector.connect(owner).setChainConfig(
        [testDstChainId],
        chainConfigs
    );

    return { deployedConnector };
};

async function deployNativeConnectorByFactory(
    deployer,
    owner,
    underlyingToken,
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
) {
    const deployerAddress = await convertToBytes(deployer);
    const ownerAddress = await convertToBytes(owner);

    const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];
    const deploymentsBefore = await registry.totalDeployments();

    const blueprint = 6;
    underlyingToken = await factory.NATIVE_ADDRESS();

    let precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, true);

    expect(precompute.hasCode).to.equal(false);

    await factory.connect(deployer).deployConnector([
        ownerAddress,
        underlyingToken,
        feeModule,
        router.target,
        allowedChainIds,
        chainConfigs,
        salt
    ]);

    expect(await registry.totalDeployments()).to.equal(deploymentsBefore + 1n);

    const deploymentsByIndex = await registry.deploymentsByIndex([deploymentsBefore]);

    expect(precompute.deployment).to.equal(deploymentsByIndex[0]);

    precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, true);
    expect(precompute.deployment).to.equal(deploymentsByIndex[0]);
    expect(precompute.hasCode).to.equal(true);

    const deployedConnector = await ethers.getContractAt("ATSConnectorNative", deploymentsByIndex[0]);

    const data = await registry.deploymentData(deployedConnector.target);
    const allowedChainId = allowedChainIds[0];
    const chainConfigData = await deployedConnector.getChainConfigs([allowedChainId]);

    expect(data.deployer).to.equal(deployer.address.toLowerCase());
    expect(data.underlyingToken).to.equal(await factory.NATIVE_ADDRESS());
    expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
    expect(data.underlyingToken).to.equal(underlyingToken);
    expect(chainConfigData[0].peerAddress).to.equal(configPeer);
    expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
    expect(chainConfigData[0].decimals).to.equal(configDecimals);
    expect(chainConfigData[0].paused).to.equal(false);
    expect(await deployedConnector.protocolVersion()).to.equal(await factory.protocolVersion());
    expect(await deployedConnector.underlyingDecimals()).to.equal(18n);
    expect(await deployedConnector.underlyingToken()).to.equal(await factory.NATIVE_ADDRESS());
    expect(await deployedConnector.underlyingBalance()).to.equal(0);
    expect(await deployedConnector.underlyingName()).to.equal("Ether");
    expect(await deployedConnector.underlyingSymbol()).to.equal("ETH");
    expect(await deployedConnector.router()).to.equal(router.target);

    expect(await deployedConnector.hasRole(adminRole, owner)).to.equal(true);
    if (deployer != owner) expect(await deployedConnector.hasRole(adminRole, deployer)).to.equal(false);
    expect(await registry.validateUnderlyingRegistered(await factory.NATIVE_ADDRESS())).to.equal(true);
    expect(await registry.validateDeploymentRegistered(deployedConnector.target)).to.equal(true);

    const amountToBridge = withDecimals("1");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        owner.address,
        amountToBridge,
        allowedChainId,
        configMinGasLimit - 1n,
        "0x",
        "0x",
        { value: 1n }
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E6");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        ownerAddress,
        amountToBridge,
        allowedChainId,
        configMinGasLimit - 1n,
        "0x",
        "0x",
        { value: 1n }
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E6");

    const allowedChainIdTwo = [997];
    const configMinGasLimitTwo = 100000n;
    const configPeerTwo = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsTwo = 18n;

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdTwo,
        [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, false]]
    );

    const chainConfigDataTwo = await deployedConnector.getChainConfigs([allowedChainIdTwo[0]]);

    expect(chainConfigDataTwo[0].peerAddress).to.equal(configPeerTwo);
    expect(chainConfigDataTwo[0].minGasLimit).to.equal(configMinGasLimitTwo);
    expect(chainConfigDataTwo[0].decimals).to.equal(configDecimalsTwo);
    expect(chainConfigDataTwo[0].paused).to.equal(false);

    const allowedChainIdThree = [997, 999];
    const configMinGasLimitThreeOne = 100000n;
    const configMinGasLimitThreeTwo = 150000n;
    const configPeerThreeOne = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
    const configPeerThreeTwo = "0xf4050b2c873c7c8d2859c07d9f9d71fff19873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsThreeOne = 16n;
    const configDecimalsThreeTwo = 20n;

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdThree,
        [
            [configPeerThreeOne, configMinGasLimitThreeOne, configDecimalsThreeOne, true],
            [configPeerThreeTwo, configMinGasLimitThreeTwo, configDecimalsThreeTwo, false]
        ]
    );

    const chainConfigDataThreeOne = await deployedConnector.getChainConfigs([allowedChainIdThree[0]]);
    const chainConfigDataThreeTwo = await deployedConnector.getChainConfigs([allowedChainIdThree[1]]);

    expect(chainConfigDataThreeOne[0].peerAddress).to.equal(configPeerThreeOne);
    expect(chainConfigDataThreeOne[0].minGasLimit).to.equal(configMinGasLimitThreeOne);
    expect(chainConfigDataThreeOne[0].decimals).to.equal(configDecimalsThreeOne);
    expect(chainConfigDataThreeOne[0].paused).to.equal(true);
    expect(chainConfigDataThreeTwo[0].peerAddress).to.equal(configPeerThreeTwo);
    expect(chainConfigDataThreeTwo[0].minGasLimit).to.equal(configMinGasLimitThreeTwo);
    expect(chainConfigDataThreeTwo[0].decimals).to.equal(configDecimalsThreeTwo);
    expect(chainConfigDataThreeTwo[0].paused).to.equal(false);

    await expect(deployedConnector.connect(owner).initializeConnector(
        ownerAddress,
        await factory.NATIVE_ADDRESS(),
        router.target,
        allowedChainIds,
        chainConfigs
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E0");

    if (deployer != owner) {
        await expect(deployedConnector.connect(deployer).setRouter(
            router.target
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

        await expect(deployedConnector.connect(deployer).setChainConfig(
            allowedChainIds, chainConfigs
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

        await expect(deployedConnector.connect(deployer).setChainConfigToDestination(
            [1, 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");
    }

    await expect(deployedConnector.connect(owner).redeem(
        owner,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(deployer).redeem(
        deployer,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(owner).storeFailedExecution(
        owner,
        1,
        "0x",
        [owner.address, allowedChainId, configPeer, configDecimals],
        "0x"
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(deployer).setChainConfigByRouter(
        [],
        [],
        [owner.address, allowedChainId, configPeer, configDecimals]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E1");

    await expect(deployedConnector.connect(owner).setChainConfig(
        [testDstChainId, 12],
        chainConfigs
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E4");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [1, 2, 3],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E4");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [1, 2],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(deployedConnector, "ATSBase__E4");

    const allowedChainIdFour = [31338];
    const configMinGasLimitFour = 0n;
    const configPeerFour = zeroHash;
    const configDecimalsFour = 18n;

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdFour,
        [[configPeerFour, configMinGasLimitFour, configDecimalsFour, false]]
    );

    const tokenAmountToBridge = withDecimals("100");

    const estimatedGasLimit = await deployedConnector.estimateBridgeFee(
        allowedChainId,
        1n,
        0,
        "0x"
    );
    const minGasLimit = estimatedGasLimit[1];

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        zeroAddress,
        tokenAmountToBridge,
        allowedChainId,
        minGasLimit,
        "0x",
        "0x",
        { value: configMinGasLimit + tokenAmountToBridge }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E4");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        "0x",
        tokenAmountToBridge,
        allowedChainId,
        minGasLimit,
        "0x",
        "0x",
        { value: configMinGasLimit + tokenAmountToBridge }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E4");

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        owner.address,
        tokenAmountToBridge,
        allowedChainIdFour[0],
        minGasLimit + 500000n,
        "0x",
        "0x",
        { value: configMinGasLimit + tokenAmountToBridge }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

    const allowedChainIdFive = [testCurChainId];
    const configMinGasLimitFive = 100000n;
    const configPeerFive = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
    const configDecimalsFive = 16n;

    const zeroChainConfig = [["0x", configMinGasLimit, configDecimals, false]];

    await deployedConnector.connect(owner).setChainConfig(
        [testDstChainId],
        [["0x", configMinGasLimitFive, configDecimalsFive, false]]
    );

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [testDstChainId, testDstChainId],
        [[allowedChainIds, zeroChainConfig], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [testDstChainId, testDstChainId],
        [[allowedChainIds, chainConfigs], [allowedChainIds, zeroChainConfig]]
    )).to.be.revertedWithCustomError(router, "ATSRouter__E5");

    await deployedConnector.connect(owner).setChainConfig(
        allowedChainIdFive,
        [[configPeerFive, configMinGasLimitFive, configDecimalsFive, false]]
    );

    await expect(deployedConnector.connect(owner).bridge(
        owner.address,
        owner.address,
        tokenAmountToBridge,
        allowedChainIdFive[0],
        minGasLimit + 500000n,
        "0x",
        "0x",
        { value: configMinGasLimit + tokenAmountToBridge }
    )).to.be.revertedWithCustomError(router, "ATSRouter__E1");

    await expect(deployedConnector.connect(owner).setChainConfigToDestination(
        [allowedChainIdFive[0], 2],
        [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
    )).to.be.revertedWithCustomError(router, "ATSRouter__E1");

    await deployedConnector.connect(owner).setChainConfig(
        [testDstChainId],
        chainConfigs
    );

    return deployedConnector;
};

module.exports = {
    convert, convertToBytes, encodeParamsToRedeem, encodeParamsToUpdateConfig, encodeParamsToDeployToken, encodeParamsToDeployConnector, encodeParamsToDeploy,
    validateBridgeFee, validateDeployFee, deployTokenByFactory, deployConnectorByFactory, deployNativeConnectorByFactory, AbiCoder
};