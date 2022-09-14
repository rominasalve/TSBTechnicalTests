require("@nomicfoundation/hardhat-toolbox");
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

const {
  API_ROPSTEN_URL,
  PRIVATE_KEY,
  PRIVATE_KEY_2,
} = process.env;

module.exports = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat", //In order to run tests against it
  networks: {
     ropsten: {
      url: API_ROPSTEN_URL,
      accounts: [`0x${PRIVATE_KEY}`, `0x${PRIVATE_KEY_2}`]
    },
  }
};
