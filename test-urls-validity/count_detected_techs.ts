import fs from "fs";

// Load technology names
const technology_names = Object.keys(
    JSON.parse(fs.readFileSync("src/data/technologies.json", "utf-8"))
);

// Load detected techs per URL
const detectedData = JSON.parse(fs.readFileSync("wappalyzer_detected_techs.json", "utf-8"));

// Count occurrences
const counts: Record<string, number> = {};
for (const tech of technology_names) {
    counts[tech] = 0;
}
for (const entry of detectedData) {
    for (const tech of entry.techs) {
        if (counts.hasOwnProperty(tech)) {
            counts[tech]++;
        }
    }
}

// Prepare and print sorted result
const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tech, count]) => ({ tech, count }));

console.table(result);

// Optionally save to file
fs.writeFileSync("wappalyzer_detected_techs_counts.json", JSON.stringify(result, null, 2));
