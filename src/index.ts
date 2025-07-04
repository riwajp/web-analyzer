import WebAnalyzer from "./webanalyzer";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import type { TechnologiesMap } from "./types";

let technologies: TechnologiesMap = {};

// Load all technology data from JSON files in the technologies directory
for (const index of Array(27).keys()) {
  const character = index ? String.fromCharCode(index + 96) : "_";

  technologies = {
    ...technologies,
    ...JSON.parse(
      fs.readFileSync(
        path.resolve(`${__dirname}/technologies/${character}.json`),
        "utf-8"
      )
    ),
  };
}

WebAnalyzer.technologies = technologies;

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
const stream = fs.createWriteStream(outputFile, { flags: "w" });

(async () => {
  for (const url of urls) {
    const timings: Record<string, number> = {};

    try {
      // fetch the URL for source code and headers
      timings.fetchStart = performance.now();
      const url_data = await WebAnalyzer.fetchURL(url);
      timings.afterFetch = performance.now();

      // parse the code to detect components
      const site_data = WebAnalyzer.parseSourceCode(url_data.source_code);
      timings.afterParse = performance.now();

      // detect technologies using the parsed data
      const detected_technologies = WebAnalyzer.detectPatterns(
        site_data,
        url_data
      );
      timings.afterDetect = performance.now();

      // ==============================================================================
      // For logging purposes ==========================================================
      const techInfo = Object.entries(detected_technologies)
        .filter(([_, data]) => data.cats && data.cats.includes(16))
        .map(([name, data]) => ({
          name,
          detectedUsing: data.detectedUsing || null,
        }));

      const jsonlEntry = {
        url,
        technologies: techInfo,
        timings: {
          fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
          parse: +(timings.afterParse - timings.afterFetch).toFixed(2),
          detect: +(timings.afterDetect - timings.afterParse).toFixed(2),
          total: +(timings.afterDetect - timings.fetchStart).toFixed(2),
        },
      };

      stream.write(JSON.stringify(jsonlEntry) + "\n");
      console.log(`Processed: ${url}`);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }

  stream.end(() => {
    console.log(`Done! Results saved to ${outputFile}`);
  });
})();
