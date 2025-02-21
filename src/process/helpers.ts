import { Connection, PublicKey } from "@solana/web3.js";
import { Account } from "../data";
import { checkNativeToken } from "../utils/checkToken";
import { LoggerService } from "../logger/logger";
import { ETH, tokenMap, MINOR_ADDR, validPairsMap, SOL, USDC } from "../globals/globals";
import { ActionProcess } from "../globals/types";
import {validateATA} from "../utils/checkToken";

export async function getBalance(acc: Account, connection: Connection, token: PublicKey,logger: LoggerService): Promise<number> {
    try {
        if (checkNativeToken(token)) {
            const result = await connection.getBalance(acc.PubKey);
            return result / 1e9;
        }
        
        const ata = await validateATA(acc, connection, token, logger);

        const accountInfo = await connection.getTokenAccountBalance(ata);
        return parseFloat(accountInfo.value.amount) / Math.pow(10, accountInfo.value.decimals);
    } catch (error) {
        logger.error(`Balance check failed: ${error}`);
        return 0;
    }
}

export function selectDifferentToken(currentToken: PublicKey): PublicKey {
    const tokens = Array.from(tokenMap.values()).filter(t => !t.equals(currentToken));
    return tokens[Math.floor(Math.random() * tokens.length)] || ETH;
}

export async function findAlternativeToken(acc: Account, connection: Connection, excludedToken: PublicKey, logger: LoggerService): Promise<PublicKey | null> {
    const candidates = [
        selectDifferentToken(excludedToken),
        selectDifferentToken(ETH)
    ];

    for (const token of candidates) {
        const balance = await getBalance(acc, connection, token, logger);
        if (balance >= 0.00001) return token;
    }
    return null;
}

export function calculateSwapAmount(balance: number, min: number, max: number): number {
    if (balance < min) {
        throw new Error("Недостаточно средств для свопа");
    }

    const safeMax = balance < max ? balance : max;
    if (safeMax === min) {
        return min;
    }
    return min + Math.random() * (safeMax - min);
}

// ======
export async function determineTokenFrom(acc: Account, module: string): Promise<PublicKey> {
    const validPairs = validPairsMap.get(module);
    if (!validPairs) {
        throw new Error(`Неизвестный модуль: ${module}`);
    }

    const allowedTokens = new Set<string>();
    for (const pair of validPairs) {
        const [tokenA, tokenB] = pair.split("_");
        allowedTokens.add(tokenA);
        allowedTokens.add(tokenB);
    }

    // Фильтруем только те токены, которые допустимы для этого модуля
    const filteredTokens = Array.from(tokenMap.values()).filter(token => allowedTokens.has(token.toString()));

    if (filteredTokens.length === 0) {
        throw new Error(`Нет доступных токенов для модуля ${module}`);
    }

    return filteredTokens[Math.floor(Math.random() * filteredTokens.length)];
}

export function determineTokenTo(tokenFrom: PublicKey, module: string): PublicKey {
    const validPairs = validPairsMap.get(module);
    if (!validPairs) {
        throw new Error(`Неизвестный модуль: ${module}`);
    }

    // Находим все пары, где участвует `tokenFrom`
    const possibleTokens = Array.from(validPairs)
        .map(pair => pair.split("_"))
        .filter(([t1, t2]) => t1 === tokenFrom.toString() || t2 === tokenFrom.toString())
        .flat()
        .map(tokenStr => new PublicKey(tokenStr))
        .filter(token => !token.equals(tokenFrom));

    if (possibleTokens.length === 0) {
        throw new Error(`Нет доступных пар для токена ${tokenFrom.toString()} в модуле ${module}`);
    }

    return possibleTokens[Math.floor(Math.random() * possibleTokens.length)];
}


