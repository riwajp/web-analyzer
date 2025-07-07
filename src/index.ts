import WebAnalyzer from "./webanalyzer";
import fs from "fs";
import { performance } from "perf_hooks";
import type { TechnologiesMap, DetectionResult } from "./types";

function ensureInitialized() {
  if (!WebAnalyzer.initialized) {
    // Load all technologies data
    WebAnalyzer.init(["src/data/technologies.json"]);
  }
}
// detect technology for a given URL
export async function detectTechnology(url: string): Promise<DetectionResult> {
  ensureInitialized();

  // timings for benchmarks
  const timings: Record<string, number> = {};

  try {
    timings.fetchStart = performance.now();
    const url_data = await WebAnalyzer.fetchURL(url);
    timings.afterFetch = performance.now();

    const site_data = WebAnalyzer.parseSourceCode(url_data.source_code);
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
    throw error;
  }
}

// Append result to a JSONL file
export function appendToJSONL(filePath: string, entry: DetectionResult): void {
  const jsonLine = JSON.stringify(entry) + "\n";
  fs.appendFileSync(filePath, jsonLine, "utf-8");
}

const urls = [
  "https://www.cloudflare.com/",
  "https://vercel.com/",
  "https://unsplash.com/",
  "https://laterical.com/",
  "https://riwaj-tetris-game.netlify.app/",
  "https://www.linkedin.com/feed/",
  "https://github.com/",
  "https://www.figma.com/",
  "https://www.booking.com/",
  "https://chatgpt.com/",
  "https://huggingface.co/",
];

const outputFile = "detected_technologies.jsonl";

(async () => {
  for (const url of urls) {
    try {
      const result = await detectTechnology(url);
      appendToJSONL(outputFile, result);
    } catch (error) {
      console.log(`Error processing URL:${url}`, error);
      throw error;
    }
  }

  console.log(`All results saved to ${outputFile}`);
})();
