import { Account } from "../data";
import { LoggerService } from "../logger/logger";
import {getBalance, createUnknownAction, createExitAction} from "./helpers";
import {generateTimeWindow, generateNextAction} from "./generator";
import {pause} from "../utils/timeUtils";
import { Connection } from "@solana/web3.js";
import {ETH, minEthBalanceForSwap, ActionLimiter} from "../globals/globals";
import { error, log } from "console";
import { ModulesFasad } from "../modules/modulesInit";
import { ActionProcess } from "../globals/types";


export async function ProcessAccounts(accounts: Account[], connection: Connection, logger: LoggerService, module: string, modules: Map<string, ModulesFasad>, config: any) {
    const workers: Promise<void>[] = [];
    const MAX_CONCURRENT_THREADS = config.max_threads;
    const semaphore = new Array(MAX_CONCURRENT_THREADS).fill(null);
    const MAX_WAIT_TIME = 60000; // 60 секунд на ожидание свободного потока

    for (const acc of accounts) {
        const workerPromise = new Promise<void>((resolve) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                const freeIndex = semaphore.findIndex(slot => slot === null);
                
                if (freeIndex !== -1) {
                    semaphore[freeIndex] = acc;
                    clearInterval(interval);

                    processSingleAccount(acc, connection, logger, module, modules)
                        .then(() => {
                            semaphore[freeIndex] = null;
                            resolve();
                        })
                        .catch((err) => {
                            logger.error(`Ошибка в потоке: ${err}`);
                            semaphore[freeIndex] = null;
                            resolve();
                        });
                }

                // Если прошло больше MAX_WAIT_TIME, прерываем ожидание
                if (Date.now() - startTime > MAX_WAIT_TIME) {
                    clearInterval(interval);
                    logger.error(`Таймаут ожидания потока для аккаунта ${acc.Address}`);
                    resolve();
                }
            }, 1000);
        });

        workers.push(workerPromise);
    }

    await Promise.all(workers);
    logger.info("Все аккаунты обработаны.");
}


async function processSingleAccount(acc: Account, connection: Connection, logger: LoggerService, module: string, modules: Map<string, ModulesFasad>):Promise<void> {
    await performAction(acc, connection, logger, module, modules);
}

async function performAction(acc: Account, connection:Connection, logger: LoggerService, module: string, modules: Map<string, ModulesFasad>):Promise<ActionProcess> {
    const maxRetries = 3;
    let retryCount = 0;
    let successfulActions = 0;
    let totalActions = acc.ActionCount;
    const moduleLimit = ActionLimiter.get(module);
    if (moduleLimit !== undefined) {
        totalActions = moduleLimit;
    }

    const ethBalance = await getBalance(acc, connection, ETH, logger);
    if (ethBalance < minEthBalanceForSwap && module !== "Relay") {
        logger.error(`[${acc.Address}] Low ETH balance. Stop trying.`);
        return createUnknownAction(acc, "ETH balance too low");
    }

    // load state here

    // check state. If state not empty - take successfulAction from state

    // const totalActions = await determinateActionsCount("someModule");
    // if (totalActions !== null) {
    //     console.log(`Total actions: ${totalActions}`);
    // } else {
    //     console.log("No actions found for this module.");
    // }

    while (successfulActions < totalActions && retryCount < maxRetries) {
        try {
            const setupDuration = await generateTimeWindow(acc.ActionTime, totalActions);
            if (setupDuration === null) {
                logger.error(`[${acc.Address}] Ошибка генерации временного интервала. Пропускаем действие.`);
                throw new Error("error time generate."); 
            }
            logger.info(`[${acc.Address}] Спим перед выполнением ${setupDuration/1000} секунд...`)
            await pause(setupDuration);

            const action = await generateNextAction(acc, connection, logger, module);
            if (action.TypeAction === "unknow") {
                logger.warn(`[${acc.Address}] Обнаружена попытка неизвестного действия. Попытка ${retryCount + 1}/${maxRetries}`);
                retryCount++;
                continue;
            }
            const modulesInstance = modules.get(module);
            if (!modulesInstance) {
                throw new Error(`Модуль ${module} не инициализирован`);
            }

            const result = await modulesInstance.Action(acc, connection, action.TokenFrom, action.TokenTo, action.Amount);
            logger.info(`[${acc.Address}] Действие выполнено: ${result}`);

            successfulActions += 1;
            retryCount = 0;
        } catch(error){
            logger.error(`[${acc.Address}] Ошибка выполнения: ${error}`);
            retryCount++;
            
            if (retryCount >= maxRetries) {
                return createUnknownAction(acc, `Использовано максимальное колчичество (${maxRetries}) попыток`);
            }
        }
    }

    if (successfulActions >= totalActions) {
        logger.info(`[${acc.Address}] Успешно выполнено ${totalActions} действий`);
        return createExitAction(acc);
      }
    
      return createUnknownAction(acc, "Не все действия были успешными");
}