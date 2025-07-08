import path from "path";
import fs from "fs";
import { TechnologiesMap } from "../types";

export function getTestSitesData(
  filtered_technologies_names: string[],
  dir: string
): Record<string, string[]> {
  const urlToTechs: Record<string, string[]> = {};

  for (const tech of filtered_technologies_names) {
    const filePath = path.join(dir, `websitelist_${tech}.csv`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing file: ${filePath}`);
      continue;
    }

    const lines = fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .map((line) => line.trim().replace(/^"|"$/g, "")) // remove quotes
      .filter(Boolean); // ignore blank lines

    for (const url of lines) {
      if (!urlToTechs[url]) {
        urlToTechs[url] = [];
      }
      urlToTechs[url].push(tech);
    }
  }

  return urlToTechs;
}

const technologies: TechnologiesMap = JSON.parse(
  fs.readFileSync("./data/technologies.json", "utf-8")
);

const filtered_technologies_names = Object.keys(technologies).filter(
  (tech: any) =>
    technologies[tech].dom ||
    technologies[tech].js ||
    technologies[tech].scriptSrc ||
    technologies[tech].meta ||
    technologies[tech].cookies ||
    technologies[tech].headers
);

const filtered_technologies: TechnologiesMap = {};

for (const tech of filtered_technologies_names) {
  filtered_technologies[tech] = technologies[tech];
}

// Write filtered technologies to new JSON file
const outputPath = "filtered_technologies.json";
fs.writeFileSync(
  outputPath,
  JSON.stringify(filtered_technologies, null, 2),
  "utf-8"
);

console.log(`Filtered technologies saved to ${outputPath}`);

const dir = "./get-urls/output";

const test_data = getTestSitesData(filtered_technologies_names, dir);

// Write to JSON
const jsonPath = "./technologies_test.json";
fs.writeFileSync(jsonPath, JSON.stringify(test_data, null, 2), "utf-8");

console.log(`Saved JSON to ${jsonPath}`);
