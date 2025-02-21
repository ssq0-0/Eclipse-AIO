import { 
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    getAccount,
    TOKEN_2022_PROGRAM_ID,
    TokenAccountNotFoundError
  } from '@solana/spl-token';
  import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {tokenMap, decimalMap} from "../globals/globals";
import {Account} from "../data/userAccount";
import {LoggerService} from "../logger/logger";

export function checkNativeToken(token: PublicKey): boolean {
    const ethToken = tokenMap.get("ETH");  // Получаем ETH из `tokenMap`
    return ethToken?.equals(token) ?? false;
}

export async function validateATA(acc: Account, connection: Connection, token: PublicKey, logger: LoggerService): Promise<PublicKey> {
    try {
        const { exists, address } = await checkATA(connection, acc.PubKey, token);
        
        if (!exists) {
          await createATA(acc, connection, token, logger);
          
          const newAta = getAssociatedTokenAddressSync(
            token,
            acc.PubKey,
            true,
            TOKEN_2022_PROGRAM_ID
          );
          return newAta;
        }
        
        return address;
      } catch (error) {
        logger.error(`[${acc.Address}] ATA validation failed: ${error}`);
        throw error;
      }
}

async function checkATA(
    connection: Connection,
    owner: PublicKey,
    mint: PublicKey
  ): Promise<{ address: PublicKey; exists: boolean }> {
    try {
      // 1. Получаем адрес ATA
      const ataAddress = getAssociatedTokenAddressSync(
        mint,
        owner,
        true,
        TOKEN_2022_PROGRAM_ID
      );
  
      // 2. Проверяем существование аккаунта
      await getAccount(connection, ataAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);
      
      return { 
        address: ataAddress,
        exists: true
      };
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return {
          address: getAssociatedTokenAddressSync(
            mint,
            owner,
            true,
            TOKEN_2022_PROGRAM_ID
          ),
          exists: false
        };
      }
      throw error;
    }
  }
  
async function createATA(
  acc: Account,
  connection: Connection,
  mint: PublicKey,
  logger: LoggerService
): Promise<string> {
  try {
    // 1. Получаем адрес ATA
    const ataAddress = getAssociatedTokenAddressSync(
      mint,
      acc.PubKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // 2. Создаем инструкцию
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        acc.PubKey, // Payer
        ataAddress,
        acc.PubKey, // Owner
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // 3. Отправляем транзакцию
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [acc.Keypair],
      { commitment: 'confirmed' }
    );

    logger.info(`[${acc.Address}] ATA created: ${ataAddress.toString()}`);
    return signature;
  } catch (error) {
    logger.error(`[${acc.Address}] ATA creation failed: ${error}`);
    throw error;
  }
}

export function convertToDecimals(token: string, amount: number | undefined): number {
  if (typeof amount === "undefined") {
      throw new Error("Amount is required");
  }
  
  const decimals = decimalMap.get(token);
  if (typeof decimals === "undefined") {
      throw new Error(`Unknown token: ${token.toString()}`);
  }
  
  return Math.round(amount * Math.pow(10, decimals));
}
