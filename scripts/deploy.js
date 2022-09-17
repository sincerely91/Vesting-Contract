const config = require("../hardhat.config");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying contracts...",
    deployer.address,
    (await deployer.getBalance()).toString()
  );

  const TestBEP20 = await ethers.getContractFactory("TestBEP20");
  const testBep20 = await TestBEP20.deploy(1e8);
  console.log("Test BEP20 token contract deployed to:", testBep20.address);

  const VestingContract = await ethers.getContractFactory("VestingContract");
  const vestingContract = await VestingContract.deploy(testBep20.address);
  console.log("Cloudr Vesting contract deployed to:", vestingContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
