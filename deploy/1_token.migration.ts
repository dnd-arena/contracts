import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { ERC20Mock__factory, DNDArena__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  // const erc20 = await deployer.deploy(ERC20Mock__factory, ["Mock", "Mock", 18]);
  //
  // Reporter.reportContracts(["ERC20Mock", await erc20.getAddress()]);

  const DNDArena = await deployer.deploy(DNDArena__factory, [
    "0x356FB935990D6f3aD46651be9569bF6c42B3C14d",
    "5000000000000000000000",
  ]);

  Reporter.reportContracts(["DNDArena", await DNDArena.getAddress()]);
};
