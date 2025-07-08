"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const index_1 = require("./index");
const test_data_converter_1 = require("./utils/test_data_converter");
const technology_names = Object.keys(JSON.parse(fs_1.default.readFileSync("src/data/technologies.json", "utf-8")));
const test_sites = (0, test_data_converter_1.getTestSitesData)(technology_names, "src/get-urls/output");
console.log(test_sites);
// Run tests and benchmark
const results = [];
let count = 0;
(() => __awaiter(void 0, void 0, void 0, function* () {
    for (const url of Object.keys(test_sites)) {
        const expected = test_sites[url];
        try {
            const detection_results = yield (0, index_1.detectTechnology)("https://" + url);
            const falsePositives = detection_results.technologies.filter((d) => !expected.includes(d.name));
            const missed = expected.filter((e) => !detection_results.technologies.find((d) => d.name == e));
            results.push({
                url,
                expected,
                detection_results: detection_results,
                falsePositives,
                missed,
                match: expected.length === detection_results.technologies.length &&
                    falsePositives.length === 0,
            });
            console.log(`Processed ${url}`);
        }
        catch (err) {
            console.error(`Error processing ${url}:`, err);
            results.push({
                url,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        count++;
        // Save every 20 URLs
        if (count % 20 === 0) {
            fs_1.default.writeFileSync("test_results-1.json", JSON.stringify(results, null));
            console.log(`Saved progress after ${count} sites.`);
        }
    }
    // Write results
    fs_1.default.writeFileSync("test_results-1.json", JSON.stringify(results, null));
    console.log("Test results saved to test_results-1.json");
}))();
