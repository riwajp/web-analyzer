import fs from "fs";
import path from "path";

export function getTestSitesData(
    technology_names: string[],
    dir: string
): Record<string, string[]> {
    const urlToTechs: Record<string, string[]> = {};

    for (const tech of technology_names) {
        const filePath = path.join(dir, `websitelist_${tech}.csv`);
        if (!fs.existsSync(filePath)) {
            console.warn(`Missing file: ${filePath}`);
            continue;
        }

        const lines = fs
            .readFileSync(filePath, "utf-8")
            .split("\n")
            .map((line) => line.trim().replace(/^"|"$/g, "")) // remove quotes
            .filter(Boolean); // ignore blank lines

        for (const url of lines) {
            if (!urlToTechs[url]) {
                urlToTechs[url] = [];
            }
            urlToTechs[url].push(tech);
        }
    }

    return urlToTechs;
}

const technology_names = Object.keys(
    JSON.parse(fs.readFileSync("src/data/technologies.json", "utf-8"))
);

const test_sites: Record<string, string[]> = getTestSitesData(
    technology_names,
    "src/get-urls/output"
);
console.log(test_sites.length);