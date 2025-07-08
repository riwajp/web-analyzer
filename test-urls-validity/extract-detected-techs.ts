import fs from "fs";

const inputFile = "wappalyzer_test_results.json";
const outputFile = "wappalyzer_detected_techs.json";

const data = JSON.parse(fs.readFileSync(inputFile, "utf-8"));

const detectedList = data.map((entry: any) => ({
    url: entry.url,
    techs: Array.isArray(entry.detected) ? entry.detected : []
}));

fs.writeFileSync(outputFile, JSON.stringify(detectedList, null, 2));
console.log(`Wrote detected techs for ${detectedList.length} URLs to ${outputFile}`);
