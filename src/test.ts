import fs from "fs";
import { detectTechnology } from "./index";

const test_sites = JSON.parse(
  fs.readFileSync("src/data/technologies_test.json", "utf-8")
);

console.log(test_sites);

// Run tests and benchmark
const results: any = [];
let count = 0;

(async () => {
  for (const url of Object.keys(test_sites)) {
    const expected: string[] = test_sites[url];

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
