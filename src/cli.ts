import fs from "fs";
import { WebAnalyzer } from "./lib/webanalyzer";
import type { DetectionConfig } from "./types";

async function main() {
  const args = process.argv.slice(2);

  const url = args[0];
  const detectBlocking = args.includes("--detect-blocking");
  const saveToFile = args.includes("-save");

  const config: Partial<DetectionConfig> = {
    mode: "LOOSE",
    includeRawData: false,
    blockingDetectionEnabled: detectBlocking,
  };

  try {
    console.log(`URL: ${url}`);
    console.log(`Detect blocking? ${detectBlocking ? "Yes" : "No"}`);
    console.log(`Save to file? ${saveToFile ? "Yes" : "No"}`);
    console.log(`===============================`);
    console.log("Runnig detections....");

    WebAnalyzer.init(["src/data/tech.json"], config);

    const result = await WebAnalyzer.analyze(url);
    if (result == null) {
      console.log("There was an error during processing.");
      process.exit(1);
    }

    if (saveToFile) {
      fs.writeFileSync("result.json", JSON.stringify(result, null, 2), "utf-8");
      console.log(`Result saved to result.json`);
    }

    console.log(`\nRESULTS`);
    console.log(`===============================`);
    console.log(`URL: ${url}`);
    console.log(`Technologies Detected: ${result.stats?.total || 0}`);

    console.log(`Average Confidence: ${result.stats.averageConfidence}%`);
    console.log(`\nDetected Technologies: `);
    if (result.technologies.length === 0) {
      console.log(`None detected`);
    } else {
      result.technologies.forEach((tech) =>
        console.log(`\t-${tech.name} [Confidence: ${tech.confidence}%]`)
      );
    }

    if (detectBlocking) {
      console.log(
        `\nLikely Blocked: ${
          result.blockingIndicators?.likelyBlocked ? "Yes" : "No"
        }`
      );
    }
    console.log(`===============================`);
  } catch (error) {
    console.log("There was an error during processing.");
    console.error(error);
    process.exit(1);
  }
}

main();
