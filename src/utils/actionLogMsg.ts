import { PublicKey } from "@solana/web3.js";
import { tokenNamesMap } from "../globals/globals";

export function prepareLogInfo(addr: string, input: PublicKey, output: PublicKey, amount: number): string {
    const inputToken = tokenNamesMap.get(input.toString());
    if (inputToken === undefined ) {
      throw Error("input token not found for log message");
    }

    const outputToken = tokenNamesMap.get(output.toString());
    if (outputToken === undefined ) {
      throw Error("output token not found for log message");
    }

    return `[${addr}] Действие: ${inputToken} -> ${outputToken}. Сумма ${amount}]`;
  }