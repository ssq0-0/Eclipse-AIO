import { Connection, PublicKey } from "@solana/web3.js";
import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  IGNORE_CACHE,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  WhirlpoolContext,
  buildWhirlpoolClient,
  swapQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import axios from "axios";
import { ModulesFasad } from "./modulesInit";
import { Account } from "../data/userAccount";
import { LoggerService } from "../logger/logger";
import { convertToDecimals } from "../utils/checkToken";
import { HttpsProxyAgent } from "https-proxy-agent";
import {tokenNamesMap} from "../globals/globals";
import {prepareLogInfo} from "../utils/actionLogMsg"

/**
 * Основной класс модуля Orca.
 * Реализует получение swap‑quote через новый API, поддержку мульти-хоп маршрута и выполнение транзакций.
 */
export class Orca implements ModulesFasad {
  private readonly apiUrl: string; // Например: "https://pools-api-eclipse.mainnet.orca.so/swap-quote"
  private readonly retries: number;
  private readonly logger: LoggerService;

  constructor(apiUrl: string, retries: number, logger: LoggerService) {
    if (!apiUrl) throw new Error("API URL (ORCA API) не задан!");

    this.apiUrl = apiUrl;
    this.retries = retries;
    this.logger = logger;
  }

  /**
   * Основной метод для выполнения маршрутизированного свопа.
   *
   * Последовательность:
   * 1. Инициализировать кошелёк, провайдера и контекст.
   * 2. Запросить полный swap‑quote от нового API.
   * 3. Пройти по каждому хопу из swap‑quote, обновляя входной токен и сумму для следующего шага.
   * 4. Выполнить своп для каждого хопа с повторными попытками.
   */
  public async Action(
    acc: Account,
    connection: Connection,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number
  ): Promise<string> {
    const msg = prepareLogInfo(acc.Address, inputMint, outputMint, amount);
    this.logger.info(msg);

    try {
      const ctx = this.initializeContext(acc, connection);
      const walletAddress = ctx.wallet.publicKey.toBase58();

      const converted = convertToDecimals(inputMint.toString(), amount);
      let currentAmountBN = new BN(converted.toString());
      let currentMint = inputMint;

      const apiResponse = await this.fetchSwapQuote(
        acc, 
        inputMint.toBase58(),
        outputMint.toBase58(),
        currentAmountBN.toString(),
        walletAddress
      );
      if (!apiResponse) {
        return "Не удалось получить swap quote от API";
      }

      const hops: any[] = apiResponse.split[0];
      if (!hops || hops.length === 0) {
        return "Нет данных по хопам(маршруту) в swap quote";
      }

      let finalSignature = "";
      
      for (let i = 0; i < hops.length; i++) {
        const hop = hops[i];
        const pool = await this.getPoolByAddress(ctx, hop.pool);

        const hopQuote = await swapQuoteByInputToken(
          pool,
          currentMint,
          currentAmountBN,
          Percentage.fromFraction(10, 1000),
          ctx.program.programId,
          ctx.fetcher,
          IGNORE_CACHE
        );

        const result = await this.attemptSwap(ctx, pool, hopQuote);
        if (result === "failed") {
          this.logger.error(`Своп для хопа ${i + 1} не удался`);
          return result;
        }

        finalSignature = result; 

        currentMint = new PublicKey(hop.output.mint);
        currentAmountBN = new BN(hop.output.amount);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      return `Транзакция завершена: https://eclipsescan.xyz/tx/${finalSignature}`;
    } catch (error) {
      return `Orca swap failed. Reason: ${error}`;
    }
  }

  /**
   * Инициализирует кошелёк, провайдера и контекст Whirlpool.
   */
  private initializeContext(acc: Account, connection: Connection) {
    const wallet = new Wallet(acc.Keypair);
    const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    (ctx as any).wallet = wallet;
    return ctx;
  }

  /**
   * Получает объект пула по указанному адресу.
   */
  private async getPoolByAddress(ctx: WhirlpoolContext, poolAddress: string) {
    const whirlpoolPubkey = new PublicKey(poolAddress);
    const client = buildWhirlpoolClient(ctx);
    return await client.getPool(whirlpoolPubkey);
  }

  /**
   * Формирует URL и запрашивает swap‑quote через новый API.
   */
  private async fetchSwapQuote(
    acc: Account,
    from: string,
    to: string,
    amount: string,
    wallet: string
  ): Promise<any | null> {
    try {
      const url = `${this.apiUrl}?from=${from}&to=${to}&amount=${amount}&isLegacy=false&amountIsInput=true&includeData=true&includeComputeBudget=false&maxTxSize=1185&wallet=${wallet}`;
      const response = await axios.get(url, {
        httpsAgent: acc.Proxy ? new HttpsProxyAgent(acc.Proxy) : undefined, // Используем прокси, если оно задано
      });

      if (response.status !== 200) {
        this.logger.error(`Ошибка HTTP ${response.status}: ${response.statusText}`);
        return null;
      }
      return response.data.data.swap;
    } catch (error) {
      this.logger.error(`Ошибка при запросе swap-quote: ${error}`);
      return null;
    }
  }

  /**
   * Пытается выполнить своп с заданным числом повторов.
   */
  private async attemptSwap(ctx: WhirlpoolContext, pool: any, quote: any): Promise<string> {
    for (let i = 0; i < this.retries; i++) {
      try {
        const txId = await this.executeSwap(ctx, pool, quote);
        return txId;
      } catch (error) {
        this.logger.error(`Попытка ${i + 1} для хопа не удалась: ${error}`);
        if (i === this.retries - 1) {
          throw error;
        }
      }
    }
    return "failed";
  }

  /**
   * Выполняет транзакцию свопа для конкретного хопа.
   */
  private async executeSwap(ctx: WhirlpoolContext, pool: any, quote: any): Promise<string> {
    const { blockhash, lastValidBlockHeight } = await ctx.connection.getLatestBlockhash();
    const tx = await pool.swap(quote);
    const signature = await tx.buildAndExecute();

    await ctx.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return signature;
  }
}
