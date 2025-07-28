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
const webanalyzer_1 = require("./lib/webanalyzer");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const args = process.argv.slice(2);
        const url = args[0];
        const detectBlocking = args.includes("--detect-blocking");
        const saveToFile = args.includes("-save");
        const config = {
            mode: "LOOSE",
            includeRawData: false,
            blockingDetectionEnabled: detectBlocking,
        };
        try {
            console.log(`URL: ${url}`);
            console.log(`Detect blocking? ${detectBlocking ? "Yes" : "No"}`);
            console.log(`Save to file? ${saveToFile ? "Yes" : "No"}`);
            console.log(`===============================`);
            console.log("Runnig detections....");
            webanalyzer_1.WebAnalyzer.init(["src/data/tech.json"], config);
            const result = yield webanalyzer_1.WebAnalyzer.analyze(url);
            if (result == null) {
                console.log("There was an error during processing.");
                process.exit(1);
            }
            if (saveToFile) {
                fs_1.default.writeFileSync("result.json", JSON.stringify(result, null, 2), "utf-8");
                console.log(`Result saved to result.json`);
            }
            console.log(`\nRESULTS`);
            console.log(`===============================`);
            console.log(`URL: ${url}`);
            console.log(`Technologies Detected: ${((_a = result.stats) === null || _a === void 0 ? void 0 : _a.total) || 0}`);
            console.log(`Average Confidence: ${result.stats.averageConfidence}%`);
            console.log(`\nDetected Technologies: `);
            if (result.technologies.length === 0) {
                console.log(`None detected`);
            }
            else {
                result.technologies.forEach((tech) => console.log(`\t-${tech.name} [Confidence: ${tech.confidence}%]`));
            }
            if (detectBlocking) {
                console.log(`\nLikely Blocked: ${((_b = result.blockingIndicators) === null || _b === void 0 ? void 0 : _b.likelyBlocked) ? "Yes" : "No"}`);
            }
            console.log(`===============================`);
        }
        catch (error) {
            console.log("There was an error during processing.");
            console.error(error);
            process.exit(1);
        }
    });
}
main();
