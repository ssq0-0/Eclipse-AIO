import { Connection, PublicKey } from "@solana/web3.js";
import {Account} from "../data/userAccount";
import { Solar } from "./solar";
import {Orca} from "./orca";
import { LoggerService } from "../logger/logger";
import { Lifinity } from "./lifinity";
import { UnderDog } from "./underdog";
import { Relay } from "./relay";
import { Collector } from "./collector";
import { BalanceChecker } from "./balanceCheck";

export interface ModulesFasad {
    Action(acc: Account, connection: Connection, inputMint: PublicKey, outputMint: PublicKey, amount: number): Promise<string>;
}

export class ModulesFactory {
    private static modules: Map<string, ModulesFasad> | null = null;

    static createModule(config: any, logger: LoggerService): Map<string, ModulesFasad>  {
        if (!this.modules) {
            this.modules = new Map<string, ModulesFasad>([
                ["Solar", new Solar(config.solar_api, 50, "LEGACY", logger)],
                ["Orca", new Orca(config.orca_api, 3, logger)],
                ["Lifinity", new Lifinity(logger)],
                ["Underdog", new UnderDog(config.underdog_api, config.token, config.dev_api, logger)],
                ["Relay", new Relay(config.relay, logger, new Map([
                    ["arb", config.arb],
                    ["op", config.op],
                    ["base", config.base],
                    ["linea", config.linea],
                ]))],
                ["Collector", new Collector(config.orca_api, config.eclipse, logger)],
                ["BalanceCheck", new BalanceChecker(logger)]
            ]);
        }
        return this.modules;
    }
}
