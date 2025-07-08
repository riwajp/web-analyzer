import fs from "fs";
import path from "path";
import { detectTechnology } from "./index"; // Assumes JS export

// Read input JSON: { tech1: [...urls], tech2: [...urls] }
const data: any[] = JSON.parse(
  fs.readFileSync("src/data/output.json", "utf-8")
);

// Flatten all domain arrays into one list
const urls: string[] = Object.values(data).flat();

async function detectOnUrl(url: string) {
  console.log(`🔍 Detecting technologies on ${url}...`);
  try {
    const detection_results = await detectTechnology(`https://${url}`);
    return {
      url,
      detection_results,
    };
  } catch (err) {
    console.warn(
      `⚠️  Error on ${url}: ${err instanceof Error ? err.message : err}`
    );
    return {
      url,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function run() {
  const results: any[] = [];

  for (let i = 0; i < urls.length; i++) {
    const result = await detectOnUrl(urls[i]);
    results.push(result);

    // Save after every 10 URLs
    if ((i + 1) % 10 === 0 || i === urls.length - 1) {
      fs.writeFileSync("test_results.json", JSON.stringify(results, null, 2));
      console.log(`💾 Progress saved after ${i + 1} URLs`);
    }
  }

  console.log(
    `✅ Finished. ${results.length} URLs processed. Results saved to test_results.json`
  );
}

run();
