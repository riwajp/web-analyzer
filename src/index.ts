import WebAnalyzer from "./webanalyzer";
import fs from "fs";
import { performance } from "perf_hooks";
import type { TechnologiesMap, DetectionResult } from "./types";

function ensureInitialized() {
  if (!WebAnalyzer.initialized) {
    WebAnalyzer.init(["src/data/tech.json"]);
  }
}

export async function detectTechnology(url: string): Promise<DetectionResult> {
  ensureInitialized();
  console.log(`Detecting technologies for: ${url}`);

  const timings: Record<string, number> = {};

  try {
    timings.fetchStart = performance.now();
    const url_data = await WebAnalyzer.fetchURL(url);
    timings.afterFetch = performance.now();

    const site_data = await WebAnalyzer.parseSourceCode(url_data.source_code, url);
    timings.afterParse = performance.now();

    const detected_technologies = WebAnalyzer.detectPatterns(
      site_data,
      url_data
    );

    timings.afterDetect = performance.now();

    const result: DetectionResult = {
      url,
      technologies: detected_technologies,
      timings: {
        fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
        parse: +(timings.afterParse - timings.afterFetch).toFixed(2),
        detect: +(timings.afterDetect - timings.afterParse).toFixed(2),
        total: +(timings.afterDetect - timings.fetchStart).toFixed(2),
      },
    };

    console.log("Detected for:", url);

    return result;
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return {} as DetectionResult;  
  }
}

export function appendToJSONL(filePath: string, entry: DetectionResult): void {
  const jsonLine = JSON.stringify(entry) + "\n";
  fs.appendFileSync(filePath, jsonLine, "utf-8");
}

const urls = [
  "https://www.godaddy.com/"
];

const outputFile = "detected_technologies.jsonl";

(async () => {
  for (const url of urls) {
    try {
      const result = await detectTechnology(url);
      if (!result) {
        console.log(`No result for URL: ${url}`);
        continue;
      }
      appendToJSONL(outputFile, result);
    } catch (error) {
      console.log(`Error processing URL:${url}`, error);
      throw error;
    }
  }

  console.log(`All results saved to ${outputFile}`);
})();
