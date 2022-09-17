require("@nomiclabs/hardhat-waffle");
require("./tasks/flatter");
require("./tasks/delay");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.2",
  networks: {
    mainnet: {
      url: "https://bsc-dataseed1.binance.org",
      accounts: [],
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [],
    },
  },
};
