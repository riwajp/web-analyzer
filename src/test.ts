import fs from "fs";
import { detectTechnology } from "./index";
import path from "path";

const technology_names = Object.keys(
  JSON.parse(fs.readFileSync("src/data/technologies.json", "utf-8"))
);

export function getTestSitesData(
  technology_names: string[],
  dir: string
): Record<string, string[]> {
  const urlToTechs: Record<string, string[]> = {};

  for (const tech of technology_names) {
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

const test_sites: Record<string, string[]> = getTestSitesData(
  technology_names,
  "src/get-urls/output"
);

console.log(test_sites);

// Run tests and benchmark
const results: any = [];
let count = 0;

(async () => {
  for (const url of Object.keys(test_sites)) {
    const expected = test_sites[url];

    try {
      const detection_results = await detectTechnology("https://" + url);

      const falsePositives = detection_results.technologies.filter(
        (d) => !expected.includes(d.name)
      );
      const missed = expected.filter(
        (e) => !detection_results.technologies.find((d) => d.name == e)
      );

      results.push({
        url,
        expected,
        detection_results: detection_results,
        falsePositives,
        missed,
        match:
          expected.length === detection_results.technologies.length &&
          falsePositives.length === 0,
      });

      console.log(`Processed ${url}`);
    } catch (err) {
      console.error(`Error processing ${url}:`, err);
      results.push({
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    count++;

    // Save every 20 URLs
    if (count % 20 === 0) {
      fs.writeFileSync("test_results-1.json", JSON.stringify(results, null));
      console.log(`Saved progress after ${count} sites.`);
    }
  }

  // Write results
  fs.writeFileSync("test_results-1.json", JSON.stringify(results, null));
  console.log("Test results saved to test_results-1.json");
})();
