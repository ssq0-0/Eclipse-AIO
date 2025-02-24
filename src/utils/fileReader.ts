import * as fs from "fs/promises";
import { WalletConfigFile } from "../globals/types";
import { LoggerService } from "../logger/logger";
import path from "path";

export async function fileReader(filename: string): Promise<string[]> {
  try {
    const fileContent = await fs.readFile(filename, "utf-8");

    const lines = fileContent
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    return lines;
  } catch (error) {
    console.error(`Error reading file: ${filename}`, error);
    throw error;
  }
}

export async function readWalletConfig(configFilePath: string): Promise<WalletConfigFile | null> {
  try {
    const data = await fs.readFile(configFilePath, "utf-8");
    return JSON.parse(data) as WalletConfigFile;
  } catch (error) {
    return null;
  }
}

export async function writeWalletConfig(config: WalletConfigFile, logger: LoggerService): Promise<void> {
  try {
    const filepath = path.join(process.cwd(), "data", "walletConfig.json");
    // Преобразуем объект в JSON с отступами для читаемости
    const json = JSON.stringify(config, null, 2);
    await fs.writeFile(filepath, json, 'utf-8');
    logger.info(`Конфигурация кошелька успешно сохранена по пути: ${filepath}`);
  } catch (error) {
    logger.error(`Ошибка при записи конфигурации кошелька: #{error}`);
    throw error;
  }
}

export async function writeWalletBalances(
  balances: Record<string, number>,
  address: string,
  logger: LoggerService
): Promise<void> {
  try {
    const filepath = path.join(process.cwd(), "data", "balances.csv");
    const headers = ["Wallet", ...Object.keys(balances)];
    const newRow = [address, ...Object.values(balances).map(v => v.toFixed(6))];

    let content = "";
    try {
      content = await fs.readFile(filepath, "utf-8");
    } catch {
      logger.info(`Файл ${filepath} не найден, создаём новый.`);
    }

    let lines = content ? content.split("\n").filter(Boolean) : [];
    if (!lines.length) {
      lines.push(headers.join(","));
    }

    const walletIndex = lines.findIndex(line => line.startsWith(address));

    if (walletIndex > 0) {
      lines[walletIndex] = newRow.join(",");
    } else {
      lines.push(newRow.join(","));
    }

    await fs.writeFile(filepath, lines.join("\n") + "\n", "utf-8");
  } catch (error) {
    logger.error(`Ошибка записи балансов: ${error}`);
    throw error;
  }
}