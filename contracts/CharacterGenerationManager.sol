// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CharacterGenerationManager is Ownable {
    IERC20 public DNDToken;

    address public treasury;

    uint256 public generationPrice;

    event CharacterGenerationRequested(address requester);

    constructor(
        address tokenAddress_,
        address treasury_,
        uint256 generationPrice_
    ) Ownable(msg.sender) {
        _setDNDToken(tokenAddress_);

        _setTreasury(treasury_);

        _setGenerationPrice(generationPrice_);
    }

    function setDNDToken(address tokenAddress_) external onlyOwner {
        _setDNDToken(tokenAddress_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function setGenerationPrice(uint256 generationPrice_) external onlyOwner {
        _setGenerationPrice(generationPrice_);
    }

    function requestCharacterGeneration() external {
        DNDToken.transferFrom(msg.sender, treasury, generationPrice);

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

    function _setGenerationPrice(uint256 generationPrice_) private {
        require(
            generationPrice_ > 0,
            "CharacterGenerationManager: character generation price should be above 0"
        );

        generationPrice = generationPrice_;
    }
}
