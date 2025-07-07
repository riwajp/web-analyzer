import fs from "fs";
import { detectTechnology } from "./index";

// Load the technologies test data
const test_sites: Record<string, string[]> = JSON.parse(
  fs.readFileSync("src/data/technologies_test.json", "utf-8")
);

// Run tests and benchmark
const results = [];

(async () => {
  for (const url of Object.keys(test_sites)) {
    const expected = test_sites[url];

    try {
      const detection_results = await detectTechnology(url);

      const falsePositives = detection_results.technologies.filter(
        (d) => !expected.includes(d.name)
      );
      const missed = expected.filter((e) =>
        detection_results.technologies.find((d) => d.name == e)
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
  }

  // Write results
  fs.writeFileSync("test_results.json", JSON.stringify(results, null));
  console.log("Test results saved to test_results.json");
})();
