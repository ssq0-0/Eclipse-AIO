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
