import { PublicKey } from "@solana/web3.js";
import { Mutex } from "async-mutex";

export function initGlobals(config: any): void {
    minEthBalanceForSwap = config.minEthForTx || 0.0001;
    minSolBalanceForSwap = config.minSolForTx || 0.001;
}

export const ETH = new PublicKey("So11111111111111111111111111111111111111112");
export const SOL = new PublicKey("BeRUj3h7BqkbdfFU7FBNYbodgf8GCHodzKvF9aVjNNfL");
export const USDT = new PublicKey("CEBP3CqAbW4zdZA57H2wfaSG1QNdzQ72GiQEbQXyW9Tm");
export const USDC = new PublicKey("AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE");
export const MINOR_ADDR = new PublicKey("So11111111111111111111111111111111111111112");

export const tokenMap:Map<string, PublicKey> = new Map([
    ["ETH", ETH],
    ["SOL", SOL],
    ["USDT", USDT],
    ["USDC", USDC],
]);

export const tokenNamesMap: Map<string, string> = new Map([
  [ETH.toString(), "ETH"],
  [SOL.toString(), "SOL"],
  [USDT.toString(), "USDT"],
  [USDC.toString(), "USDC"],
  ["0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", "USDT"],
  ["0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", "USDT"],
  ["0xa219439258ca9da29e9cc4ce5596924745e12b93", "USDT"],
  ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "USDT"],
  ["0xaf88d065e77c8cc2239327c5edb3a432268e5831", "USDC"],
  ["0x0b2c639c533813f4aa9d7837caf62653d097ff85", "USDC"],
  ["0x176211869ca2b568f2a7d4ee941e073a821ee1ff", "USDC"],
  ["0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", "USDC"],
  ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "ETH"],
  ["0x4200000000000000000000000000000000000006", "ETH"],
  ["0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", "ETH"]
]);

export const decimalMap: Map<string, number> = new Map([
    [ETH.toString(), 9],
    [SOL.toString(), 9],
    [USDT.toString(), 6],
    [USDC.toString(), 6],
    ["0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", 6],
    ["0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", 6],
    ["0xa219439258ca9da29e9cc4ce5596924745e12b93", 6],
    ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6],
    ["0xaf88d065e77c8cc2239327c5edb3a432268e5831", 6],
    ["0x0b2c639c533813f4aa9d7837caf62653d097ff85", 6],
    ["0x176211869ca2b568f2a7d4ee941e073a821ee1ff", 6],
    ["0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", 6],
    ["0x4200000000000000000000000000000000000006", 6],
    ["0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", 6],
    ["0x4200000000000000000000000000000000000006", 18],
    ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
    ["0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", 18],
    ["11111111111111111111111111111111", 9],
    ["0x0000000000000000000000000000000000000000", 18]
]);

export const validPairsMap: Map<string, Set<string>> = new Map([
    [
      "Solar",
      new Set([
        `${ETH.toString()}_${USDC.toString()}`,
        `${USDC.toString()}_${ETH.toString()}`,
      ])
    ],
    [
      "Orca",
      new Set([
        `${ETH.toString()}_${USDC.toString()}`,
        `${USDC.toString()}_${ETH.toString()}`,
        `${USDT.toString()}_${ETH.toString()}`,
        `${ETH.toString()}_${USDT.toString()}`,
        `${USDC.toString()}_${SOL.toString()}`,
        `${SOL.toString()}_${USDC.toString()}`,
        `${USDT.toString()}_${SOL.toString()}`,
        `${SOL.toString()}_${USDT.toString()}`,
        `${SOL.toString()}_${ETH.toString()}`,
        `${ETH.toString()}_${SOL.toString()}`
      ])
    ],
    [
      "Lifinity",
      new Set([
        `${USDC.toString()}_${SOL.toString()}`,
        `${SOL.toString()}_${USDC.toString()}`,
      ])
    ]
  ]);
  

export const chainIdsMap: Map<string, number> = new Map([
    ["arb", 42161],
    ["op", 10],
    ["linea", 59144],
    ["eclipse", 9286185],
    ["base", 8453],
    ["sol",792703809]
])

export const relayTokensMap: Map<string, Map<string, string>> = new Map([
    ["arb", new Map([["usdt", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9"], ["usdc", "0xaf88d065e77c8cc2239327c5edb3a432268e5831"], ["eth", "0x0000000000000000000000000000000000000000"]])],
    ["op", new Map([["usdt", "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58"], ["usdc", "0x0b2c639c533813f4aa9d7837caf62653d097ff85"], ["eth", "0x0000000000000000000000000000000000000000"]])],
    ["linea", new Map([["usdt", "0xa219439258ca9da29e9cc4ce5596924745e12b93"], ["usdc", "0x176211869ca2b568f2a7d4ee941e073a821ee1ff"], ["eth", "0x0000000000000000000000000000000000000000"]])],
    ["base", new Map([["usdc", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"], ["usdt", "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2"], ["eth", "0x0000000000000000000000000000000000000000"]])],
    ["eclipse", new Map([["eth", "11111111111111111111111111111111"]])]
])


export const ActionLimiter: Map<string, number> = new Map([
  ["Relay", 1],
  ["Collector", 3]
])

// Access data from different threads. 
export const globalMutex = new Mutex();

export let minEthBalanceForSwap: number = 0.0001;
export let minSolBalanceForSwap: number = 0.001;