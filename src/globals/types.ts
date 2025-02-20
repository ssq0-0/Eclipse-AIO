import { PublicKey } from "@solana/web3.js";

export interface BalanceCheckResult {
    sufficient: boolean;
    balance?: number;
}

export type ActionProcess = {
    TokenFrom: PublicKey;
    TokenTo: PublicKey;
    Amount: number;
    TypeAction: string;
    Module: string;
    Error?: string;
}

export type SwapPair = {
    TokenFrom: PublicKey;  
    TokenTo: PublicKey;    
    Forced: boolean;    
};

export interface WalletConfig {
    sol_private_key:string;
    sol_address: string;
    proxy: string;
    tap_wallet: string;
    tap_private_key: number[];
    discord_name: number | string;
    twitter_name: string;
    jwt: string;
}

export interface WalletConfigFile {
    [key: string]: WalletConfig;
}