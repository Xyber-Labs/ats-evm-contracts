const { convertToBytes, AbiCoder } = require("./ERC20UtilFunctions");
const { sRouterBridgeMessageType, sRouterDeployMessageType } = require("./GlobalConstants");

async function encodeParamsToRedeem(
    dstSingletonRouter,
    tokenId,
    dstReceiver,
    amount
) {
    const dstSingletonRouterAddress = await convertToBytes(dstSingletonRouter);

    const localParams = AbiCoder.encode([
        "bytes32",
        "bytes",
        "uint256"
    ], [
        tokenId,
        dstReceiver,
        amount
    ]);

    const params = AbiCoder.encode([
        "bytes",
        "bytes1",
        "bytes"
    ], [
        dstSingletonRouterAddress,
        sRouterBridgeMessageType,
        localParams
    ]);

    return params;
};

async function encodeParamsToDeploy(
    dstSingletonRouter,
    tokenId,
    name,
    symbol,
    totalSupply,
    dstReceiver,
    amount
) {
    const dstSingletonRouterAddress = await convertToBytes(dstSingletonRouter);

    const deployLocalParams = AbiCoder.encode([
        "bytes32",
        "string",
        "string",
        "uint256"
    ], [
        tokenId,
        name,
        symbol,
        totalSupply
    ]);

    const redeemLocalParams = AbiCoder.encode([
        "bytes32",
        "bytes",
        "uint256"
    ], [
        tokenId,
        dstReceiver,
        amount
    ]);

    const localParams = AbiCoder.encode([
        "bytes",
        "bytes"
    ], [
        deployLocalParams,
        redeemLocalParams
    ]);

    const params = AbiCoder.encode([
        "bytes",
        "bytes1",
        "bytes"
    ], [
        dstSingletonRouterAddress,
        sRouterDeployMessageType,
        localParams
    ]);

    return params;
};

module.exports = { convertToBytes, encodeParamsToRedeem, encodeParamsToDeploy, AbiCoder };