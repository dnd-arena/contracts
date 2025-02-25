// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {PERCENTAGE_100} from "@solarity/solidity-lib/utils/Globals.sol";

contract DNDArena is Ownable, Pausable {
    uint256 internal constant BURN_PERCENTAGE = 10 ** 25;

    struct Arena {
        address creator;
        uint96 bid;
        address acceptor;
        uint96 winner;
    }

    ERC20Burnable public DNDToken;

    uint256 public minBid;

    uint256 public currentArenaId;

    mapping(uint256 => Arena) public arenas;
    mapping(address => uint256[]) public usersToArenaIds;

    event ArenaCreated(uint256 arenaId, address arenaCreator, uint96 bid);
    event ArenaAccepted(uint256 arenaId, address arenaAcceptor);
    event ArenaCanceled(uint256 arenaId);
    event WinnerSet(uint256 arenaId, address winner);

    constructor(address tokenAddress_, uint256 minBid_) Ownable(msg.sender) {
        _setDNDToken(tokenAddress_);

        _setMinBid(minBid_);
    }

    function createArena(uint96 bid_) external whenNotPaused {
        require(bid_ >= minBid, "DNDArena: bid is below the minimal bid");

        DNDToken.transferFrom(msg.sender, address(this), bid_);

        arenas[currentArenaId] = Arena(msg.sender, bid_, address(0), 0);

        usersToArenaIds[msg.sender].push(currentArenaId);

        emit ArenaCreated(currentArenaId++, msg.sender, bid_);
    }

    function acceptArena(uint256 arenaId_) external whenNotPaused {
        Arena memory arena_ = arenas[arenaId_];

        require(arena_.creator != address(0), "DNDArena: arena doesn't exist");
        require(arena_.creator != msg.sender, "DNDArena: you cannot accept your own arena");
        require(arena_.acceptor == address(0), "DNDArena: arena already accepted");

        DNDToken.transferFrom(msg.sender, address(this), arena_.bid);

        arenas[arenaId_].acceptor = msg.sender;

        usersToArenaIds[msg.sender].push(arenaId_);

        emit ArenaAccepted(arenaId_, msg.sender);
    }

    function cancelArena(uint256 arenaId_) external whenNotPaused {
        Arena memory arena_ = arenas[arenaId_];

        require(arena_.creator == msg.sender, "DNDArena: you are not the creator of the arena");
        require(arena_.acceptor == address(0), "DNDArena: arena has been accepted");

        delete arenas[arenaId_];

        uint256[] storage userArenaIds = usersToArenaIds[msg.sender];
        uint256 arenasNumber_ = userArenaIds.length;

        for (uint256 i = 0; i < arenasNumber_; i++) {
            if (userArenaIds[i] == arenaId_) {
                userArenaIds[i] = userArenaIds[arenasNumber_ - 1];

                userArenaIds.pop();

                break;
            }
        }

        DNDToken.transfer(msg.sender, arena_.bid);

        emit ArenaCanceled(arenaId_);
    }

    function setWinner(uint256 arenaId_, address winner_) external onlyOwner whenNotPaused {
        Arena memory arena_ = arenas[arenaId_];

        require(arena_.acceptor != address(0), "DNDArena: arena has not been accepted yet");
        require(arena_.winner == 0, "DNDArena: winner is already set");
        require(
            arena_.creator == winner_ || arena_.acceptor == winner_,
            "DNDArena: invalid winner address"
        );

        arenas[arenaId_].winner = arena_.creator == winner_ ? 1 : 2;

        uint256 awardAmount_ = arena_.bid * 2;

        uint256 amountToBurn_ = (awardAmount_ * BURN_PERCENTAGE) / PERCENTAGE_100;
        DNDToken.burn(amountToBurn_);

        DNDToken.transfer(winner_, awardAmount_ - amountToBurn_);

        emit WinnerSet(arenaId_, winner_);
    }

    function setDNDToken(address tokenAddress_) external onlyOwner {
        _setDNDToken(tokenAddress_);
    }

    function setMinBid(uint256 minBid_) external onlyOwner {
        _setMinBid(minBid_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getUserArenaIds(address user_) external view returns (uint256[] memory) {
        return usersToArenaIds[user_];
    }

    function getUserArenas(address user_) external view returns (Arena[] memory) {
        uint256[] storage arenaIds = usersToArenaIds[user_];

        Arena[] memory userArenas_ = new Arena[](arenaIds.length);

        for (uint256 i = 0; i < userArenas_.length; i++) {
            userArenas_[i] = arenas[arenaIds[i]];
        }

        return userArenas_;
    }

    function _setDNDToken(address tokenAddress_) private {
        require(tokenAddress_ != address(0), "DNDArena: zero address is not allowed");

        DNDToken = ERC20Burnable(tokenAddress_);
    }

    function _setMinBid(uint256 minBid_) private {
        require(minBid_ > 0, "DNDArena: minimal bid amount must be above zero");

        minBid = minBid_;
    }
}
