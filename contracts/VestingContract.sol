// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "./common/IBEP20.sol";
import "./common/SafeBEP20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

struct VestingSchedule {
    // total amount of tokens to be released at the end of the vesting
    uint256 totalAmount;
    // start time of the vesting period
    uint256 startTime;
    // duration of the vesting period in seconds
    uint256 duration;
}

contract VestingContract is Ownable, Initializable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    /**
     * @notice Reased event
     * @param beneficiaryAddress address to receive the released tokens.
     * @param amount released amount of tokens
     */
    event Released(address beneficiaryAddress, uint256 amount);

    uint256 private constant _RELEASE_TIME_UNIT = 30 days;
    IBEP20 private immutable _token;

    uint256 private _startTime;
    address private _beneficiaryAddress;
    mapping(uint256 => VestingSchedule) private _vestingSchedule;
    uint256 private _vestingScheduleCount;
    uint256 private _lastReleasedTime;
    uint256 private _releasedAmount;
    mapping(uint256 => uint256) private _previousTotalVestingAmount;

    /**
     * @dev Creates a vesting contract.
     * @param token_ address of the BEP20 token contract
     */
    constructor(address token_) {
        require(token_ != address(0), "MetTokenVesting: invalid token address");
        _token = IBEP20(token_);
        _pause();
    }

    /**
     * @dev Returns the address of the BEP20 token managed by the vesting contract.
     */
    function getToken() external view returns (address) {
        return address(_token);
    }

    /**
     * @notice Set the beneficiary addresses of vesting schedule.
     * @param beneficiary_ address of the beneficiary.
     */
    function setBeneficiaryAddress(address beneficiary_) external onlyOwner {
        _setBeneficiaryAddress(beneficiary_);
    }

    /**
     * @notice Set the beneficiary addresses of vesting schedule.
     * @param beneficiary_ address of the beneficiary.
     */
    function _setBeneficiaryAddress(address beneficiary_) internal {
        require(beneficiary_ != address(0), "VestingContract: invalid beneficiary address");
        _beneficiaryAddress = beneficiary_;
    }

    /**
     * @notice Get the beneficiary addresses of vesting schedule.
     * @return beneficiary address of the beneficiary.
     */
    function getBeneficiaryAddress() external view returns (address) {
        return _beneficiaryAddress;
    }

    /**
     * @notice Initialize vesting schedule with start time.
     * @param startTime_ start time of vesting schedule.
     * @param beneficiary_ address of the beneficiary.
     */
    function initialize(uint256 startTime_, address beneficiary_) external initializer onlyOwner {
        uint256 RELEASE_AMOUNT_UNIT = _token.totalSupply().div(100);
        _setBeneficiaryAddress(beneficiary_);
        _startTime = startTime_;
        uint8[6] memory vestingSchedule = [20, 20, 15, 15, 15, 15];
        for (uint256 i = 0; i < 6; i ++) {
            _createVestingSchedule(vestingSchedule[i] * RELEASE_AMOUNT_UNIT);
        }
        _unpause();
    }

    /**
     * @notice Pause the vesting release.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the vesting release.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Creates a new vesting schedule for a beneficiary.
     * @param amount total amount of tokens to be released at the end of the vesting
     */
    function _createVestingSchedule(uint256 amount) internal {
        uint256 scheduleId = _vestingScheduleCount;
        _vestingSchedule[scheduleId].startTime = _startTime + scheduleId * _RELEASE_TIME_UNIT;
        _vestingSchedule[scheduleId].duration = _RELEASE_TIME_UNIT;
        _vestingSchedule[scheduleId].totalAmount = amount;
        uint256 nextScheduleId = scheduleId.add(1);
        _vestingScheduleCount = nextScheduleId;
        _previousTotalVestingAmount[nextScheduleId] = _previousTotalVestingAmount[scheduleId].add(amount);
    }

    /**
     * @dev Computes the releasable amount of tokens for a vesting schedule.
     * @param currentTime current timestamp
     * @return releasable the current releasable amount
     * @return released the amount already released to the beneficiary
     * @return total the total amount of token for the beneficiary
     */
    function _computeReleasableAmount(uint256 currentTime) internal view returns (uint256 releasable, uint256 released, uint256 total) {
        require(currentTime >= _startTime, "VestingContract: no vesting is available now");
        require(_vestingScheduleCount == 6, "VestingContract: vesting schedule is not set");

        uint256 duration = currentTime.sub(_startTime);
        uint256 scheduleCount = duration.div(_RELEASE_TIME_UNIT);
        uint256 remainTime = duration.sub(_RELEASE_TIME_UNIT * scheduleCount);
        uint256 releasableAmountTotal;

        if (scheduleCount > _vestingScheduleCount) {
            releasableAmountTotal = _previousTotalVestingAmount[_vestingScheduleCount];
        } else {
            uint256 previousVestingTotal = _previousTotalVestingAmount[scheduleCount];
            releasableAmountTotal = previousVestingTotal.add(_vestingSchedule[scheduleCount].totalAmount.mul(remainTime).div(_RELEASE_TIME_UNIT));
        }

        uint256 releasableAmount = releasableAmountTotal.sub(_releasedAmount);
        return (releasableAmount, _releasedAmount, releasableAmountTotal);
    }

    /**
     * @notice Returns the releasable amount of tokens.
     * @return _releasable the releasable amount
     */
    function getReleasableAmount() external view returns (uint256 _releasable) {
        uint256 currentTime = getCurrentTime();
        (_releasable, , ) = _computeReleasableAmount(currentTime);
    }

    /**
     * @notice Returns the token release info.
     * @return releasable the current releasable amount
     * @return released the amount already released to the beneficiary
     * @return total the total amount of token for the beneficiary
     */
    function getReleaseInfo() public view returns (uint256 releasable, uint256 released, uint256 total) {
        uint256 currentTime = getCurrentTime();
        (releasable, released, total) = _computeReleasableAmount(currentTime);
    }

    /**
     * @notice Release the releasable amount of tokens.
     * @return the success or failure
     */
    function _release(uint256 currentTime) internal returns (bool) {
        require(currentTime >= _startTime, "VestingContract: vesting schedule is not initialized");
        (uint256 releaseAmount, , ) = _computeReleasableAmount(currentTime);
        _token.safeTransfer(_beneficiaryAddress, releaseAmount);
        _releasedAmount = _releasedAmount.add(releaseAmount);
        emit Released(_beneficiaryAddress, releaseAmount);
        return true;
    }

    /**
     * @notice Release the releasable amount of tokens.
     * @return the success or failure
     */
    function release() external whenNotPaused nonReentrant returns (bool) {
        require(_release(getCurrentTime()), "VestingContract: release failed");
        return true;
    }


    /**
     * @notice Withdraw the specified amount if possible.
     * @param amount the amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant onlyOwner whenPaused {
        require(getWithdrawableAmount() >= amount, "VestingContract: withdraw amount exceeds balance");
        _token.safeTransfer(owner(), amount);
    }

    /**
     * @dev Returns the amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getWithdrawableAmount() public view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    /**
     * @dev Returns the number of vesting schedules managed by this contract.
     * @return the number of vesting schedules
     */
    function getVestingSchedulesCount() external view returns (uint256) {
        return _vestingScheduleCount;
    }

    /**
     * @notice Returns the vesting schedule information for a given identifier.
     * @param scheduleId vesting schedule index: 0, 1, 2, ...
     * @return the vesting schedule structure information
     */
    function getVestingSchedule(uint256 scheduleId) external view returns (VestingSchedule memory) {
        return _vestingSchedule[scheduleId];
    }

    /**
     * @notice Returns the release start timestamp.
     * @return the block timestamp
     */
    function getStartTime() external view returns (uint256) {
        return _startTime;
    }

    /**
     * @notice Returns the daily releasable amount of tokens for the mining pool.
     * @param currentTime current timestamp
     * @return the amount of token
     */
    function getDailyReleasableAmount(uint256 currentTime) external view whenNotPaused returns (uint256) {
        require(currentTime >= _startTime, "VestingContract: no vesting is available now");
        require( _vestingScheduleCount == 6, "VestingContract: vesting schedule is not set");
        
        uint256 duration = currentTime.sub(_startTime);
        uint256 scheduleCount = duration.div(_RELEASE_TIME_UNIT);
        if (scheduleCount > _vestingScheduleCount) return 0;
        return _vestingSchedule[scheduleCount].totalAmount.div(30);
    }

    /**
     * @notice Returns the current timestamp.
     * @return the block timestamp
     */
    function getCurrentTime() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
