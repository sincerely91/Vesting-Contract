# Vesting Contract

### Introduction
BEP20 Token Vesting Contract 

### HowTo

- Set enviroment
Clone the repository onto your local device, and install all depedencies

```shell
$ git clone https://github.com/blockchaindev91/Vesting-Contract.git
$ npm install
```

then, configurate hardhat.config.js, put your private key in the network config item

```javascript
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
```

**Notice**: *put your private key string in the item "accounts"*.

- Testing
Run the following command in the terminal to start testing on testnet enviroment.

```shell
$ npx hardhat test
```

- Deploy contracts
Deploy contracts by running such command in terminal

```shell
$ npx hardhat run scripts/deploy.js --network testnet
```

