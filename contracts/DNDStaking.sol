// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {AbstractStaking} from "@solarity/solidity-lib/finance/staking/AbstractStaking.sol";

contract DNDStaking is AbstractStaking {
    using SafeERC20 for IERC20;

    uint256 public rewardsBalance;

    function topUpRewards(uint256 amount_) external {
        IERC20(rewardsToken()).safeTransferFrom(msg.sender, address(this), amount_);

        rewardsBalance += amount_;
    }

    function __DNDStaking_init(
        address dndToken_,
        uint256 rate_,
        uint256 stakingStartTime_
    ) external initializer {
        __AbstractStaking_init(dndToken_, dndToken_, rate_, stakingStartTime_);
    }

    function _afterRemoveShares(address user_, uint256 amount_) internal virtual override {
        IERC20 sharesToken_ = IERC20(sharesToken());

        require(
            sharesToken_.balanceOf(address(this)) - rewardsBalance >= amount_,
            "Insufficient rewards balance"
        );

        sharesToken_.safeTransfer(user_, amount_);
    }

    function _afterDistributeValue(address user_, uint256 amount_) internal virtual override {
        require(rewardsBalance >= amount_, "Insufficient rewards balance");

        rewardsBalance -= amount_;

        IERC20(rewardsToken()).safeTransfer(user_, amount_);
    }

    function _getValueToDistribute(
        uint256 timeUpTo_,
        uint256 timeLastUpdate_
    ) internal view virtual override returns (uint256) {
        uint256 rate_ = rate();

        uint256 duration_ = (timeUpTo_ - timeLastUpdate_);

        // Determine a dynamic rate that ensures we never over-distribute
        uint256 maxPossibleRate_ = rewardsBalance / duration_;
        uint256 effectiveRate_ = rate_ < maxPossibleRate_ ? rate_ : maxPossibleRate_;

        uint256 rewardsToDistribute_ = effectiveRate_ * duration_;

        // Ensure we never distribute more than available rewards
        return rewardsToDistribute_ > rewardsBalance ? rewardsBalance : rewardsToDistribute_;
    }
}
