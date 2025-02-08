import { 
    Connection, 
    PublicKey, 
    Transaction 
  } from "@solana/web3.js";
  import { 
    getPools, 
    getAmm, 
    getAmountOut, 
    getSwapInstruction,
    LIFINITY_ECLIPSE_PROGRAM_ID 
  } from '@lifinity/sdk-v2-eclipse';
  import { 
    getAssociatedTokenAddressSync, 
    TOKEN_2022_PROGRAM_ID 
  } from '@solana/spl-token';
  import { ModulesFasad } from "./modulesInit";
  import { Account } from "../data/userAccount";
  import { LoggerService } from '../logger/logger';
  import {prepareLogInfo} from "../utils/actionLogMsg"
import { am } from "solar-sdk/lib/api-b51b7ca8";
  
  export class Lifinity implements ModulesFasad {
    private logger: LoggerService;
  
    constructor(logger: LoggerService) {
      this.logger = logger;
    }
  
    /**
     * Основное действие: осуществляет своп SOL-USDC через протокол Lifinity.
     */
    async Action(acc: Account, connection: Connection, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<string> {
      const rawAmount:number = this.trimAmount(amount, 4);
      const msg = prepareLogInfo(acc.Address, inputMint, outputMint, rawAmount);
      this.logger.info(msg);

      try {
        const targetPool = await this.getTargetPool(connection, inputMint, outputMint);
        const { inputATA, outputATA } = this.getAssociatedTokenAddresses(acc.PubKey, inputMint, outputMint);
  
        const ammData = await this.getAmmData(connection, targetPool.ammPubkey);
        const amountOutWithSlippage = await this.getAmountOutValue(connection, ammData, rawAmount, inputMint);
  
        const swapInstruction = await this.createSwapInstruction(
          connection,
          acc.PubKey,
          rawAmount,
          amountOutWithSlippage,
          ammData,
          inputATA,
          outputATA,
          inputMint,
          outputMint
        );
        
        const transaction = await this.buildTransaction(connection, acc, swapInstruction);
        const txId = await connection.sendRawTransaction(transaction.serialize());
  
        await this.confirmTransaction(connection, txId);
  
        return `Транзакция завершена: https://eclipsescan.xyz/tx/${txId}`;
      } catch (error) {
        this.logger.error(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw new Error("Operation failed");
      }
    }
  
    /**
     * Получает пул с нужными токенами.
     */
    private async getTargetPool(connection: Connection, inputMint: PublicKey, outputMint: PublicKey): Promise<any> {
      const pools = await getPools(connection);
      const targetPool = pools.find(p =>
        (p.mintA.equals(inputMint) && p.mintB.equals(outputMint)) ||
        (p.mintB.equals(inputMint) && p.mintA.equals(outputMint))
      );
  
      if (!targetPool) {
        throw new Error("❌ Pool for swap not found");
      }
  
      return targetPool;
    }
  
    /**
     * Возвращает ATA адреса для SOL и USDC.
     */
    private getAssociatedTokenAddresses(owner: PublicKey, inputMint: PublicKey, outputMint: PublicKey): { inputATA: PublicKey; outputATA: PublicKey } {
      const inputATA = getAssociatedTokenAddressSync(
        inputMint,
        owner,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const outputATA = getAssociatedTokenAddressSync(
        outputMint,
        owner,
        false,
        TOKEN_2022_PROGRAM_ID
      );
  
      return { inputATA, outputATA };
    }
  
    /**
     * Загружает данные AMM по указанному адресу.
     */
    private async getAmmData(connection: Connection, ammPubkey: PublicKey): Promise<any> {
      const ammData = await getAmm(connection, ammPubkey);
      if (!ammData) {
        throw new Error("❌ Failed to load AMM data");
      }
      return ammData;
    }
  
    /**
     * Получает ожидаемое значение amountOut с учётом проскальзывания.
     */
    private async getAmountOutValue(connection: Connection, ammData: any, amountIn: number, inputMint: PublicKey): Promise<number> {
      const { amountOutWithSlippage } = await getAmountOut(
        connection,
        ammData,
        amountIn,
        inputMint,
        1.0
      );
      return amountOutWithSlippage;
    }
  
    /**
     * Создаёт инструкцию для свопа.
     */
    private async createSwapInstruction(connection: Connection, owner: PublicKey, amountIn: number, amountOutWithSlippage: number, ammData: any, solAta: PublicKey, usdcAta: PublicKey, inputMint: PublicKey, outputMint: PublicKey): Promise<any> {
      const swapIx = await getSwapInstruction(
        connection,
        owner,
        amountIn,
        amountOutWithSlippage,
        ammData,
        inputMint,
        outputMint,
        solAta,
        usdcAta,
        LIFINITY_ECLIPSE_PROGRAM_ID
      );
  
      if (!swapIx) {
        throw new Error("❌ Failed to create swap instruction");
      }
  
      return swapIx;
    }
  
    /**
     * Собирает транзакцию с указанной инструкцией.
     */
    private async buildTransaction(
      connection: Connection,
      acc: Account,
      instruction: any
    ): Promise<Transaction> {
      const transaction = new Transaction();
      transaction.add(instruction);
  
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = acc.PubKey;
      transaction.sign(acc.Keypair);
  
      return transaction;
    }
  
    /**
     * Подтверждает транзакцию в сети с заданным таймаутом.
     */
    private async confirmTransaction(
      connection: Connection,
      txId: string,
      timeout = 60000
    ): Promise<void> {
      const start = Date.now();
  
      while (Date.now() - start < timeout) {
        const status = await connection.getSignatureStatus(txId);
        if (status?.value?.confirmationStatus === 'finalized' || status?.value?.confirmationStatus === 'confirmed') {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
  
      throw new Error(`Transaction confirmation timeout: ${txId}`);
    }

    private trimAmount(amount: number, decimals: number = 4): number {
      const factor = Math.pow(10, decimals);
      return Math.floor(amount * factor) / factor;
    }
  }
  