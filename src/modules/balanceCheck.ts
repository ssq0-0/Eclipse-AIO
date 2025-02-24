import { Connection, PublicKey } from "@solana/web3.js";
import { Account } from "../data";
import { LoggerService } from "../logger/logger";
import { tokenMap } from "../globals/globals";
import { getAssociatedTokenAddress } from "@solana/spl-token"; 
import { writeWalletBalances } from "../utils/fileReader";

export class BalanceChecker {
    private logger: LoggerService;

    constructor(logger: LoggerService) {
        this.logger = logger;
    }

    private async getTransactionCount(connection: Connection, wallet: PublicKey): Promise<number> {
        try {
            const signatures = await connection.getSignaturesForAddress(wallet, { limit: 1000 });
            return signatures.length;
        } catch (error) {
            this.logger.error(`Ошибка получения количества транзакций: ${error}`);
            return 0;
        }
    }

    async Action(acc: Account, connection: Connection): Promise<string> {
        const balances: Record<string, number> = {};

        for (const [tokenName, mint] of tokenMap) {
            try {
                balances[tokenName] = tokenName === "ETH"
                    ? await connection.getBalance(acc.PubKey) / 1e9
                    : await this.getTokenBalance(connection, mint, acc.PubKey);
            } catch (error) {
                this.logger.error(`Ошибка получения баланса для ${tokenName}: ${error}`);
                balances[tokenName] = 0;
            }
        }

        balances["TX_COUNT"] = await this.getTransactionCount(connection, acc.PubKey);
        await writeWalletBalances(balances, acc.Address, this.logger);

        return "balances";
    }

    private async getTokenBalance(connection: Connection, mint: PublicKey, owner: PublicKey): Promise<number> {
        const ata = await getAssociatedTokenAddress(mint, owner);
        const accountInfo = await connection.getAccountInfo(ata);
        if (!accountInfo) return 0;

        const tokenAccount = await connection.getTokenAccountBalance(ata);
        return tokenAccount.value.uiAmount ?? 0;
    }
}
