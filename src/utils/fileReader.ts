import * as fs from "fs/promises";

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