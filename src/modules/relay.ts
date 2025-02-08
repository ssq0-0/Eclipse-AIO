import { Connection, PublicKey } from "@solana/web3.js";
import { Account } from "../data";
import { LoggerService } from "../logger/logger";
import { ModulesFasad } from "./modulesInit";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { convertToDecimals } from "../utils/checkToken";
import { USDC, relayTokensMap, chainIdsMap } from "../globals/globals";
import { ethers } from "ethers";
import {prepareLogInfo} from "../utils/actionLogMsg"

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
                   const signature =  await this.processTransactionStep(step, acc);
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
        const reqData = this.prepareData(acc, inputMint, outputMint, amount);
        
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

    private prepareData(acc: Account, inputMint: PublicKey, outputMint: PublicKey, amount: number): object {
        const inputChainId = chainIdsMap.get(acc.FromBridge);
        if (!inputChainId) {
            throw new Error(`Invalid chainId or fromChain: ${acc.FromBridge}`);
        }

        const outputChainId = 9286185;

        const inputCurrencyMap = relayTokensMap.get(acc.FromBridge);
        if (!inputCurrencyMap) {
            throw new Error(`Invalid inputCurrency: ${acc.TokenBridge}`);
        }
        const tokenAddress = inputCurrencyMap.get(acc.TokenBridge);
        if (!tokenAddress) {
            throw new Error(`Invalid token: ${acc.FromBridge}`);
        }

        const destCurrency = "11111111111111111111111111111111";
        const convertedAmount = convertToDecimals(USDC, acc.BridgeAmount);

        const req = {
            user: acc.EvmAddress,
            originChainId: inputChainId,
            destinationChainId: outputChainId,
            originCurrency: tokenAddress,
            destinationCurrency:destCurrency,
            recipient: acc.Address,
            tradeType:"EXACT_INPUT",
            amount: convertedAmount.toString(),
            referrer:"relay.link/swap",
            useExternalLiquidity:false,
            useDepositAddress:false,
        }
        return req;
    }

    private async processTransactionStep(step: any, acc: Account): Promise<string> {
        if (!step.items?.[0]?.data) {
            throw new Error("Invalid transaction step structure");
        }

        const network = acc.FromBridge;
        const rpcUrl = this.rpcUrl.get(network);
        if (!rpcUrl) {
            throw new Error(`No RPC URL found for network: ${network}`);
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(acc.EvmPrivateKey, provider);
        
        const txData = step.items[0].data;
        const txRequest: ethers.TransactionRequest = {
            to: txData.to,
            value: txData.value ? BigInt(txData.value) : undefined,
            data: txData.data,
            gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
        };

        try {
            const txResponse = await wallet.sendTransaction(txRequest);
            await txResponse.wait();

            await new Promise(resolve => setTimeout(resolve, 10_000));
            return txResponse.hash; 
        } catch (error) {
            throw error;
        }
    }
}