export async function ensureValidTokenPair(tokenFrom: PublicKey, tokenTo: PublicKey, module: string, logger: LoggerService): Promise<PublicKey> {
    const MAX_ITERATIONS = 5;
    if (!validPairsMap.has(module)) {
      return tokenTo;
    }
    const validPairs = validPairsMap.get(module)!;
    let iteration = 0;
    let pairKey = formatPairKey(tokenFrom, tokenTo);
    while (!validPairs.has(pairKey) && iteration < MAX_ITERATIONS) {
      tokenTo = selectDifferentToken(tokenFrom);
      pairKey = formatPairKey(tokenFrom, tokenTo);
      iteration++;
    }
    if (iteration === MAX_ITERATIONS) {
      logger.error("Exceeded maximum iterations while selecting a valid token pair.");
      throw new Error("Exceeded maximum iterations while selecting a valid token pair.");
    }
    return tokenTo;
}
  
  /**
   * Формирует строковое представление пары токенов для сравнения с validPairsMap.
   */
function formatPairKey(tokenFrom: PublicKey, tokenTo: PublicKey): string {
    return `${tokenFrom.toString()}_${tokenTo.toString()}`;
}

export function createSwapAction(acc: Account, from: PublicKey, to: PublicKey, amount: number, logger: LoggerService, module:string, forced: boolean): ActionProcess {
    const action = {
        TokenFrom: from,
        TokenTo: to,
        Amount: amount,
        TypeAction: "swap",
        Module: module
    };

    acc.LastSwaps.push({ TokenFrom: from, TokenTo: to, Forced: forced });
    return action;
}

export function createUnderdogAction(): ActionProcess {
    const action = {
        TokenFrom: MINOR_ADDR,
        TokenTo: MINOR_ADDR,
        Amount: 0,
        TypeAction: "swap",
        Module: "underdog"
    };

    return action;
}

export function createRelayAction(acc: Account, from: PublicKey, amount: number): ActionProcess {
    const action = {
        TokenFrom: from,
        TokenTo: MINOR_ADDR,
        Amount: 0,
        TypeAction: "bridge",
        Module: "relay"
    };

    return action;
}

export function createUnknownAction(acc: Account, reason: string): ActionProcess {
    return {
        TokenFrom: ETH,
        TokenTo: ETH,
        Amount: 0,
        TypeAction: "unknown",
        Module: "system",
        Error: reason // Можно добавить дополнительное поле в тип
    };
}

export function createExitAction(acc: Account): ActionProcess {
    return {
        TokenFrom: ETH,
        TokenTo: ETH,
        Amount: 0,
        TypeAction: "exit",
        Module: "system"
    };
}

export async function checkAndForceSwap(acc: Account, connection: Connection, module: string, logger: LoggerService): Promise<ActionProcess | null> {
    const isLifinity = module === "Lifinity";
    const criticalToken = isLifinity ? SOL : ETH;  // Lifinity строго SOL
    const minBalance = isLifinity ? acc.MinSolSwap : acc.MinEthSwap;
  
    const balance = await getBalance(acc, connection, criticalToken, logger);
    if (balance >= minBalance) return null; // Баланс в порядке, ничего не делаем
  
    logger.error(`[${acc.Address}] Low ${isLifinity ? "SOL" : "ETH"} balance. Forcing swap`);
  
    let forcedTokenFrom = module === "Lifinity" ? USDC : await findAlternativeToken(acc, connection, criticalToken, logger);
    if (!forcedTokenFrom) forcedTokenFrom = selectDifferentToken(criticalToken);
  
    const forcedBalance = await getBalance(acc, connection, forcedTokenFrom, logger);
    const amount = calculateSwapAmount(
        forcedBalance,
        getMinSwapValue(acc, forcedTokenFrom),
        getMaxSwapValue(acc, forcedTokenFrom)
    );

  return createSwapAction(acc, forcedTokenFrom, criticalToken, amount, logger, module, true);
}
  
export function getMinSwapValue(acc: Account, token: PublicKey): number {
    if (token.equals(SOL)) return acc.MinSolSwap;
    if (token.equals(ETH)) return acc.MinEthSwap;
    return acc.MinStableSwap;
}
  
export function getMaxSwapValue(acc: Account, token: PublicKey): number {
    if (token.equals(SOL)) return acc.MaxSolSwap;
    if (token.equals(ETH)) return acc.MaxEthSwap;
    return acc.MaxStableSwap;
}