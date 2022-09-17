const { network, ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const increaseBlockTime = async (seconds, ...mocks) => {
  const tasks = [];
  const currentTimestamp = parseInt(
    (await ethers.provider.getBlock("latest")).timestamp
  );
  if (network.name === "hardhat") {
    const nextTimestamp = currentTimestamp + seconds;
    await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp]);
    for (const mock of mocks) {
      if (typeof mock.setCurrentTime === "function") {
        tasks.push(mock.setCurrentTime(nextTimestamp));
      }
    }
    await network.provider.send("evm_mine");
  } else {
    for (const mock of mocks) {
      let currentMockTime = 0;
      let mockStartTime = 0;
      if (typeof mock.getStartTime === "function") {
        mockStartTime = parseInt(await mock.getStartTime());
      }
      if (typeof mock.getCurrentTime === "function") {
        currentMockTime = parseInt(await mock.getCurrentTime());
      }
      mockStartTime = mockStartTime || currentTimestamp;
      const nextTimestamp = (currentMockTime || mockStartTime) + seconds;
      if (typeof mock.setCurrentTime === "function") {
        tasks.push(mock.setCurrentTime(nextTimestamp));
      }
    }
  }
  await Promise.allSettled(tasks);
};

const setBlockTime = async (timestamp, ...mocks) => {
  const tasks = [];
  if (network.name === "hardhat") {
    await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  }
  for (const mock of mocks) {
    if (typeof mock.setCurrentTime === "function") {
      tasks.push(mock.setCurrentTime(timestamp));
    }
  }
  if (network.name === "hardhat") {
    await network.provider.send("evm_mine");
  }
  await Promise.allSettled(tasks);
};

module.exports = {
  increaseBlockTime,
  setBlockTime,
};
