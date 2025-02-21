import * as path from "path";
import { ReadConfig } from "./config/config";
import { fileReader, readWalletConfig } from "./utils/fileReader";
import { AccountFactory } from "./data/userAccount";
import * as s from "@solana/web3.js"
import {userChoice} from "./utils/console_utils";
import {checkVersion} from "./utils/version";
import {printStartMessage} from "./utils/startMsg";
import {ModulesFactory} from "./modules/modulesInit";
import {LoggerService} from "./logger/logger";
import {ProcessAccounts} from "./process/actionGenerators";
import { WalletConfig, WalletConfigFile } from "./globals/types";

(async () => {
  try {
    const GlobalLogger = new LoggerService('info');
    await printStartMessage(GlobalLogger);
    await checkVersion(GlobalLogger);

    // Абсолютный путь к файлу wallets.txt
    const solPkFilePath = path.join(process.cwd(), "data", "wallets.txt");
    const evmPkFilePath = path.join(process.cwd(), "data", "evm_wallets.txt");
    const proxyFilePath = path.join(process.cwd(), "data", "proxy.txt");
    const bridgeConfigPath = path.join(process.cwd(), "data", "bidger_info.json");
    const userConfigFilePath = path.join(process.cwd(), "data", "user_config.json");
    const devConfigFilePath = path.join(process.cwd(), "data", "dev_config.json");
    

    // Чтение приватных ключей
    const solPrivateKeys: string[] = await fileReader(solPkFilePath);
    const evmPrivateKeys: string[] = await fileReader(evmPkFilePath);
    const proxies: string[] = await fileReader(proxyFilePath);

    const userConfig = await ReadConfig(userConfigFilePath, GlobalLogger);
    const devConfig = await ReadConfig(devConfigFilePath, GlobalLogger);
    const bridgeConfig = await ReadConfig(bridgeConfigPath, GlobalLogger);
    const accounts = await AccountFactory(solPrivateKeys,evmPrivateKeys, proxies, bridgeConfig, userConfig);
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