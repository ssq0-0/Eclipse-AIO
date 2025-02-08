import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Account } from "../data/userAccount";
import { ModulesFasad } from "./modulesInit";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import { LoggerService } from "../logger/logger";


export class UnderDog implements ModulesFasad {
    private readonly apiUrl;
    private readonly photoApi;
    private readonly developerToken;
    private logger:LoggerService;

    constructor(api: string, token: string, photoApiLink: string, logger: LoggerService) {
        if (!api) throw new Error("API URL (Underdog API) не задан!");
        if (!token) throw new Error("Токен не задан!");
        if (!photoApiLink) throw new Error("Ссылка на Unsplash API не задана!");

        this.apiUrl = api;
        this.developerToken = token;
        this.photoApi = photoApiLink;
        this.logger = logger;
    } 

    async Action(acc: Account, connection: Connection, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<string> {
        this.logger.info(`[${acc.Address}] Underdog. Начало выполнения действия...`)
        const prepareData = await this.prepareData(acc);
        const txData = await this.getTxData(acc.Proxy, prepareData);

        const txBuffer = Buffer.from(txData.transaction, "base64");
    
        const transaction = VersionedTransaction.deserialize(txBuffer);
        
        transaction.sign([acc.Keypair]);
        
        const txSignature = await connection.sendTransaction(transaction);
        await connection.confirmTransaction(txSignature);
        
        return `Транзакция завершена: https://eclipsescan.xyz/tx/${txSignature}`;
    }

    private async prepareData(acc: Account): Promise<object> {
        const account = acc.Address;
        const dataSlice = await this.getRandomImageLink(acc);
        const link = await this.createCollectionLink(dataSlice[0]);
        
        const data = {
            account: account,
            name: dataSlice[0],
            image: dataSlice[1],
            description: dataSlice[0],
            externalUrl: link,
            soulbound: false
        };

        return data;
    }

    private async createCollectionLink(name: string): Promise<string> {
        return `https://${name}`;
    }

    private async getRandomImageLink(acc: Account): Promise<[string, string]> {
        try {
            const response = await axios.get(`${this.photoApi}${this.developerToken}`, {
                httpsAgent: acc.Proxy ? new HttpsProxyAgent(acc.Proxy) : undefined,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
    
            const data = response.data;
            let slug = data.slug.slice(1);  
            slug = slug.replace(/-/g, '');  
            slug = slug.slice(0, 20);    
            const rawUrl = data.urls.raw;
    
            return [slug, rawUrl];
        } catch (error) {
            console.error('Ошибка при получении ссылки на случайное изображение:', error);
            throw error;
        }
    }

    private async getTxData(proxy: string, data: any): Promise<any> {
        try {
            const response = await axios.post(this.apiUrl, data, {
                httpsAgent: new HttpsProxyAgent(proxy),
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
}