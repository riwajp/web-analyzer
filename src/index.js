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
exports.detectTechnology = detectTechnology;
exports.appendToJSONL = appendToJSONL;
const webanalyzer_1 = __importDefault(require("./webanalyzer"));
const fs_1 = __importDefault(require("fs"));
const perf_hooks_1 = require("perf_hooks");
function ensureInitialized() {
    if (!webanalyzer_1.default.initialized) {
        // Load all technologies data
        webanalyzer_1.default.init(["src/data/technologies.json"]);
    }
}
// detect technology for a given URL
function detectTechnology(url) {
    return __awaiter(this, void 0, void 0, function* () {
        ensureInitialized();
        // timings for benchmarks
        const timings = {};
        try {
            timings.fetchStart = perf_hooks_1.performance.now();
            const url_data = yield webanalyzer_1.default.fetchURL(url);
            timings.afterFetch = perf_hooks_1.performance.now();
            const site_data = webanalyzer_1.default.parseSourceCode(url_data.source_code);
            timings.afterParse = perf_hooks_1.performance.now();
            const detected_technologies = webanalyzer_1.default.detectPatterns(site_data, url_data);
            timings.afterDetect = perf_hooks_1.performance.now();
            const result = {
                url,
                technologies: detected_technologies,
                timings: {
                    fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
                    parse: +(timings.afterParse - timings.afterFetch).toFixed(2),
                    detect: +(timings.afterDetect - timings.afterParse).toFixed(2),
                    total: +(timings.afterDetect - timings.fetchStart).toFixed(2),
                },
            };
            console.log("Detected for:", url);
            return result;
        }
        catch (error) {
            console.error(`Error processing ${url}:`, error);
            throw error;
        }
    });
}
// Append result to a JSONL file
function appendToJSONL(filePath, entry) {
    const jsonLine = JSON.stringify(entry) + "\n";
    fs_1.default.appendFileSync(filePath, jsonLine, "utf-8");
}
const urls = [
    "https://www.cloudflare.com/",
    "https://vercel.com/",
    "https://unsplash.com/",
    "https://laterical.com/",
    "https://riwaj-tetris-game.netlify.app/",
    "https://www.linkedin.com/feed/",
    "https://github.com/",
    "https://www.figma.com/",
    "https://www.booking.com/",
    "https://chatgpt.com/",
    "https://huggingface.co/",
];
const outputFile = "detected_technologies.jsonl";
(() => __awaiter(void 0, void 0, void 0, function* () {
    for (const url of urls) {
        try {
            const result = yield detectTechnology(url);
            appendToJSONL(outputFile, result);
        }
        catch (error) {
            console.log(`Error processing URL:${url}`, error);
            throw error;
        }
    }
    console.log(`All results saved to ${outputFile}`);
}))();
