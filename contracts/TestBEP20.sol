// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./common/BEP20.sol";

contract TestBEP20 is BEP20 {
    constructor(uint256 initialSupply) BEP20("TestBEP20", "TBT") {
        _mint(msg.sender, initialSupply * 10**18);
    }
}
