import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Account } from "../data";
import { LoggerService } from "../logger/logger";
import { ModulesFasad } from "./modulesInit";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { convertToDecimals } from "../utils/checkToken";
import { USDC, relayTokensMap, chainIdsMap } from "../globals/globals";
import { ethers } from "ethers";
import {prepareLogInfo} from "../utils/actionLogMsg"
import { getRandomNumber, getRandomRelayNumber } from "../utils/math";

export class Relay implements ModulesFasad {
    private apiUrl: string;
    private logger: LoggerService;
    private rpcUrl: Map<string, string>;

    constructor(api: string, logger: LoggerService, rpcUrl: Map<string, string>) {
        if (!api) throw new Error("API URL (Relay API) не задан!");
        if (!rpcUrl) throw new Error("Мапа RPC's (Relay) не задана!");

        this.apiUrl = api; 
        this.logger = logger;
        this.rpcUrl = rpcUrl;
    }

    async Action(acc: Account, connection: Connection, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<string> {
        const msg = prepareLogInfo(acc.Address, inputMint, outputMint, amount);
        this.logger.info(msg);
        
        const quote = await this.getQuote(acc, inputMint, outputMint, amount);
        let finalSignature = ""; 

        for (const step of quote.steps) {
            if (step.kind === 'transaction') {
                try {
                   const signature =  await this.processTransactionStep(step, acc, connection);
                   finalSignature = signature;
                } catch (error) {
                    this.logger.error(`Error processing step ${step.id}`);
                    throw error;
                }
            }
        }

        return `Транзакция завершена: https://eclipsescan.xyz/tx/${finalSignature}`;
    }

    private async getQuote(acc: Account, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<any> {
        const reqData = this.prepareData(acc);
        
        try {
            const response = await axios.post(this.apiUrl, reqData, {
                httpsAgent: acc.Proxy ? new HttpsProxyAgent(acc.Proxy) : undefined,
                headers: {
                  "Content-Type": "application/json",
                  "Referer": "https://eclipse.underdogprotocol.com/collections/create"
                }
              });

            return response.data;
        } catch (error) {
            console.error("Error fetching transaction data:", error);
            throw error;
        }
    }

    private prepareData(acc: Account): object {
        if (!acc.BridgeConfig) {
            throw new Error("Bridge configuration is missing for this account.");
        }
    
        const { range, from, to, token, wallet } = acc.BridgeConfig;
    
        if (!from || !to || !wallet|| !range || range.length === 0 || token.length === 0) {
            throw new Error("Bridge configuration is incomplete.");
        }
    
        let bridgeAmount = range[0];
        if (range.length === 2) {
            bridgeAmount = getRandomRelayNumber(range[0], range[1]);
        }
        const inputChainId = chainIdsMap.get(from);
        const outputChainId = chainIdsMap.get(to);

        if (!inputChainId || !outputChainId) {
            throw new Error(`Invalid chainId: from=${from}, to=${to}`);
        }

        const inputCurrencyMap = relayTokensMap.get(from);
        if (!inputCurrencyMap) {
            throw new Error(`Invalid inputCurrency: ${from}`);
        }

        let tokenAddress = inputCurrencyMap.get(token[0]);  
        if (!tokenAddress) {
            throw new Error(`Invalid token address: ${token[0]}`);
        }

        if (inputChainId === 9286185) {
            tokenAddress = "11111111111111111111111111111111";
        }


        const outputCurrencyMap = relayTokensMap.get(to);
        if (!outputCurrencyMap) {
            throw new Error(`Invalid inputCurrency: ${to}`);
        }

        let destAddress = outputCurrencyMap.get(token[1] || token[0]);  
        if (!destAddress) {
            throw new Error(`Invalid token address: ${token[0]}`);
        }

        if (outputChainId === 9286185) {
            destAddress = "11111111111111111111111111111111";
        }

        const amount = convertToDecimals(tokenAddress, bridgeAmount);
        const userAddr = from === "eclipse" ? acc.Address : wallet
        const recepientAddr = to === "eclipse" ? acc.Address : wallet
 
        const req = {
            user: userAddr,
            originChainId: inputChainId,
            destinationChainId: outputChainId,
            originCurrency: tokenAddress,
            destinationCurrency: destAddress,
            recipient: recepientAddr,
            tradeType:"EXACT_INPUT",
            amount: amount.toString(),
            referrer:"relay.link/swap",
            useExternalLiquidity:false,
            useDepositAddress:false,
        }
        return req;
    }

    private async processTransactionStep(step: any, acc: Account, connection: Connection): Promise<string> {
        if (!step.items?.[0]?.data) {
            throw new Error("Invalid transaction step structure");
        }
        
        const txData = step.items[0].data;
        
        if (txData.instructions) {
            const transaction = new Transaction();
            for (const instr of txData.instructions) {
                const keys = instr.keys.map((k: any) => ({
                    pubkey: new PublicKey(k.pubkey),
                    isSigner: k.isSigner,
                    isWritable: k.isWritable
                }));
                transaction.add(new TransactionInstruction({
                    keys,
                    programId: new PublicKey(instr.programId),
                    data: Buffer.from(instr.data, 'hex')
                }));
            }
            
            transaction.feePayer = new PublicKey(acc.Address);
            const { blockhash } = await connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            
            transaction.sign(acc.Keypair);
            
            const serializedTx = transaction.serialize();
            const signature = await connection.sendRawTransaction(serializedTx);
            await connection.confirmTransaction(signature);
            return signature;
        } else {
            const network = acc.FromBridge;
            const rpcUrl = this.rpcUrl.get(network);
            if (!rpcUrl) {
                throw new Error(`No RPC URL found for network: ${network}`);
            }
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(acc.EvmPrivateKey, provider);
            
            const txRequest: ethers.TransactionRequest = {
                to: txData.to,
                value: txData.value ? BigInt(txData.value) : undefined,
                data: txData.data,
                gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
            };
    
            try {
                const txResponse = await wallet.sendTransaction(txRequest);
                await txResponse.wait();
                return txResponse.hash;
            } catch (error) {
                throw error;
            }
        }
    }
}