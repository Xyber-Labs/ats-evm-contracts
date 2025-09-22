const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ATSCodeStorageModule", (m) => {

    const codeStorage = m.contract("ATSCodeStorage");
    const codeStoragePure = m.contract("ATSCodeStoragePure");
    const codeStorageMintable = m.contract("ATSCodeStorageMintable");
    const codeStorageTokenWithFee = m.contract("ATSCodeStorageTokenWithFee");
    const codeStorageConnectorWithFee = m.contract("ATSCodeStorageConnectorWithFee");
    const codeStorageMintableWithFee = m.contract("ATSCodeStorageMintableWithFee");
    const codeStorageConnectorNative = m.contract("ATSCodeStorageConnectorNative");

    return { codeStorage, codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, codeStoragePure, codeStorageConnectorWithFee, codeStorageConnectorNative };
});