import { Connection, PublicKey } from "@solana/web3.js";
import { Account } from "../data";
import { getBalance, getMinSwapValue, getMaxSwapValue, checkAndForceSwap, createSwapAction, createUnderdogAction, findAlternativeToken, calculateSwapAmount, determineTokenTo, ensureValidTokenPair } from "./helpers";
import { LoggerService } from "../logger/logger";
import {ETH, MINOR_ADDR, SOL, USDC, USDT} from "../globals/globals";
import { ActionProcess } from "../globals/types";

const actionsgenerators: Map<string, Function> = new Map([
    ['Solar', SwapGenerateAction],
    ['Orca', SwapGenerateAction],
    ['Lifinity', SwapGenerateAction],
    ['Relay', RelayActionGenerate],
    ['Underdog', GenerateUnderdog],
    ['Collector', CollectorAction],
    // ['Random', ] // под масштабирование
]);


export async function generateTimeWindow(totalTime: number, actionCount: number): Promise<number | null> {
    if (actionCount <= 0) {
        return null;
    }

    const baseInterval = (totalTime * 60 * 1000) / actionCount; // В миллисекундах
    const variationFactor = 0.2;
    const minVariation = 1000; // 1 секунда
    const maxVariation = 30 * 1000; // 30 секунд

    const intervals: number[] = [];

    for (let i = 0; i < actionCount; i++) {
        let variation = baseInterval * variationFactor;

        // Ограничения на вариацию
        if (variation < minVariation) {
            variation = minVariation;
        } else if (variation > maxVariation) {
            variation = maxVariation;
        }

        // Случайная вариация интервала
        const randomVariation = Math.random() * 2 * variation - variation;
        let interval = baseInterval + randomVariation;

        if (interval < 0) {
            interval = baseInterval;
        }

        intervals.push(interval);
    }

    // Возвращаем первый интервал из массива
    return intervals[0];
}

export async function generateNextAction(acc: Account, connection: Connection, logger:LoggerService, module: string): Promise<ActionProcess> {
    const genFunc =  actionsgenerators.get(module);
    if (genFunc) {
        return await genFunc(acc, connection, module, logger);  // Вызов функции с нужными параметрами
    } else {
        logger.error(`No action generator found for module: ${module}`);
        throw new Error(`No action generator found for module: ${module}`);
    }
}

export async function SwapGenerateAction(acc: Account, connection: Connection, module: string, logger: LoggerService): Promise<ActionProcess> {
    let tokenFrom: PublicKey;
    let tokenTo: PublicKey;
    tokenFrom = acc.LastSwaps.length > 0 ? acc.LastSwaps[acc.LastSwaps.length - 1].TokenTo : (module === "Lifinity" ? SOL : ETH);
    tokenTo = determineTokenTo(tokenFrom, module);
  
    // Проверяем баланс требуемого «исходного» токена (ETH или SOL) для форсирования свопа.
    const forcedToken = await checkAndForceSwap(acc, connection, module, logger);
    if (forcedToken) return forcedToken;
  
    // Проверяем баланс tokenFrom. Если средств недостаточно, ищем альтернативу.
    let tokenBalance = await getBalance(acc, connection, tokenFrom, logger);
    if (tokenBalance < 0.0001) {
      tokenFrom = (await findAlternativeToken(acc, connection, tokenFrom, logger)) ||
                  (module === "Lifinity" ? SOL : ETH);
      tokenTo = determineTokenTo(tokenFrom, module);
      tokenBalance = await getBalance(acc, connection, tokenFrom, logger);
    }
  
    // Валидируем сгенерированную пару (до 5 итераций).
    tokenTo = await ensureValidTokenPair(tokenFrom, tokenTo, module, logger);
  
    // Вычисляем сумму свопа, используя разные минимумы/максимумы в зависимости от tokenFrom:
    const amount = calculateSwapAmount(
        tokenBalance,
        getMinSwapValue(acc, tokenFrom),
        getMaxSwapValue(acc, tokenFrom)
    );
  
    return createSwapAction(acc, tokenFrom, tokenTo, amount, logger, module, false);
}  

export async function CollectorAction(acc: Account, connection: Connection, module: string, logger: LoggerService): Promise<ActionProcess | null> {
    let tokens = [
        {token: USDC, minBalance: 0.2}, 
        {token: USDT, minBalance: 0.2},
        {token: SOL, minBalance:0.001}
    ];

    let tokenFrom: PublicKey | null = null;
    let tokenBalance = 0;

    for (const { token, minBalance} of tokens) {
        tokenBalance = await getBalance(acc, connection, token, logger);
        if (tokenBalance >= minBalance) {
            tokenFrom = token;
            break;
        }
    }
    if (!tokenFrom) {
        logger.warn(`[${acc.Address}] Нет токенов для свапа. Завершаем работу.`);
        return {
            TokenFrom: MINOR_ADDR,
            TokenTo: MINOR_ADDR,
            Amount: tokenBalance,
            TypeAction: "collectorDone",
            Module: module
        };
    }

    return {
        TokenFrom: tokenFrom,
        TokenTo: ETH,
        Amount: tokenBalance,
        TypeAction: "Swap",
        Module: module
    };
}

export async function GenerateUnderdog(acc: Account, connection: Connection, module:string, logger: LoggerService): Promise<ActionProcess> {
    const action = createUnderdogAction();
    return action
}

export async function RelayActionGenerate(acc: Account, connection: Connection, module:string, logger: LoggerService): Promise<ActionProcess> {
    const action = {
        TokenFrom: MINOR_ADDR,
        TokenTo: MINOR_ADDR,
        Amount: acc.BridgeAmount,
        TypeAction: "bridge",
        Module: "relay"
    };

    return action;
}
