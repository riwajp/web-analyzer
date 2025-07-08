import fs from "fs";
import path from "path";
const WebappalyzerJS = require('webappalyzer-js')

// Use only the first 10 technologies for testing
const technology_names = Object.keys(
    JSON.parse(fs.readFileSync("src/data/technologies.json", "utf-8"))
).slice(10, 20);

const test_sites: Record<string, string[]> = {};
for (const tech of technology_names) {
    const filePath = path.join("src/get-urls/output", `websitelist_${tech}.csv`);
    if (!fs.existsSync(filePath)) {
        console.warn(`Missing file: ${filePath}`);
        continue;
    }
    const lines = fs.readFileSync(filePath, "utf-8")
        .split("\n")
        .map(line => line.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    for (const url of lines) {
        if (!test_sites[url]) test_sites[url] = [];
        test_sites[url].push(tech);
    }
}
console.log(`Number of entries: ${Object.keys(test_sites).length}`);

const options = {
    debug: false,
    delay: 500,
    headers: {},
    maxDepth: 3,
    maxUrls: 10,
    maxWait: 5000,
    recursive: true,
    probe: false,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 2000,
    htmlMaxRows: 2000,
    noScripts: false,
    noRedirect: false,
};

const allUrls = Object.keys(test_sites);
const selectedUrls = allUrls;
console.log(`Processing URLs from index 121 to 499 (${selectedUrls.length} URLs)`);

// Load existing results if present
let results: any[] = [];
const resultsFile = 'wappalyzer_test_results.json';
if (fs.existsSync(resultsFile)) {
    try {
        results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
        if (!Array.isArray(results)) results = [];
        console.log(`Loaded ${results.length} previous results.`);
    } catch (e) {
        console.warn('Could not parse previous results, starting fresh.');
        results = [];
    }
}

(async function () {
    const wappalyzer = new WebappalyzerJS(options);
    let count = 0;
    try {
        await wappalyzer.init();
        for (const url of selectedUrls) {
            const expected = test_sites[url];
            const headers = {};
            const storage = { local: {}, session: {} };
            let detected: string[] = [];
            let error: string | undefined = undefined;
            try {
                const site = await wappalyzer.open('https://' + url, headers, storage);
                site.on('error', (err: any) => { error = err && err.message ? err.message : String(err); });
                const analysis = await site.analyze();
                detected = (analysis.technologies || []).map((t: any) => t.name);
                if (typeof site.close === 'function') {
                    await site.close();
                }
            } catch (err: any) {
                error = err && err.message ? err.message : String(err);
            }
            const falsePositives = detected.filter((d) => !expected.includes(d));
            const missed = expected.filter((e) => !detected.includes(e));
            results.push({
                url,
                expected,
                detected,
                falsePositives,
                missed,
                match: expected.length === detected.length && falsePositives.length === 0,
                error,
            });
            count++;
            if (count % 20 === 0) {
                fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
                console.log(`Saved progress after ${count} sites.`);
            }
            console.log(`Processed ${url}`);
        }
    } catch (error) {
        console.error(error);
    }
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log('Test results saved to wappalyzer_test_results.json');
    await wappalyzer.destroy();
})();