import { Contract } from "ethers";
import hre from "hardhat";
import { Deployment, DeploymentsExtension } from "hardhat-deploy/dist/types";

interface Token {
  addr: string;
  exist: boolean;
  issueType: number;
  chainId: number;
}

const chainLink = {
  frankenstein: ["ropsten"],
  ropsten: ["frankenstein"],
};

const tokenLink = {
  frankenstein: {
    ropsten: [
      {
        name: "WETH",
        fromNameOrAddress: "BridgeTokenWETH",
        toNameOrAddress: "0x0000000000000000000000000000000000000000",
      },
      {
        name: "USDT",
        fromNameOrAddress: "BridgeTokenUSDT",
        toNameOrAddress: "0x110a13FC3efE6A245B50102D2d79B3E76125Ae83",
      },
      {
        name: "OLT",
        fromNameOrAddress: "0x0000000000000000000000000000000000000000",
        toNameOrAddress: "BridgeTokenOLT",
      },
    ],
  },
  ropsten: {
    frankenstein: [
      // {
      //   fromNameOrAddress: "0x0000000000000000000000000000000000000000",
      //   toNameOrAddress: "BridgeTokenWETH",
      // },
      // {
      //   fromNameOrAddress: "0x110a13FC3efE6A245B50102D2d79B3E76125Ae83",
      //   toNameOrAddress: "BridgeTokenUSDT",
      // },
      // {
      //   fromNameOrAddress: "BridgeTokenOLT",
      //   toNameOrAddress: "0x0000000000000000000000000000000000000000",
      // },
    ],
  },
};

const getBridgeToken = async (
  network: string,
  nameOrAddress: string
): Promise<Token | null> => {
  let chainId: string = await hre.getChainId();
  let deployments: DeploymentsExtension = hre.deployments;
  if (hre.network.name !== network) {
    deployments = hre.companionNetworks[network].deployments;
    chainId = await hre.companionNetworks[network].getChainId();
  }
  if (!hre.ethers.utils.isAddress(nameOrAddress)) {
    console.log(
      `Getting address for contract "${nameOrAddress}" and network "${network}"`
    );

    const contract: Deployment | null = await deployments.getOrNull(
      nameOrAddress
    );
    if (!contract) {
      console.log(
        `\x1b[33m ${nameOrAddress} deployment not found. skipping.\x1b[0m`
      );
      return null;
    }
    const bridgeToken: Contract | null = await hre.ethers.getContractAt(
      contract.abi,
      contract.address
    );
    if (!bridgeToken) {
      console.log(
        `\x1b[33m ${nameOrAddress} contract not found. skipping.\x1b[0m`
      );
      return null;
    }
    console.log(
      `Address for contract "${bridgeToken.address}" and network "${network}" has been loaded, continue`
    );
    return {
      addr: bridgeToken.address,
      exist: false,
      issueType: 1,
      chainId: chainId as unknown as number,
    };
  }
  console.log(
    `Address for contract "${nameOrAddress}" and network "${network}" has been loaded, continue`
  );
  return {
    addr: nameOrAddress,
    exist: false,
    issueType: 0,
    chainId: chainId as unknown as number,
  };
};

const checkOrCreate = async (
  bridgeTokenManager: Contract,
  enterToken: Token,
  exitToken: Token
) => {
  console.log(
    `Cheking addr in manager "${exitToken.addr}" for chain id "${exitToken.chainId}"`
  );
  const { ok }: { ok: boolean } = await bridgeTokenManager.fetch(
    exitToken.addr,
    exitToken.chainId
  );
  if (ok) {
    console.log("\x1b[33m Token already issued, skipping...\x1b[0m");
    return;
  }

  console.log(
    `\x1b[33m Starting to issue token for link "${enterToken.addr}" <-> "${exitToken.addr}" for network "${hre.network.name}"...\x1b[0m`
  );
  const receipt = await bridgeTokenManager
    .issue(
      [enterToken.addr, exitToken.addr],
      [enterToken.issueType, exitToken.issueType],
      [enterToken.chainId, exitToken.chainId]
    )
    .then((tx) => tx.wait());
  console.log(
    `\x1b[32m Link "${enterToken.addr}" <-> "${exitToken.addr}" created using ${receipt.gasUsed} gas\x1b[0m`
  );
};

(async () => {
  const { deployer } = await hre.getNamedAccounts();
  const signer = await hre.ethers.getSigner(deployer);
  const bridgeTokenManager: Contract | null =
    await hre.ethers.getContractOrNull("BridgeTokenManager", signer);

  if (!bridgeTokenManager) {
    console.log("\x1b[31m BridgeTokenManager not deployed, abort.\x1b[0m");
    return;
  }

  const enterNetwork = hre.network.name;

  if (!(enterNetwork in chainLink)) {
    console.log(`\x1b[31m Unsupported network: ${enterNetwork} abort.\x1b[0m`);
    return;
  }
  const extNetworks = chainLink[enterNetwork];

  for (let i = 0; i < extNetworks.length; i++) {
    const exitNetwork = extNetworks[i];
    const tokenList = tokenLink[enterNetwork][exitNetwork];
    console.group(`\x1b[36m[${enterNetwork} -> ${exitNetwork}]\x1b[0m`);
    for (let j = 0; j < tokenList.length; j++) {
      const token = tokenList[j];
      console.group(`\x1b[36m[token:${token.name}]\x1b[0m`);
      const [enterToken, exitToken] = await Promise.all([
        getBridgeToken(enterNetwork, token.fromNameOrAddress),
        getBridgeToken(exitNetwork, token.toNameOrAddress),
      ]);
      if (enterToken && exitToken) {
        await checkOrCreate(bridgeTokenManager, enterToken, exitToken);
      }
      console.groupEnd();
    }
    console.groupEnd();
  }
})();