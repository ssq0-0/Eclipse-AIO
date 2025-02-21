import { Connection, Transaction, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { Account } from "../data/userAccount";
import axios from 'axios';
import { ModulesFasad } from './modulesInit';
import { LoggerService } from '../logger/logger';
import { checkNativeToken } from '../utils/checkToken';
import { convertToDecimals } from '../utils/checkToken';
import { prepareLogInfo } from "../utils/actionLogMsg";

export class Solar implements ModulesFasad {
  private readonly apiUrl: string;
  private readonly slippageBps: number;
  private readonly typeTx: string;
  private logger: LoggerService;

  constructor(apiUrl: string, slippage: number, typeTx: string, logger: LoggerService) {
    if (!apiUrl) throw new Error("API URL (Solar API) не задан!");

    this.apiUrl = apiUrl;
    this.slippageBps = slippage;
    this.typeTx = typeTx;
    this.logger = logger;
  }

  async Action(acc: Account, connection: Connection, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<string> {
    const msg = prepareLogInfo(acc.Address, inputMint, outputMint, amount);
    this.logger.info(msg);

    try {
      const wrap = checkNativeToken(new PublicKey(inputMint));
      const unwrap = checkNativeToken(new PublicKey(outputMint));
      const quote = await this.getSwapQuote(inputMint.toString(), outputMint.toString(), amount);

      const txData = await this.prepareTransactions(acc.Address, quote, wrap, unwrap, connection);

      let txId: string = "";
      for (const tx of txData) {
        txId = await this.signAndSendTransaction(connection, tx, acc.Keypair);
        await this.confirmTransaction(connection, txId);
      }

      return `https://eclipsescan.xyz/tx/${txId}`;
    } catch (error) {
      return `Solar swap was be failes. Reason: ${error}.`
    }
  }

  private async getSwapQuote(inputMint: string, outputMint: string, amount: number): Promise<any> {
    const url = `${this.apiUrl}/compute/swap-base-in`;
    const converted = convertToDecimals(inputMint, amount);
    const params = {
      inputMint,
      outputMint,
      amount: converted.toString(),
      slippageBps: this.slippageBps,
      txVersion: this.typeTx
    };

    try {
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get swap quote: ${error}`);
    }
  }

  private async prepareTransactions(walletAddress: string, quote: any, wrap: boolean, unwrap: boolean, connection: Connection): Promise<Transaction[]> {
    const url = `${this.apiUrl}/transaction/swap-base-in`;

    const requestBody = {
      computeUnitPriceMicroLamports: "100000",
      swapResponse: {
        id: quote.id,
        success: quote.success,
        version: this.typeTx,
        data: quote.data
      },
      txVersion: this.typeTx,
      wallet: walletAddress,
      wrapSol: wrap,
      unwrapSol: unwrap
    };

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.data?.data || !Array.isArray(response.data.data)) {
        throw new Error("Invalid transaction data format");
      }

      const transactions = response.data.data.map((tx: { transaction: string }) =>
        Transaction.from(Buffer.from(tx.transaction, 'base64'))
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transactions.forEach((tx: { recentBlockhash: string; }) => tx.recentBlockhash = blockhash);

      return transactions;
    } catch (error) {
      throw new Error(`Failed to prepare transactions: ${error}`);
    }
  }

  private async signAndSendTransaction(
    connection: Connection,
    tx: Transaction,
    keypair: Keypair
  ): Promise<string> {
    try {
      tx.sign(keypair);
      return await connection.sendTransaction(tx, [keypair]); // Используем sendTransaction
    } catch (error) {
      throw new Error(`Failed to sign/send transaction: ${error}`);
    }
  }

  private async confirmTransaction(
    connection: Connection,
    txId: string,
    timeout = 60000
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const status = await connection.getSignatureStatus(txId);

      if (status?.value?.confirmationStatus === 'confirmed') {
        this.logger.info(`Transaction confirmed: ${txId}`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Transaction confirmation timeout: ${txId}`);
  }
}
