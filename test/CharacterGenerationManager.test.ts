import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@test-helpers";
import { PERCENTAGE_100, PRECISION, wei } from "@scripts";
import { ZeroAddress } from "ethers";
import { ERC20Mock, CharacterGenerationManager } from "@ethers-v6";

describe("CharacterGenerationManager", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let TREASURY: SignerWithAddress;
  let STAKING: SignerWithAddress;

  let erc20: ERC20Mock;
  let characterGenerationManager: CharacterGenerationManager;

  before(async () => {
    [OWNER, FIRST, TREASURY, STAKING] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    erc20 = await ERC20Mock.deploy("DND Arena Token", "DND", 18);

    const CharacterGenerationManagerFactory = await ethers.getContractFactory("CharacterGenerationManager");
    characterGenerationManager = await CharacterGenerationManagerFactory.deploy(
      await erc20.getAddress(),
      TREASURY.address,
      STAKING.address,
      20n * PRECISION,
      wei(100),
    );

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("constructor", () => {
    it("should set parameters correctly", async () => {
      expect(await characterGenerationManager.DNDToken()).to.be.equal(await erc20.getAddress());
      expect(await characterGenerationManager.treasury()).to.be.equal(TREASURY.address);
      expect(await characterGenerationManager.stakingContract()).to.be.equal(STAKING.address);
      expect(await characterGenerationManager.stakingPercentage()).to.be.equal(20n * PRECISION);
      expect(await characterGenerationManager.generationPrice()).to.be.equal(wei(100));
    });
  });

  describe("setDNDToken", () => {
    it("should set DND token correctly", async () => {
      await characterGenerationManager.connect(OWNER).setDNDToken(FIRST);

      expect(await characterGenerationManager.DNDToken()).to.be.equal(FIRST.address);
    });

    it("should not allow to set zero address as DND token", async () => {
      await expect(characterGenerationManager.connect(OWNER).setDNDToken(ZeroAddress)).to.be.revertedWith(
        "CharacterGenerationManager: zero address is not allowed",
      );
    });

    it("should not allow to set DND token if the caller is not the owner", async () => {
      await expect(characterGenerationManager.connect(FIRST).setDNDToken(TREASURY))
        .to.be.revertedWithCustomError(characterGenerationManager, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("setTreasury", () => {
    it("should set treasury correctly", async () => {
      await characterGenerationManager.connect(OWNER).setTreasury(FIRST);

      expect(await characterGenerationManager.treasury()).to.be.equal(FIRST.address);
    });

    it("should not allow to set zero address as treasury", async () => {
      await expect(characterGenerationManager.connect(OWNER).setTreasury(ZeroAddress)).to.be.revertedWith(
        "CharacterGenerationManager: zero address is not allowed",
      );
    });

    it("should not allow to set treasury if the caller is not the owner", async () => {
      await expect(characterGenerationManager.connect(FIRST).setTreasury(OWNER))
        .to.be.revertedWithCustomError(characterGenerationManager, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("setStakingContract", () => {
    it("should set staking contract correctly", async () => {
      await characterGenerationManager.connect(OWNER).setStakingContract(FIRST);

      expect(await characterGenerationManager.stakingContract()).to.be.equal(FIRST.address);
    });

    it("should not allow to set zero address as staking contract", async () => {
      await expect(characterGenerationManager.connect(OWNER).setStakingContract(ZeroAddress)).to.be.revertedWith(
        "CharacterGenerationManager: zero address is not allowed",
      );
    });

    it("should not allow to set staking contract if the caller is not the owner", async () => {
      await expect(characterGenerationManager.connect(FIRST).setStakingContract(OWNER))
        .to.be.revertedWithCustomError(characterGenerationManager, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("setStakingPercentage", () => {
    it("should set staking percentage correctly", async () => {
      await characterGenerationManager.connect(OWNER).setStakingPercentage(10n * PRECISION);
      expect(await characterGenerationManager.stakingPercentage()).to.be.equal(10n * PRECISION);

      await characterGenerationManager.connect(OWNER).setStakingPercentage(0);
      expect(await characterGenerationManager.stakingPercentage()).to.be.equal(0);
    });

    it("should not allow to set staking percentage if the caller is not the owner", async () => {
      await expect(characterGenerationManager.connect(FIRST).setStakingPercentage(25n * PRECISION))
        .to.be.revertedWithCustomError(characterGenerationManager, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("setGenerationPrice", () => {
    it("should set generation price correctly", async () => {
      await characterGenerationManager.connect(OWNER).setGenerationPrice(wei(50));

      expect(await characterGenerationManager.generationPrice()).to.be.equal(wei(50));
    });

    it("should not allow to set 0 as a generation price", async () => {
      await expect(characterGenerationManager.connect(OWNER).setGenerationPrice(0)).to.be.revertedWith(
        "CharacterGenerationManager: character generation price should be above 0",
      );
    });

    it("should not allow to set generation price if the caller is not the owner", async () => {
      await expect(characterGenerationManager.connect(FIRST).setGenerationPrice(wei(1000)))
        .to.be.revertedWithCustomError(characterGenerationManager, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("requestCharacterGeneration", () => {
    it("should transfer token and request character generation correctly", async () => {
      await erc20.connect(OWNER).mint(FIRST, wei(150));

      await erc20.connect(FIRST).approve(characterGenerationManager, wei(100));

      const tx = await characterGenerationManager.connect(FIRST).requestCharacterGeneration();

      await expect(tx).to.emit(characterGenerationManager, "CharacterGenerationRequested").withArgs(FIRST);

      const stakingAmount = (wei(100) * 20n * PRECISION) / PERCENTAGE_100;

      expect(await erc20.balanceOf(TREASURY)).to.be.equal(wei(100) - stakingAmount);
      expect(await erc20.balanceOf(STAKING)).to.be.equal(stakingAmount);
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(50));
    });

    it("should not allow to request character generation if case of caller insufficient balance", async () => {
      const stakingAmount = (wei(100) * 20n * PRECISION) / PERCENTAGE_100;

      await expect(characterGenerationManager.connect(FIRST).requestCharacterGeneration())
        .to.be.revertedWithCustomError(erc20, "ERC20InsufficientAllowance")
        .withArgs(await characterGenerationManager.getAddress(), 0, stakingAmount);

      await erc20.connect(OWNER).mint(FIRST, wei(90));
      await erc20.connect(FIRST).approve(characterGenerationManager, wei(90));

      await expect(characterGenerationManager.connect(FIRST).requestCharacterGeneration())
        .to.be.revertedWithCustomError(erc20, "ERC20InsufficientAllowance")
        .withArgs(await characterGenerationManager.getAddress(), wei(90) - stakingAmount, wei(100) - stakingAmount);
    });
  });
});
