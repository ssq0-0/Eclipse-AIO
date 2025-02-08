import * as path from "path";
import { ReadConfig } from "./config/config";
import { fileReader } from "./utils/fileReader";
import { AccountFactory } from "./data/userAccount";
import * as s from "@solana/web3.js"
import {userChoice} from "./utils/console_utils";
import {checkVersion} from "./utils/version";
import {printStartMessage} from "./utils/startMsg";
import {ModulesFactory} from "./modules/modulesInit";
import {LoggerService} from "./logger/logger";
import {ProcessAccounts} from "./process/actionGenerators";

(async () => {
  try {
    const GlobalLogger = new LoggerService('info');
    await printStartMessage(GlobalLogger);
    await checkVersion(GlobalLogger);

    // Абсолютный путь к файлу wallets.txt
    const solPkFilePath = path.join(__dirname, "data", "wallets.txt");
    const evmPkFilePath = path.join(__dirname, "data", "evm_wallets.txt");
    const proxyFilepath = path.join(__dirname, "data", "proxy.txt");
    const userConfigFilePath = path.join(__dirname, "config", "user_config.json");
    const devConfigFilePath = path.join(__dirname, "config", "dev_config.json");

    // Чтение приватных ключей
    const solPrivateKeys: string[] = await fileReader(solPkFilePath);
    const evmPrivateKeys: string[] = await fileReader(evmPkFilePath);
    const proxies: string[] = await fileReader(proxyFilepath);

    const userConfig = await ReadConfig(userConfigFilePath, GlobalLogger);
    const devConfig = await ReadConfig(devConfigFilePath, GlobalLogger);
    const accounts = await AccountFactory(solPrivateKeys,evmPrivateKeys, proxies, userConfig);
    const modules = await ModulesFactory.createModule(devConfig, GlobalLogger);

    const userChoiceResult: string = await userChoice();
    if (userChoiceResult === "" || userChoiceResult === "Exit") {
      GlobalLogger.info("Exiting program...");
      process.exit(0);
    }
    const connection = new s.Connection(devConfig.eclipse, "confirmed");
    await ProcessAccounts(accounts, connection, GlobalLogger, userChoiceResult, modules, userConfig);
    await printStartMessage(GlobalLogger);
  } catch (error) {
    console.error("Error:", error);
  }
})();