import { detectTechnology } from "./index";
import fs from "fs";
import path from "path";

const testCasesPath = path.resolve("src/data/expected_technologies.json");
const testCases: Array<{ url: string; expected: string }> = JSON.parse(
  fs.readFileSync(testCasesPath, "utf-8")
);

const outputFile = path.resolve("src/data/test_results.json");

async function runTests() {
  const results = [];
  let passCount = 0;

  for (const { url, expected } of testCases) {
    console.log(`\nTesting: ${url} (expecting: ${expected})`);
    try {
      const result = await detectTechnology(url);
      const detectedNames = (result.technologies || []).map((t) => t.name);
      const detected = detectedNames.includes(expected);
      if (detected) passCount++;
      results.push({
        url,
        expected,
        detected: detectedNames,
        pass: detected,
      });
      console.log(
        detected
          ? `PASS: Detected ${expected}`
          : `FAIL: Detected [${detectedNames.join(", ")}]`
      );
    } catch (error: any) {
      results.push({ url, expected, detected: [], pass: false, error: error?.message || String(error) });
      console.log(`ERROR: ${error}`);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nSummary: ${passCount}/${testCases.length} passed.`);
  console.log(`Results saved to ${outputFile}`);
}

runTests();
