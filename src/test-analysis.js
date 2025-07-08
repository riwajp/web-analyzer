"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const data = JSON.parse(fs_1.default.readFileSync("test_results-1.json", "utf-8"));
const stats = {};
for (const entry of data) {
    if (entry.error)
        continue;
    for (const tech of entry.expected) {
        if (!stats[tech]) {
            stats[tech] = { total: 0, detected: 0, missed: 0 };
        }
        stats[tech].total++;
        const isDetected = entry.detection_results.technologies.some((t) => t.name === tech);
        if (isDetected) {
            stats[tech].detected++;
        }
        else {
            stats[tech].missed++;
        }
    }
}
// Convert stats to include rate calculations
const report = Object.entries(stats).map(([tech, { total, detected, missed }]) => ({
    tech,
    total,
    detected,
    missed,
    detectionRate: +(detected / total).toFixed(2),
    missRate: +(missed / total).toFixed(2),
}));
// Sort by miss rate descending
report.sort((a, b) => b.missRate - a.missRate);
// Output the analysis
console.table(report);
// Optional: save to file
fs_1.default.writeFileSync("tech_detection_analysis.json", JSON.stringify(report, null, 2));
