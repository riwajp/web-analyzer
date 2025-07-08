import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";

const test_sites = JSON.parse(
  fs.readFileSync("src/data/technologies_test.json", "utf-8")
);

// Load old test results to find errored URLs
let erroredUrls: string[] = [];
try {
  erroredUrls = JSON.parse(
    fs.readFileSync("src/data/errored_urls.json", "utf-8")
  );
  console.log(`Excluded ${erroredUrls.length} URLs from previous errors.`);
} catch (e) {
  console.warn(
    "Errored URLs file not found or unreadable — continuing full scan."
  );
}

// Filter out errored URLs
const urls = Object.keys(test_sites).filter(
  (url) => !erroredUrls.includes(url)
);

const numWorkers = 8;
const chunkSize = Math.ceil(urls.length / numWorkers);

const results: any[] = [];
let completedWorkers = 0;

function runWorker(urlChunk: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, "worker.mjs"), {
      workerData: { urls: urlChunk },
    });

    worker.on("message", (workerResults) => {
      results.push(...workerResults);
    });

    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
      else resolve();
    });
  });
}

(async () => {
  const promises = [];

  for (let i = 0; i < numWorkers; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    const chunk = urls.slice(start, end);
    promises.push(runWorker(chunk));
  }

  await Promise.all(promises);

  // Save results after all workers finish
  fs.writeFileSync("test_results.json", JSON.stringify(results, null, 2));
  console.log("All workers done. Results saved.");
})();
