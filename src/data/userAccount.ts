import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { Wallet as EvmWallet } from "ethers";
import {BridgeConfiguration, SwapPair, WalletBridge, WalletConfigFile} from "../globals/types";
import {getRandomNumber} from "../utils/math";

export type Account = {
    EvmAddress: string;
    EvmPrivateKey: string;
    Address: string;
    Keypair: Keypair;
    PubKey: PublicKey;
    Proxy: string;
    ActionCount: number;
    ActionTime: number;
    LastSwaps: SwapPair[];
    MinEthSwap: number;
    MaxEthSwap: number;
    MinStableSwap: number;
    MaxStableSwap: number;
    MinSolSwap: number;
    MaxSolSwap: number;
    BridgeConfig: WalletBridge | null;
}

export async function AccountFactory(
    solKks: string[], 
    evmPks: string[], 
    proxies: string[], 
    bridgeConfig: BridgeConfiguration,
    config: any
    ): Promise<Account[]> {
    if (solKks.length == 0) {
        throw new Error("Private keys map is empty.")
    }

    const accoutnPromises = solKks.map(async(pk, index)=>{
        try {
            const secretKey = bs58.decode(pk);
            const keypair = Keypair.fromSecretKey(secretKey);
            const pubkey = keypair.publicKey;

            let evmAddress = "";
            let evmPrivateKey = "";
            if (evmPks && evmPks.length > 0) {
              const evmKey = evmPks[index % evmPks.length];
              try {
                const evmWallet = new EvmWallet(evmKey);
                evmAddress = evmWallet.address;
                evmPrivateKey = evmWallet.privateKey;
              } catch (evmError) {
                    console.error(`Ошибка инициализации EVM кошелька для аккаунта с индексом ${index}:`, evmError);
                    // Можно задать значение по умолчанию или оставить пустую строку
                }
            }
            const configForAccount = bridgeConfig[evmAddress] || bridgeConfig[pubkey.toString()] || null;

            return {
                EvmAddress: evmAddress,
                EvmPrivateKey:evmPrivateKey,
                Address:keypair.publicKey.toBase58(),
                Keypair:keypair,
                PubKey:pubkey,
                Proxy: proxies[index % proxies.length],
                ActionCount: getRandomNumber(config.min_action_count, config.max_action_count),
                ActionTime: getRandomNumber(config.min_time_work, config.max_time_work),
                LastSwaps: [],
                BridgeAmount: getRandomNumber(config.min_bridge, config.max_bridge),
                MinEthSwap: config.min_eth_swap || 0.0001, 
                MaxEthSwap: config.max_eth_swap || 0.001,
                MinStableSwap: config.min_stable_swap || 0.1,
                MaxStableSwap: config.max_stable_swap || 10,
                MinSolSwap: config.min_sol_swap || 0.001,
                MaxSolSwap: config.max_sol_swap || 0.01,
                BridgeConfig: configForAccount,
            } as Account;
        } catch(error){
            console.log("failed parse accs in factory");
            return null;
        }
    })    

    return Promise.all(accoutnPromises).then((accounts) =>
    accounts.filter((account): account is Account => account !== null) 
  );
}
