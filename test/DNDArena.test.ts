import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";

import { wei } from "@scripts";
import { Reverter } from "@test-helpers";

import { ERC20Mock, DNDArena } from "@ethers-v6";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DNDArena", () => {
  const reverter = new Reverter();

  const PRECISION = 10n ** 25n;
  const PERCENTAGE_100 = PRECISION * 100n;

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;

  let erc20: ERC20Mock;
  let dndArena: DNDArena;

  function applyPercentage(value: bigint, percentage: bigint = PRECISION): bigint {
    return (value * percentage) / PERCENTAGE_100;
  }

  before(async () => {
    [OWNER, FIRST, SECOND, THIRD] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    erc20 = await ERC20Mock.deploy("DND Arena Token", "DND", 18);

    const DNDArenaFactory = await ethers.getContractFactory("DNDArena");
    dndArena = await DNDArenaFactory.deploy(await erc20.getAddress(), wei(100));

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("constructor", () => {
    it("should set parameters correctly", async () => {
      expect(await dndArena.DNDToken()).to.be.equal(await erc20.getAddress());
      expect(await dndArena.minBid()).to.be.equal(wei(100));
      expect(await dndArena.currentArenaId()).to.be.equal(0);
    });
  });

  describe("setDNDToken", () => {
    it("should set DND token correctly", async () => {
      await dndArena.connect(OWNER).setDNDToken(FIRST);

      expect(await dndArena.DNDToken()).to.be.equal(FIRST.address);
    });

    it("should not allow to set zero address as DND token", async () => {
      await expect(dndArena.connect(OWNER).setDNDToken(ZeroAddress)).to.be.revertedWith(
        "DNDArena: zero address is not allowed",
      );
    });

    it("should not allow to set DND token if the caller is not the owner", async () => {
      await expect(dndArena.connect(FIRST).setDNDToken(SECOND))
        .to.be.revertedWithCustomError(dndArena, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("setMinBid", () => {
    it("should set min bid correctly", async () => {
      await dndArena.connect(OWNER).setMinBid(wei(10));

      expect(await dndArena.minBid()).to.be.equal(wei(10));
    });

    it("should not allow to set zero as min bid", async () => {
      await expect(dndArena.connect(OWNER).setMinBid(0)).to.be.revertedWith(
        "DNDArena: minimal bid amount must be above zero",
      );
    });

    it("should not allow to set treasury if the caller is not the owner", async () => {
      await expect(dndArena.connect(FIRST).setMinBid(wei(10)))
        .to.be.revertedWithCustomError(dndArena, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });

  describe("createArena", () => {
    it("should create arena correctly", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.connect(FIRST).approve(dndArena, wei(200));

      const tx = await dndArena.connect(FIRST).createArena(wei(150));

      await expect(tx).to.emit(dndArena, "ArenaCreated").withArgs(0, FIRST.address, wei(150));

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(150));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(50));

      const expectedArena = [FIRST.address, wei(150), ZeroAddress, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal(expectedArena);
      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([0n]);
      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([expectedArena]);
    });

    it("should create multiple arenas correctly", async () => {
      await erc20.mint(FIRST, wei(500));
      await erc20.mint(SECOND, wei(100));

      await erc20.connect(FIRST).approve(dndArena, wei(500));
      await erc20.connect(SECOND).approve(dndArena, wei(100));

      let tx = await dndArena.connect(FIRST).createArena(wei(120));
      await expect(tx).to.emit(dndArena, "ArenaCreated").withArgs(0, FIRST.address, wei(120));

      tx = await dndArena.connect(FIRST).createArena(wei(100));
      await expect(tx).to.emit(dndArena, "ArenaCreated").withArgs(1, FIRST.address, wei(100));

      tx = await dndArena.connect(SECOND).createArena(wei(100));
      await expect(tx).to.emit(dndArena, "ArenaCreated").withArgs(2, SECOND.address, wei(100));

      tx = await dndArena.connect(FIRST).createArena(wei(110));
      await expect(tx).to.emit(dndArena, "ArenaCreated").withArgs(3, FIRST.address, wei(110));

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(430));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(170));
      expect(await erc20.balanceOf(SECOND)).to.be.equal(0);

      const expectedArena0 = [FIRST.address, wei(120), ZeroAddress, 0n];
      const expectedArena1 = [FIRST.address, wei(100), ZeroAddress, 0n];
      const expectedArena2 = [SECOND.address, wei(100), ZeroAddress, 0n];
      const expectedArena3 = [FIRST.address, wei(110), ZeroAddress, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal(expectedArena0);
      expect(await dndArena.arenas(1)).to.be.deep.equal(expectedArena1);
      expect(await dndArena.arenas(2)).to.be.deep.equal(expectedArena2);
      expect(await dndArena.arenas(3)).to.be.deep.equal(expectedArena3);

      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([0n, 1n, 3n]);
      expect(await dndArena.getUserArenaIds(SECOND)).to.be.deep.equal([2n]);

      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([expectedArena0, expectedArena1, expectedArena3]);
      expect(await dndArena.getUserArenas(SECOND)).to.be.deep.equal([expectedArena2]);
    });

    it("should not create arena if the bid is too small", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.connect(FIRST).approve(dndArena, wei(200));

      await expect(dndArena.connect(FIRST).createArena(wei(90))).to.be.revertedWith(
        "DNDArena: bid is below the minimal bid",
      );
    });

    it("should not create arena in case of insufficient balance", async () => {
      await expect(dndArena.connect(FIRST).createArena(wei(120)))
        .to.be.revertedWithCustomError(erc20, "ERC20InsufficientAllowance")
        .withArgs(await dndArena.getAddress(), 0, wei(120));
    });
  });

  describe("acceptArena", () => {
    it("should accept arena correctly", async () => {
      await erc20.mint(FIRST, wei(160));
      await erc20.mint(SECOND, wei(200));

      await erc20.connect(FIRST).approve(dndArena, wei(160));
      await erc20.connect(SECOND).approve(dndArena, wei(200));

      await dndArena.connect(FIRST).createArena(wei(160));

      const tx = await dndArena.connect(SECOND).acceptArena(0);

      await expect(tx).to.emit(dndArena, "ArenaAccepted").withArgs(0, SECOND.address);

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(320));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(0);
      expect(await erc20.balanceOf(SECOND)).to.be.equal(wei(40));

      const expectedArena = [FIRST.address, wei(160), SECOND.address, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal(expectedArena);

      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([0n]);
      expect(await dndArena.getUserArenaIds(SECOND)).to.be.deep.equal([0n]);

      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([expectedArena]);
      expect(await dndArena.getUserArenas(SECOND)).to.be.deep.equal([expectedArena]);
    });

    it("should accept multiple arenas correctly", async () => {
      await erc20.mint(FIRST, wei(500));
      await erc20.mint(SECOND, wei(600));
      await erc20.mint(THIRD, wei(400));

      await erc20.connect(FIRST).approve(dndArena, wei(500));
      await erc20.connect(SECOND).approve(dndArena, wei(600));
      await erc20.connect(THIRD).approve(dndArena, wei(400));

      await dndArena.connect(FIRST).createArena(wei(120));
      await dndArena.connect(THIRD).createArena(wei(100));
      await dndArena.connect(FIRST).createArena(wei(120));
      await dndArena.connect(SECOND).createArena(wei(110));

      let tx = await dndArena.connect(SECOND).acceptArena(2);
      await expect(tx).to.emit(dndArena, "ArenaAccepted").withArgs(2, SECOND.address);

      tx = await dndArena.connect(SECOND).acceptArena(1);
      await expect(tx).to.emit(dndArena, "ArenaAccepted").withArgs(1, SECOND.address);

      tx = await dndArena.connect(THIRD).acceptArena(0);
      await expect(tx).to.emit(dndArena, "ArenaAccepted").withArgs(0, THIRD.address);

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(790));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(260));
      expect(await erc20.balanceOf(SECOND)).to.be.equal(wei(270));
      expect(await erc20.balanceOf(THIRD)).to.be.equal(wei(180));

      const expectedArena0 = [FIRST.address, wei(120), THIRD.address, 0n];
      const expectedArena1 = [THIRD.address, wei(100), SECOND.address, 0n];
      const expectedArena2 = [FIRST.address, wei(120), SECOND.address, 0n];
      const expectedArena3 = [SECOND.address, wei(110), ZeroAddress, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal(expectedArena0);
      expect(await dndArena.arenas(1)).to.be.deep.equal(expectedArena1);
      expect(await dndArena.arenas(2)).to.be.deep.equal(expectedArena2);
      expect(await dndArena.arenas(3)).to.be.deep.equal(expectedArena3);

      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([0n, 2n]);
      expect(await dndArena.getUserArenaIds(SECOND)).to.be.deep.equal([3n, 2n, 1n]);
      expect(await dndArena.getUserArenaIds(THIRD)).to.be.deep.equal([1n, 0n]);

      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([expectedArena0, expectedArena2]);
      expect(await dndArena.getUserArenas(SECOND)).to.be.deep.equal([expectedArena3, expectedArena2, expectedArena1]);
      expect(await dndArena.getUserArenas(THIRD)).to.be.deep.equal([expectedArena1, expectedArena0]);
    });

    it("should not allow to accept arena that doesn't exist", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.connect(FIRST).approve(dndArena, wei(200));

      await expect(dndArena.connect(FIRST).acceptArena(0)).to.be.revertedWith("DNDArena: arena doesn't exist");

      await expect(dndArena.connect(FIRST).acceptArena(1)).to.be.revertedWith("DNDArena: arena doesn't exist");
    });

    it("should not allow to accept your own arena", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.connect(FIRST).approve(dndArena, wei(200));

      await dndArena.connect(FIRST).createArena(wei(160));

      await expect(dndArena.connect(FIRST).acceptArena(0)).to.be.revertedWith(
        "DNDArena: you cannot accept your own arena",
      );
    });

    it("should not allow to accept arena that was already accepted", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.mint(SECOND, wei(200));

      await erc20.connect(FIRST).approve(dndArena, wei(200));
      await erc20.connect(SECOND).approve(dndArena, wei(200));

      await dndArena.connect(FIRST).createArena(wei(200));

      await dndArena.connect(SECOND).acceptArena(0);

      await expect(dndArena.connect(THIRD).acceptArena(0)).to.be.revertedWith("DNDArena: arena already accepted");
    });

    it("should not accept arena in case of insufficient balance", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.connect(FIRST).approve(dndArena, wei(200));

      await dndArena.connect(FIRST).createArena(wei(160));

      await expect(dndArena.connect(SECOND).acceptArena(0))
        .to.be.revertedWithCustomError(erc20, "ERC20InsufficientAllowance")
        .withArgs(await dndArena.getAddress(), 0, wei(160));
    });
  });

  describe("cancelArena", () => {
    it("should cancel arena correctly", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(200));

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(200));

      await dndArena.connect(FIRST).createArena(wei(180));
      await dndArena.connect(SECOND).createArena(wei(150));
      await dndArena.connect(FIRST).createArena(wei(100));

      const tx = await dndArena.connect(FIRST).cancelArena(0);

      await expect(tx).to.emit(dndArena, "ArenaCanceled").withArgs(0);

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(250));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(200));
      expect(await erc20.balanceOf(SECOND)).to.be.equal(wei(50));

      const expectedArena1 = [SECOND.address, wei(150), ZeroAddress, 0n];
      const expectedArena2 = [FIRST.address, wei(100), ZeroAddress, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal([ZeroAddress, 0n, ZeroAddress, 0n]);
      expect(await dndArena.arenas(1)).to.be.deep.equal(expectedArena1);
      expect(await dndArena.arenas(2)).to.be.deep.equal(expectedArena2);

      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([2n]);
      expect(await dndArena.getUserArenaIds(SECOND)).to.be.deep.equal([1n]);

      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([expectedArena2]);
      expect(await dndArena.getUserArenas(SECOND)).to.be.deep.equal([expectedArena1]);
    });

    it("should cancel multiple arenas correctly", async () => {
      await erc20.mint(FIRST, wei(350));
      await erc20.mint(SECOND, wei(450));

      await erc20.connect(FIRST).approve(dndArena, wei(350));
      await erc20.connect(SECOND).approve(dndArena, wei(450));

      await dndArena.connect(FIRST).createArena(wei(180));
      await dndArena.connect(SECOND).createArena(wei(150));
      await dndArena.connect(FIRST).createArena(wei(100));
      await dndArena.connect(SECOND).createArena(wei(100));
      await dndArena.connect(SECOND).createArena(wei(100));

      let tx = await dndArena.connect(SECOND).cancelArena(3);
      await expect(tx).to.emit(dndArena, "ArenaCanceled").withArgs(3);

      tx = await dndArena.connect(FIRST).cancelArena(2);
      await expect(tx).to.emit(dndArena, "ArenaCanceled").withArgs(2);

      tx = await dndArena.connect(FIRST).cancelArena(0);
      await expect(tx).to.emit(dndArena, "ArenaCanceled").withArgs(0);

      tx = await dndArena.connect(SECOND).cancelArena(4);
      await expect(tx).to.emit(dndArena, "ArenaCanceled").withArgs(4);

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(150));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(350));
      expect(await erc20.balanceOf(SECOND)).to.be.equal(wei(300));

      const expectedArena1 = [SECOND.address, wei(150), ZeroAddress, 0n];
      const zeroArena = [ZeroAddress, 0n, ZeroAddress, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal(zeroArena);
      expect(await dndArena.arenas(1)).to.be.deep.equal(expectedArena1);
      expect(await dndArena.arenas(2)).to.be.deep.equal(zeroArena);
      expect(await dndArena.arenas(3)).to.be.deep.equal(zeroArena);
      expect(await dndArena.arenas(4)).to.be.deep.equal(zeroArena);

      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([]);
      expect(await dndArena.getUserArenaIds(SECOND)).to.be.deep.equal([1n]);

      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([]);
      expect(await dndArena.getUserArenas(SECOND)).to.be.deep.equal([expectedArena1]);
    });

    it("should not allow to cancel arena that doesn't exist", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.connect(FIRST).approve(dndArena, wei(300));

      await expect(dndArena.connect(FIRST).cancelArena(0)).to.be.revertedWith(
        "DNDArena: you are not the creator of the arena",
      );
      await expect(dndArena.connect(FIRST).cancelArena(2)).to.be.revertedWith(
        "DNDArena: you are not the creator of the arena",
      );
    });

    it("should not allow to cancel arena if the caller is not the arena creator", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(300));

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(300));

      await dndArena.connect(SECOND).createArena(wei(140));

      await expect(dndArena.connect(FIRST).cancelArena(0)).to.be.revertedWith(
        "DNDArena: you are not the creator of the arena",
      );
    });

    it("should not allow to cancel arena if arena has already been accepted", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(300));

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(300));

      await dndArena.connect(SECOND).createArena(wei(140));

      await dndArena.connect(FIRST).acceptArena(0);

      await expect(dndArena.connect(SECOND).cancelArena(0)).to.be.revertedWith("DNDArena: arena has been accepted");
    });
  });

  describe("setWinner", () => {
    it("should set winner correctly", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(300));
      await erc20.mint(THIRD, wei(300));

      const initialTotalSupply = await erc20.totalSupply();

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(300));
      await erc20.connect(THIRD).approve(dndArena, wei(300));

      await dndArena.connect(FIRST).createArena(wei(150));
      await dndArena.connect(FIRST).createArena(wei(100));
      await dndArena.connect(SECOND).createArena(wei(100));

      await dndArena.connect(SECOND).acceptArena(1);
      await dndArena.connect(THIRD).acceptArena(0);
      await dndArena.connect(THIRD).acceptArena(2);

      let tx = await dndArena.connect(OWNER).setWinner(0, THIRD.address);
      await expect(tx).to.emit(dndArena, "WinnerSet").withArgs(0, THIRD.address);

      tx = await dndArena.connect(OWNER).setWinner(1, FIRST.address);
      await expect(tx).to.emit(dndArena, "WinnerSet").withArgs(1, FIRST.address);

      expect(await erc20.balanceOf(dndArena)).to.be.equal(wei(200));
      expect(await erc20.balanceOf(FIRST)).to.be.equal(wei(50) + applyPercentage(wei(200), 99n * PRECISION));
      expect(await erc20.balanceOf(SECOND)).to.be.equal(wei(100));
      expect(await erc20.balanceOf(THIRD)).to.be.equal(wei(50) + applyPercentage(wei(300), 99n * PRECISION));

      expect(await erc20.totalSupply()).to.be.equal(initialTotalSupply - applyPercentage(wei(500)));

      const expectedArena0 = [FIRST.address, wei(150), THIRD.address, 2n];
      const expectedArena1 = [FIRST.address, wei(100), SECOND.address, 1n];
      const expectedArena2 = [SECOND.address, wei(100), THIRD.address, 0n];

      expect(await dndArena.arenas(0)).to.be.deep.equal(expectedArena0);
      expect(await dndArena.arenas(1)).to.be.deep.equal(expectedArena1);
      expect(await dndArena.arenas(2)).to.be.deep.equal(expectedArena2);

      expect(await dndArena.getUserArenaIds(FIRST)).to.be.deep.equal([0n, 1n]);
      expect(await dndArena.getUserArenaIds(SECOND)).to.be.deep.equal([2n, 1n]);
      expect(await dndArena.getUserArenaIds(THIRD)).to.be.deep.equal([0n, 2n]);

      expect(await dndArena.getUserArenas(FIRST)).to.be.deep.equal([expectedArena0, expectedArena1]);
      expect(await dndArena.getUserArenas(SECOND)).to.be.deep.equal([expectedArena2, expectedArena1]);
      expect(await dndArena.getUserArenas(THIRD)).to.be.deep.equal([expectedArena0, expectedArena2]);
    });

    it("should burn tokens correctly", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(300));

      const initialTotalSupply = await erc20.totalSupply();

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(300));

      await dndArena.connect(FIRST).createArena(wei(200));
      await dndArena.connect(SECOND).acceptArena(0);
      await dndArena.connect(OWNER).setWinner(0, SECOND.address);

      expect(await erc20.totalSupply()).to.be.equal(initialTotalSupply - wei(4));
    });

    it("should not allow to set winner if the caller is not the owner", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(300));

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(300));

      await dndArena.connect(SECOND).createArena(wei(100));
      await dndArena.connect(FIRST).acceptArena(0);

      await expect(dndArena.connect(SECOND).setWinner(0, SECOND))
        .to.be.revertedWithCustomError(dndArena, "OwnableUnauthorizedAccount")
        .withArgs(SECOND.address);
    });

    it("should not allow to set winner if arena doesn't exist", async () => {
      await expect(dndArena.connect(OWNER).setWinner(0, FIRST)).to.be.revertedWith(
        "DNDArena: arena has not been accepted yet",
      );
    });

    it("should not allow to set winner if arena has not been accepted yes", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.connect(FIRST).approve(dndArena, wei(300));

      await dndArena.connect(FIRST).createArena(wei(300));

      await expect(dndArena.connect(OWNER).setWinner(0, FIRST)).to.be.revertedWith(
        "DNDArena: arena has not been accepted yet",
      );
    });

    it("should not allow to set winner if the winner is already set", async () => {
      await erc20.mint(FIRST, wei(200));
      await erc20.mint(SECOND, wei(300));

      await erc20.connect(FIRST).approve(dndArena, wei(200));
      await erc20.connect(SECOND).approve(dndArena, wei(300));

      await dndArena.connect(SECOND).createArena(wei(100));
      await dndArena.connect(FIRST).acceptArena(0);

      await dndArena.connect(OWNER).setWinner(0, SECOND);

      await expect(dndArena.connect(OWNER).setWinner(0, FIRST)).to.be.revertedWith("DNDArena: winner is already set");
    });

    it("should not allow to set winner if invalid winner address is provided", async () => {
      await erc20.mint(FIRST, wei(300));
      await erc20.mint(SECOND, wei(250));

      await erc20.connect(FIRST).approve(dndArena, wei(300));
      await erc20.connect(SECOND).approve(dndArena, wei(250));

      await dndArena.connect(SECOND).createArena(wei(200));
      await dndArena.connect(FIRST).acceptArena(0);

      await expect(dndArena.connect(OWNER).setWinner(0, THIRD)).to.be.revertedWith("DNDArena: invalid winner address");
    });
  });

  describe("pause & unpause", () => {
    it("should pause and unpause the contract correctly", async () => {
      await dndArena.connect(OWNER).pause();

      await expect(dndArena.connect(FIRST).createArena(wei(190))).to.be.revertedWithCustomError(
        dndArena,
        "EnforcedPause",
      );
      await expect(dndArena.connect(FIRST).acceptArena(0)).to.be.revertedWithCustomError(dndArena, "EnforcedPause");
      await expect(dndArena.connect(FIRST).cancelArena(0)).to.be.revertedWithCustomError(dndArena, "EnforcedPause");
      await expect(dndArena.connect(OWNER).setWinner(0, SECOND)).to.be.revertedWithCustomError(
        dndArena,
        "EnforcedPause",
      );

      await dndArena.connect(OWNER).unpause();

      await erc20.mint(FIRST, wei(200));
      await erc20.connect(FIRST).approve(dndArena, wei(200));

      const tx = await dndArena.connect(FIRST).createArena(wei(180));
      await expect(tx).to.emit(dndArena, "ArenaCreated").withArgs(0, FIRST.address, wei(180));
    });

    it("should not allow to pause and unpause the contract if the caller is not the owner", async () => {
      await expect(dndArena.connect(FIRST).pause())
        .to.be.revertedWithCustomError(dndArena, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);

      await expect(dndArena.connect(FIRST).unpause())
        .to.be.revertedWithCustomError(dndArena, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);
    });
  });
});
