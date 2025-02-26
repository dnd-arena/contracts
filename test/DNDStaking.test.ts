import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@test-helpers";
import { wei } from "@scripts";
import { ERC20Mock, DNDStaking } from "@ethers-v6";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DNDStaking", () => {
  const reverter = new Reverter();

  let stakingStartTime, rate;

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let TREASURY: SignerWithAddress;

  let erc20: ERC20Mock;
  let dndStaking: DNDStaking;

  before(async () => {
    [OWNER, FIRST, SECOND, TREASURY] = await ethers.getSigners();

    stakingStartTime = 3n;
    rate = wei(1);

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    erc20 = await ERC20Mock.deploy("DND Arena Token", "DND", 18);

    const DNDStaking = await ethers.getContractFactory("DNDStaking");
    dndStaking = await DNDStaking.deploy();

    await dndStaking.__DNDStaking_init(erc20, rate, stakingStartTime);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("initialize", () => {
    it("should initialize contract correctly", async () => {
      expect(await dndStaking.sharesToken()).to.be.equal(await erc20.getAddress());
      expect(await dndStaking.rewardsToken()).to.be.equal(await erc20.getAddress());
      expect(await dndStaking.stakingStartTime()).to.be.equal(stakingStartTime);
      expect(await dndStaking.rate()).to.be.equal(rate);
    });
  });

  describe("claim()", () => {
    it("should calculate the rewards earned for a user correctly", async () => {
      await erc20.mint(TREASURY, wei(100));
      await erc20.connect(TREASURY).approve(dndStaking, wei(100));
      await dndStaking.connect(TREASURY).topUpRewards(wei(100));

      await erc20.mint(FIRST, wei(100));
      await erc20.connect(FIRST).approve(dndStaking, wei(100));

      await dndStaking.connect(FIRST).stake(wei(100));

      await time.setNextBlockTimestamp((await time.latest()) + 30);

      await dndStaking.connect(FIRST).unstake(wei(100));

      expect(await dndStaking.getOwedValue(FIRST)).to.equal(wei(30));
    });
  });
});
