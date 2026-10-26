const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deploys the full stack and wires it: compliance gate, bankroll, registry,
// the two games, per-game exposure caps, and an initial funded bankroll.
// Seeds are committed by the (off-chain) operator engine, not here.
async function main() {
  const [deployer] = await ethers.getSigners();
  const operator = process.env.OPERATOR_ADDRESS || deployer.address;
  const houseEdgeBps = Number(process.env.HOUSE_EDGE_BPS || 100);

  console.log("deployer:", deployer.address);
  console.log("operator:", operator);

  const Compliance = await ethers.getContractFactory("ComplianceRegistry");
  const compliance = await Compliance.deploy(deployer.address);
  await compliance.waitForDeployment();

  const Bankroll = await ethers.getContractFactory("Bankroll");
  const bankroll = await Bankroll.deploy(ethers.parseEther("1")); // 1 ETH max bet
  await bankroll.waitForDeployment();

  const Registry = await ethers.getContractFactory("GameRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const Dice = await ethers.getContractFactory("DiceGame");
  const dice = await Dice.deploy(bankroll.target, compliance.target, operator, houseEdgeBps);
  await dice.waitForDeployment();

  const Crash = await ethers.getContractFactory("CrashGame");
  const crash = await Crash.deploy(bankroll.target, compliance.target, operator, houseEdgeBps);
  await crash.waitForDeployment();

  // wiring
  await (await bankroll.setGame(dice.target, true)).wait();
  await (await bankroll.setGame(crash.target, true)).wait();
  await (await registry.register(dice.target)).wait();
  await (await registry.register(crash.target)).wait();

  // isolate each game's risk: cap each game's total open exposure
  await (await bankroll.setMaxExposure(dice.target, ethers.parseEther("10"))).wait();
  await (await bankroll.setMaxExposure(crash.target, ethers.parseEther("10"))).wait();

  // seed the house (skip on live nets where liquidity is funded separately)
  if (process.env.FUND_ETH) {
    await (await bankroll.fund({ value: ethers.parseEther(process.env.FUND_ETH) })).wait();
  }

  const out = {
    network: (await ethers.provider.getNetwork()).name,
    compliance: compliance.target,
    bankroll: bankroll.target,
    registry: registry.target,
    dice: dice.target,
    crash: crash.target,
    operator,
    houseEdgeBps,
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${out.network || "local"}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("deployed:\n", JSON.stringify(out, null, 2));
  console.log("saved ->", file);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
