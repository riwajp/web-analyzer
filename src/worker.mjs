import { parentPort, workerData } from "worker_threads";
import { detectTechnology } from "./index.js";

async function run() {
  const urls = workerData.urls;
  const results = [];

  for (const url of urls) {
    try {
      const detection_results = await detectTechnology("https://" + url);

      results.push({
        url,
        detection_results,
      });
    } catch (err) {
      results.push({
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Send results back to main thread
  parentPort?.postMessage(results);
}

run();
