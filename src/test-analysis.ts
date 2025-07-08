import fs from "fs";
import type { DetectionResult } from "./types";

interface TestResult {
  url: string;
  expected: string[];
  detection_results: DetectionResult;
  falsePositives: string[];
  missed: string[];
  match: boolean;
  error?: string;
}

interface TechStats {
  total: number;
  detected: number;
  missed: number;
}

const rawGroundTruth: Record<string, string[]> = JSON.parse(
  fs.readFileSync("src/data/technologies_test.json", "utf-8")
);

const test_sites: Record<string, string[]> = {};

for (const [tech, urls] of Object.entries(rawGroundTruth)) {
  for (const url of urls) {
    if (!test_sites[url]) test_sites[url] = [];
    test_sites[url].push(tech);
  }
}

const raw_test_results: Partial<TestResult>[] = JSON.parse(
  fs.readFileSync("src/data/test_results.json", "utf-8")
);

const enriched_results: TestResult[] = [];

for (const entry of raw_test_results) {
  const url = entry.url!;
  const expected = test_sites[url] || [];

  if (entry.error || !entry.detection_results) {
    enriched_results.push({
      url,
      expected,
      detection_results: entry.detection_results!,
      falsePositives: [],
      missed: [],
      match: false,
      error: entry.error,
    });
    continue;
  }

  const detectedNames = entry.detection_results.technologies.map((t) => t.name);
  const falsePositives = detectedNames.filter((d) => !expected.includes(d));
  const missed = expected.filter((e) => !detectedNames.includes(e));

  enriched_results.push({
    url,
    expected,
    detection_results: entry.detection_results,
    falsePositives,
    missed,
    match:
      expected.length === detectedNames.length && falsePositives.length === 0,
  });
}

fs.writeFileSync(
  "src/test_results_analysis.json",
  JSON.stringify(enriched_results, null, 2)
);

const stats: Record<string, TechStats> = {};

for (const entry of enriched_results) {
  if (entry.error) continue;

  for (const tech of entry.expected) {
    if (!stats[tech]) stats[tech] = { total: 0, detected: 0, missed: 0 };
    stats[tech].total++;

    const isDetected = entry.detection_results.technologies.some(
      (t) => t.name === tech
    );
    if (isDetected) stats[tech].detected++;
    else stats[tech].missed++;
  }
}

const report = Object.entries(stats).map(([tech, s]) => ({
  tech,
  total: s.total,
  detected: s.detected,
  missed: s.missed,
  detectionRate: +(s.detected / s.total).toFixed(2),
  missRate: +(s.missed / s.total).toFixed(2),
}));

report.sort((a, b) => b.missRate - a.missRate);

console.table(report);

fs.writeFileSync("test_results_stats.json", JSON.stringify(report, null, 2));
