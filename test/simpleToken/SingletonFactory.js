const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

async function SingletonFactoryFixture() {
    const [admin, user] = await ethers.getSigners();

    const initCalldata = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

    const SingletonFactory = await ethers.getContractFactory("SingletonFactory", admin);
    const singletonFactoryImplementation = await SingletonFactory.deploy(admin.address);
    await singletonFactoryImplementation.waitForDeployment();

    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy", admin);
    const singletonFactoryProxy = await ERC1967Proxy.deploy(singletonFactoryImplementation.target, initCalldata);
    await singletonFactoryProxy.waitForDeployment();

    const singletonFactory = await ethers.getContractAt("SingletonFactory", singletonFactoryProxy);

    const adminRole = await singletonFactory.DEFAULT_ADMIN_ROLE();
    const pauserRole = await singletonFactory.PAUSER_ROLE();
    const zeroHash = ethers.ZeroHash;
    const defaultDecimals = 18;

    return { admin, user, singletonFactory, adminRole, pauserRole, zeroHash, defaultDecimals };
};

async function deployToken(
    factory,
    deployer,
    tokenId,
    name,
    symbol,
    decimals,
    totalSupply
) {
    const tokenFutureAddress = ethers.getCreateAddress({
        from: factory.target,
        nonce: await ethers.provider.getTransactionCount(factory.target)
    });

    await expect(factory.connect(deployer).deploy(
        tokenId,
        name,
        symbol,
        totalSupply
    )).to.emit(factory, "Deployed").withArgs(tokenId, tokenFutureAddress, name, symbol);

    const deployedToken = await ethers.getContractAt("ERC20Token", tokenFutureAddress);

    expect(await deployedToken.name()).to.equal(name);
    expect(await deployedToken.symbol()).to.equal(symbol);
    expect(await deployedToken.decimals()).to.equal(decimals);
    expect(await deployedToken.totalSupply()).to.equal(totalSupply);
    expect(await deployedToken.balanceOf(deployer)).to.equal(totalSupply);
    if (deployer != deployedToken.target) expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(0);

    return deployedToken;
}

describe("SingletonFactory", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, singletonFactory } = await loadFixture(SingletonFactoryFixture);

            expect(await singletonFactory.SINGLETON_ROUTER()).to.equal(admin.address);
            expect(await singletonFactory.paused()).to.equal(false);
            expect(await singletonFactory.supportsInterface("0xf0858621")).to.equal(true);
            expect(await singletonFactory.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await singletonFactory.SYSTEM_CONTRACT_TYPE()).to.equal("0x06");
        });

        it("Proxy test", async function () {
            const { admin, user, singletonFactory, adminRole, pauserRole } = await loadFixture(SingletonFactoryFixture);

            expect(await singletonFactory.hasRole(adminRole, admin)).to.equal(true);

            await expect(singletonFactory.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(singletonFactory, "AccessControlUnauthorizedAccount");

            await expect(singletonFactory.connect(user).initialize(
                user
            )).to.be.revertedWithCustomError(singletonFactory, "InvalidInitialization");

            await singletonFactory.connect(admin).grantRole(pauserRole, admin);
            await singletonFactory.connect(admin).pause();

            expect(await singletonFactory.paused()).to.equal(true);

            const SingletonFactoryImplMock = await ethers.getContractFactory("SingletonFactory", admin);
            const singletonFactoryImplementation = await SingletonFactoryImplMock.deploy(user.address);
            await singletonFactoryImplementation.waitForDeployment();

            await singletonFactory.connect(admin).upgradeToAndCall(singletonFactoryImplementation.target, "0x");

            expect(await singletonFactory.SINGLETON_ROUTER()).to.equal(user.address);

            expect(await singletonFactory.paused()).to.equal(true);
        });
    });

    describe("Pausable", function () {
        it("AccessControl", async function () {
            const { admin, singletonFactory } = await loadFixture(SingletonFactoryFixture);

            await expect(singletonFactory.connect(admin).pause()).to.be.revertedWithCustomError(singletonFactory, "AccessControlUnauthorizedAccount");
            await expect(singletonFactory.connect(admin).unpause()).to.be.revertedWithCustomError(singletonFactory, "AccessControlUnauthorizedAccount");
        });

        it("Setter", async function () {
            const { admin, singletonFactory, user, pauserRole } = await loadFixture(SingletonFactoryFixture);

            await singletonFactory.connect(admin).grantRole(pauserRole, user);

            expect(await singletonFactory.paused()).to.equal(false);

            await singletonFactory.connect(user).pause();

            expect(await singletonFactory.paused()).to.equal(true);

            await singletonFactory.connect(user).unpause();

            expect(await singletonFactory.paused()).to.equal(false);
        });
    });

    describe("deploy", function () {
        it("SingletonFactory E0", async function () {
            const { admin, user, singletonFactory, zeroHash } = await loadFixture(SingletonFactoryFixture);

            await expect(singletonFactory.connect(user).deploy(
                zeroHash,
                "",
                "",
                0
            )).to.be.revertedWithCustomError(singletonFactory, "SingletonFactory__E0");

            await singletonFactory.connect(admin).deploy(
                zeroHash,
                "",
                "",
                0
            );
        });

        it("Deployment", async function () {
            const { admin, singletonFactory, zeroHash, defaultDecimals } = await loadFixture(SingletonFactoryFixture);

            let tokenId = zeroHash;
            let name = "test1";
            let symbol = "test2";
            let totalSupply = 0;

            const deployedTokenOne = await deployToken(
                singletonFactory,
                admin,
                tokenId,
                name,
                symbol,
                defaultDecimals,
                totalSupply
            );

            tokenId = "0x1125d80b1bfd5070dc073c0d554f7fccb5ccb8e0fe541927bb03faf1bf40df5a";
            name = "test3";
            symbol = "test4";
            totalSupply = 1;

            const deployedTokenTwo = await deployToken(
                singletonFactory,
                admin,
                tokenId,
                name,
                symbol,
                defaultDecimals,
                totalSupply
            );

            expect(deployedTokenOne == deployedTokenTwo).to.equal(false);

            tokenId = "0x1decb6078d4e6ec6054e96a04b51fc55bce14f42a69e3b21d96c92584af7ad79";
            name = "12345";
            symbol = "67890";
            totalSupply = 100000000000000000000000000000n;

            const deployedTokenThree = await deployToken(
                singletonFactory,
                admin,
                tokenId,
                name,
                symbol,
                defaultDecimals,
                totalSupply
            );

            expect(deployedTokenThree == deployedTokenTwo).to.equal(false);
        });
    });
});