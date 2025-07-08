"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestSitesData = getTestSitesData;
var path_1 = require("path");
var fs_1 = require("fs");
function getTestSitesData(technology_names, dir) {
    var urlToTechs = {};
    for (var _i = 0, technology_names_1 = technology_names; _i < technology_names_1.length; _i++) {
        var tech = technology_names_1[_i];
        var filePath = path_1.default.join(dir, "websitelist_".concat(tech, ".csv"));
        if (!fs_1.default.existsSync(filePath)) {
            console.warn("Missing file: ".concat(filePath));
            continue;
        }
        var lines = fs_1.default
            .readFileSync(filePath, "utf-8")
            .split("\n")
            .map(function (line) { return line.trim().replace(/^"|"$/g, ""); }) // remove quotes
            .filter(Boolean); // ignore blank lines
        for (var _a = 0, lines_1 = lines; _a < lines_1.length; _a++) {
            var url = lines_1[_a];
            if (!urlToTechs[url]) {
                urlToTechs[url] = [];
            }
            urlToTechs[url].push(tech);
        }
    }
    return urlToTechs;
}
var technology_names = Object.keys(JSON.parse(fs_1.default.readFileSync("src/data/technologies.json", "utf-8")));
var dir = "src/get-urls/output";
var test_data = getTestSitesData(technology_names, dir);
// Write to JSONL
var jsonlPath = "src/data/technologies_test.jsonl";
var jsonlLines = Object.entries(test_data).map(function (_a) {
    var url = _a[0], technologies = _a[1];
    return JSON.stringify({ url: url, technologies: technologies });
});
fs_1.default.writeFileSync(jsonlPath, jsonlLines.join("\n"), "utf-8");
console.log("Saved JSONL to ".concat(jsonlPath));
