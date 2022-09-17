const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { network, ethers } = require("hardhat");
const { increaseBlockTime, setBlockTime } = require("./utils");

describe("VestingContract Contract", function () {
  let TestBEP20, VestingContract, testBep20, vestingContract;
  let owner, beneficiary, addr1, addrs;
  const totalSupply = 1e8;
  const decimals = 1e18;

  before(async function () {
    TestBEP20 = await ethers.getContractFactory("TestBEP20");
    VestingContract = await ethers.getContractFactory("VestingContract");
  });
  beforeEach(async function () {
    [owner, beneficiary, addr1, ...addrs] =
      await ethers.getSigners();
    testBep20 = await TestBEP20.deploy(totalSupply);
    await testBep20.deployed();
    vestingContract = await VestingContract.deploy(testBep20.address);
    await vestingContract.deployed();
  });

  describe("Cloudr Vesting Contract", function () {
    it("Contract Deployments", async function () {
      expect(await testBep20.name()).to.be.equal("TestBEP20");
      expect(await testBep20.symbol()).to.be.equal("TBT");
      expect(await testBep20.totalSupply() / decimals).to.be.equal(totalSupply);
      expect(await vestingContract.getToken()).to.be.equal(testBep20.address);
    });

    it("Should be able to initialize contract", async function () {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;
      // check initial start time
      expect(await vestingContract.getStartTime()).to.be.equal(0);
      expect(await vestingContract.getBeneficiaryAddress()).to.be.equal(ethers.constants.AddressZero);
      // check if paused state works
      await expect(vestingContract.getDailyReleasableAmount(startTime)).to.be.revertedWith("Pausable: paused");
      // initialize contract
      await vestingContract.initialize(startTime, beneficiary.address);
      // check start time and beneficiary address
      expect(await vestingContract.getStartTime()).to.be.equal(startTime);
      expect(await vestingContract.getBeneficiaryAddress()).to.be.equal(beneficiary.address);
      expect((await vestingContract.getDailyReleasableAmount(startTime)) / decimals).to.be.equal(totalSupply / 5 / 30); 
    });

    it("Should be able to assign beneficiary", async function () {
      // initialize
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;
      await vestingContract.initialize(startTime, beneficiary.address);
      expect(await vestingContract.getBeneficiaryAddress()).to.be.equal(beneficiary.address);
      // set beneficiary
      await vestingContract.setBeneficiaryAddress(addr1.address);
      expect(await vestingContract.getBeneficiaryAddress()).to.be.equal(addr1.address);
    });

    it("Should create vesting schedules", async function () {
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp;

      // initialize the vesting schedules
      await vestingContract.initialize(startTimestamp, beneficiary.address);
      // test get vesting schedule count
      expect(await vestingContract.getVestingSchedulesCount()).to.be.equal(6);
      // test get start time
      expect(await vestingContract.getStartTime()).to.be.equal(startTimestamp);
      // check if it is initialized
      await expect(vestingContract.initialize(startTimestamp, addr1.address)).to.be.revertedWith("Initializable: contract is already initialized");

      // test vesting schedule
      const vestedAmounts = [20, 20, 15, 15, 15, 15];
      for (let i = 0; i < vestedAmounts.length; i ++) {
        const vestingSchedule = await vestingContract.getVestingSchedule(i);
        // expect(vestingSchedule.beneficiary).to.be.equal(addr2.address);
        expect(vestingSchedule.totalAmount / decimals).to.be.equal(totalSupply * vestedAmounts[i] / 100);
        expect(vestingSchedule.startTime).to.be.equal(startTimestamp + 3600 * 24 * 30 * i);
        expect(vestingSchedule.duration).to.be.equal(3600 * 24 * 30);
      }
    });

    it("Should be able to vest tokens according to the schedule", async function () {
      await expect(vestingContract.getReleasableAmount()).to.be.revertedWith("VestingContract: vesting schedule is not set");
      // initialize
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      console.log("Gas estimated for initialization:", String(await vestingContract.estimateGas.initialize(startTimestamp, beneficiary.address)));
      await vestingContract.initialize(startTimestamp, beneficiary.address);

      // Fast-forward 30 days
      await setBlockTime(30 * 24 * 3600 + parseInt(startTimestamp), vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 1 month").to.equal(totalSupply * 20 / 100);
      // Fast-forward another 30 days
      await increaseBlockTime(30 * 24 * 3600, vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 2 months").to.equal(totalSupply * 40 / 100);
      // Fast-forward another 30 days
      await increaseBlockTime(30 * 24 * 3600, vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 3 months").to.equal(totalSupply * 55 / 100);
      // Fast-forward another 30 days
      await increaseBlockTime(30 * 24 * 3600, vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 4 months").to.equal(totalSupply * 70 / 100);
      // Fast-forward another 30 days
      await increaseBlockTime(30 * 24 * 3600, vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 5 months").to.equal(totalSupply * 85 / 100);
      // Fast-forward another 30 days
      await increaseBlockTime(30 * 24 * 3600, vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 6 months").to.equal(totalSupply * 100 / 100);
      // Fast-forward another 1 days
      await increaseBlockTime(24 * 3600, vestingContract);
      expect((await vestingContract.getReleasableAmount()) / decimals, "Release amount after 6 months 1 day").to.equal(totalSupply * 100 / 100);
    });
    
    it("Should be able to witdhdraw", async function () {
      expect(await vestingContract.connect(addr1).getWithdrawableAmount()).to.be.equal(await testBep20.balanceOf(vestingContract.address));
      await testBep20.connect(owner).transfer(vestingContract.address, await testBep20.totalSupply());
      expect(await vestingContract.connect(addr1).getWithdrawableAmount()).to.be.equal(await testBep20.balanceOf(vestingContract.address));
      // withdraw 10000
      await vestingContract.connect(owner).withdraw(10000);
      expect(await vestingContract.connect(addr1).getWithdrawableAmount()).to.be.equal((await testBep20.totalSupply()).sub(10000));
      expect(await testBep20.balanceOf(owner.address)).to.be.equal(10000);
      
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      // initialize the vesting schedules
      await vestingContract.initialize(startTimestamp, beneficiary.address);
      
      await expect(vestingContract.connect(owner).withdraw(10000)).to.be.revertedWith("Pausable: not paused");
      await vestingContract.pause();
      await expect(vestingContract.connect(owner).withdraw(await testBep20.totalSupply())).to.be.revertedWith("VestingContract: withdraw amount exceeds balance");
      await vestingContract.connect(owner).withdraw(10000);
      expect(await vestingContract.connect(addr1).getWithdrawableAmount()).to.be.equal((await testBep20.totalSupply()).sub(20000));
      expect(await testBep20.balanceOf(owner.address)).to.be.equal(20000);
    });
    
    it("Should be able to pause / unpause contract", async function () {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;
      // check if paused state works
      await expect(vestingContract.release()).to.be.revertedWith("Pausable: paused");
      // initialize contract
      await vestingContract.initialize(startTime, beneficiary.address);
      await testBep20.connect(owner).transfer(vestingContract.address, await testBep20.totalSupply());
      expect(await vestingContract.release()).to.emit(vestingContract, "Released").withArgs(beneficiary.address, BigNumber.from('1000000000000000000').mul(totalSupply).div(300)); 
      // pause
      await vestingContract.pause();
      await expect(vestingContract.release()).to.be.revertedWith("Pausable: paused");
      // unpause
      await vestingContract.unpause();
      expect(await vestingContract.release()).to.emit(vestingContract, "Released").withArgs(beneficiary.address, BigNumber.from('1000000000000000000').mul(totalSupply).div(300));
    });


    it("Should vest tokens gradually", async function () {
      // initialize
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      console.log("Gas estimated for initialization:", String(await vestingContract.estimateGas.initialize(startTimestamp, beneficiary.address)));
      await vestingContract.initialize(startTimestamp, beneficiary.address);

      // testing releasing
      const initBeneficiary = await testBep20.balanceOf(beneficiary.address);
      let releaseInfo, releaseTime, checkingTime, lastTime;
      
      await expect(vestingContract.release()).to.be.revertedWith("BEP20: transfer amount exceeds balance");
      await testBep20.connect(owner).transfer(vestingContract.address, await testBep20.totalSupply());
      // Starting point
      lastTime = 0;
      releaseTime = 100;
      await setBlockTime(parseInt(startTimestamp) + releaseTime - 1, vestingContract);
      expect(await vestingContract.release()).to.emit(vestingContract, "Released").withArgs(beneficiary.address, (await vestingContract.getVestingSchedule(0)).totalAmount.mul(releaseTime - lastTime).div(3600 * 24 * 30));
      
      checkingTime = releaseTime + 100;
      await setBlockTime(parseInt(startTimestamp) + checkingTime, vestingContract);
      releaseInfo = await vestingContract.getReleaseInfo();
      expect(releaseInfo.released / decimals - totalSupply * 20 * releaseTime / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.releasable / decimals - totalSupply * 20 * (checkingTime - releaseTime) / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.total / decimals - totalSupply * 20 * checkingTime / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect((await testBep20.balanceOf(beneficiary.address)).sub(initBeneficiary)).to.be.equal(releaseInfo.released);

      // Fast-forward 10 days
      lastTime = releaseTime;
      releaseTime = lastTime + 3600 * 24 * 10;
      await setBlockTime(parseInt(startTimestamp) + releaseTime - 1, vestingContract);
      expect(await vestingContract.release()).to.emit(vestingContract, "Released").withArgs(beneficiary.address, (await vestingContract.getVestingSchedule(0)).totalAmount.mul(releaseTime - lastTime).div(3600 * 24 * 30));
      
      checkingTime = releaseTime + 100;
      await setBlockTime(parseInt(startTimestamp) + checkingTime, vestingContract);
      releaseInfo = await vestingContract.getReleaseInfo();
      expect(releaseInfo.released / decimals - totalSupply * 20 * releaseTime / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.releasable / decimals - totalSupply * 20 * (checkingTime - releaseTime) / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.total / decimals - totalSupply * 20 * checkingTime / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect((await testBep20.balanceOf(beneficiary.address)).sub(initBeneficiary)).to.be.equal(releaseInfo.released);

      // Fast-forward 30 days
      lastTime = releaseTime;
      releaseTime = lastTime + 3600 * 24 * 20;
      await setBlockTime(parseInt(startTimestamp) + releaseTime - 1, vestingContract);
      expect(await vestingContract.release()).to.emit(vestingContract, "Released").withArgs(beneficiary.address, (await vestingContract.getVestingSchedule(1)).totalAmount.mul(releaseTime - lastTime).div(3600 * 24 * 30));
      
      checkingTime = releaseTime + 100;
      await setBlockTime(parseInt(startTimestamp) + checkingTime, vestingContract);
      releaseInfo = await vestingContract.getReleaseInfo();
      expect(releaseInfo.released / decimals - totalSupply * 20 * releaseTime / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.releasable / decimals - totalSupply * 20 * (checkingTime - releaseTime) / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.total / decimals - totalSupply * 20 * checkingTime / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect((await testBep20.balanceOf(beneficiary.address)).sub(initBeneficiary)).to.be.equal(releaseInfo.released);

      // Fast-forward 120 days
      lastTime = releaseTime;
      releaseTime = lastTime + 3600 * 24 * 60;
      await setBlockTime(parseInt(startTimestamp) + releaseTime - 1, vestingContract);
      expect(await vestingContract.release()).to.emit(vestingContract, "Released").withArgs(beneficiary.address, (await vestingContract.getVestingSchedule(4)).totalAmount.mul(releaseTime - lastTime).div(3600 * 24 * 30));
      
      checkingTime = releaseTime + 100;
      await setBlockTime(parseInt(startTimestamp) + checkingTime, vestingContract);
      releaseInfo = await vestingContract.getReleaseInfo();
      expect(releaseInfo.released / decimals - totalSupply * (20 * (checkingTime - 3600 * 24 * 30 * 3) + 20 * 3600 * 24 * 30 * 3)/ 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.releasable / decimals - totalSupply * 20 * (checkingTime - releaseTime) / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect(releaseInfo.total / decimals - totalSupply * (20 * (checkingTime - 3600 * 24 * 30 * 3) + 20 * 3600 * 24 * 30 * 3) / 100 / 30 / 3600 / 24).to.be.lessThanOrEqual(1e-8);
      expect((await testBep20.balanceOf(beneficiary.address)).sub(initBeneficiary)).to.be.equal(releaseInfo.released);
    });
  });
});
