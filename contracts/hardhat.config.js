require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// This sandbox blocks the solc download host, so point Hardhat at a locally
// installed solc 0.8.24 instead of letting it fetch one. On a normal machine
// this override is harmless; remove it and Hardhat downloads solc as usual.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    const fs = require("fs");
    const candidates = [
      "/tmp/node_modules/solc/soljson.js",
      process.env.HOME + "/.cache/hardhat-nodejs/compilers-v2/wasm/solc-0.8.24+commit.e11b9ed9.js",
    ];
    const compilerPath = candidates.find((p) => fs.existsSync(p));
    if (compilerPath) {
      return {
        compilerPath,
        isSolcJs: true,
        version: args.solcVersion,
        longVersion: "0.8.24+commit.e11b9ed9",
      };
    }
  }
  return runSuper();
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
