import { Connection, PublicKey } from "@solana/web3.js";
import { Account } from "../data";
import { ModulesFasad } from "./modulesInit";
import { Orca } from "./orca";
import { LoggerService } from "../logger/logger";
import { prepareLogInfo } from "../utils/actionLogMsg";

export class Collector implements ModulesFasad{
    private orca: Orca;
    private logger: LoggerService;
    private connection: Connection;

    constructor(orcaApi: string, eclipseRpc: string, logger: LoggerService) {
        this.logger = logger;
        this.orca = new Orca(orcaApi, 3, logger);
        this.connection = new Connection(eclipseRpc, "confirmed");
    }

    async Action(acc: Account, connection: Connection, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<string> {
        try {
            return this.orca.Action(acc, connection, inputMint, outputMint, amount);
        } catch(error) {
            this.logger.error(`Ошибка в коллекторе: ${error}`);
            return `${error}`;
        }
    }
}