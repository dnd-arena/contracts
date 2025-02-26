// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {PERCENTAGE_100} from "@solarity/solidity-lib/utils/Globals.sol";

contract CharacterGenerationManager is Ownable {
    IERC20 public DNDToken;

    address public treasury;

    address public stakingContract;
    uint256 public stakingPercentage;

    uint256 public generationPrice;

    event CharacterGenerationRequested(address requester);

    constructor(
        address tokenAddress_,
        address treasury_,
        address stakingContract_,
        uint256 stakingPercentage_,
        uint256 generationPrice_
    ) Ownable(msg.sender) {
        _setDNDToken(tokenAddress_);

        _setTreasury(treasury_);

        _setStakingContract(stakingContract_);
        stakingPercentage = stakingPercentage_;

        _setGenerationPrice(generationPrice_);
    }

    function setDNDToken(address tokenAddress_) external onlyOwner {
        _setDNDToken(tokenAddress_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function setStakingContract(address stakingContract_) external onlyOwner {
        _setStakingContract(stakingContract_);
    }

    function setStakingPercentage(uint256 stakingPercentage_) external onlyOwner {
        stakingPercentage = stakingPercentage_;
    }

    function setGenerationPrice(uint256 generationPrice_) external onlyOwner {
        _setGenerationPrice(generationPrice_);
    }

    function requestCharacterGeneration() external {
        uint256 stakingAmount_ = (generationPrice * stakingPercentage) / PERCENTAGE_100;

        DNDToken.transferFrom(msg.sender, stakingContract, stakingAmount_);
        DNDToken.transferFrom(msg.sender, treasury, generationPrice - stakingAmount_);

        emit CharacterGenerationRequested(msg.sender);
    }

    function _setDNDToken(address tokenAddress_) private {
        require(
            tokenAddress_ != address(0),
            "CharacterGenerationManager: zero address is not allowed"
        );

        DNDToken = IERC20(tokenAddress_);
    }

    function _setTreasury(address treasury_) private {
        require(
            treasury_ != address(0),
            "CharacterGenerationManager: zero address is not allowed"
        );

        treasury = treasury_;
    }

    function _setStakingContract(address stakingContract_) private {
        require(
            stakingContract_ != address(0),
            "CharacterGenerationManager: zero address is not allowed"
        );

        stakingContract = stakingContract_;
    }

    function _setGenerationPrice(uint256 generationPrice_) private {
        require(
            generationPrice_ > 0,
            "CharacterGenerationManager: character generation price should be above 0"
        );

        generationPrice = generationPrice_;
    }
}
