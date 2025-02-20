import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { Wallet as EvmWallet } from "ethers";
import {SwapPair, WalletConfigFile} from "../globals/types";

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
    BridgeAmount: number,
    MinEthSwap: number;
    MaxEthSwap: number;
    MinStableSwap: number;
    MaxStableSwap: number;
    MinSolSwap: number;
    MaxSolSwap: number;
    FromBridge: string;
    TokenBridge: string;
}

export async function AccountFactory(
    solKks: string[], 
    evmPks: string[], 
    proxies: string[], 
    walletConfig: WalletConfigFile, 
    config: any
    ): Promise<Account[]> {
    if (solKks.length == 0) {
        throw new Error("Private keys map is empty.")
    }
    // if (walletConfig === null) {
    //     throw Error("Файл с историей кошелька не был найден. Создайте пустой wallet_config.json и запустите.")
    // }

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
                FromBridge: config.from_bridge ?? "",
                TokenBridge: config.token_bridge ?? "",
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

function getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}