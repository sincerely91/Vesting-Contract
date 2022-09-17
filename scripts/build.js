const hre = require("hardhat");
const { basename } = require("path");

let inputs = require("../build-contracts.json");

async function main() {
  if (process.argv.length > 2) {
    inputs = process.argv.slice(2);
  }
  for (const file of inputs) {
    const files = [file];
    const output = `./dist/${basename(file)}`;
    await hre.run("flatter", { files, output });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
