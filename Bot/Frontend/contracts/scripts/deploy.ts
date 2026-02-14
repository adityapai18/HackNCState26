import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in contracts/.env (e.g. PRIVATE_KEY=0x...)."
    );
  }
  console.log("Deploying MockVault with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const MockVault = await ethers.getContractFactory("MockVault");
  const vault = await MockVault.deploy();
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("MockVault deployed to:", address);
  console.log("---");
  console.log("Export for frontend:");
  console.log("NEXT_PUBLIC_MOCK_VAULT_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
