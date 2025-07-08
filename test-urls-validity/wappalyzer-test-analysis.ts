import fs from "fs";

interface WappalyzerTestResult {
    url: string;
    expected: string[];
    detected: string[];
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

const data: WappalyzerTestResult[] = JSON.parse(
    fs.readFileSync("wappalyzer_test_results.json", "utf-8")
);
console.log(`Loaded entries: ${data.length}`);

let skipped = 0;
let firstValid: WappalyzerTestResult | undefined = undefined;
const stats: Record<string, TechStats> = {};

for (const entry of data) {
    // if (entry.error) {
    // skipped++;
    // continue;
    // }
    if (!firstValid) firstValid = entry;
    for (const tech of entry.expected) {
        if (!stats[tech]) {
            stats[tech] = { total: 0, detected: 0, missed: 0 };
        }
        stats[tech].total++;
        const isDetected = entry.detected.includes(tech);
        if (isDetected) {
            stats[tech].detected++;
        } else {
            stats[tech].missed++;
        }
    }
}

console.log(`Skipped due to error: ${skipped}`);
if (firstValid) {
    console.log('Sample valid entry:', JSON.stringify(firstValid, null, 2));
} else {
    console.log('No valid entries found.');
}

const report = Object.entries(stats).map(
    ([tech, { total, detected, missed }]) => ({
        tech,
        total,
        detected,
        missed,
        detectionRate: +(detected / total).toFixed(2),
        missRate: +(missed / total).toFixed(2),
    })
);

report.sort((a, b) => b.missRate - a.missRate);

console.table(report);

fs.writeFileSync(
    "wappalyzer_tech_detection_analysis.json",
    JSON.stringify(report, null, 2)
);
