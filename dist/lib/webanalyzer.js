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
exports.WebAnalyzer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const webPage_1 = require("./webPage");
const analyzer_1 = require("./analyzer");
const technologyDetector_1 = require("./technologyDetector");
exports.WebAnalyzer = {
    initialized: false,
    technologies: {},
    detectionConfig: {
        mode: "LOOSE",
        fetchTimeout: 10000,
        blockingDetectionEnabled: true,
    },
    init(dataFiles = ["src/data/tech.json"], detectionConfig) {
        for (const file of dataFiles) {
            const filePath = path_1.default.resolve(file);
            const fileContent = fs_1.default.readFileSync(filePath, "utf-8");
            const technologiesFromFile = JSON.parse(fileContent);
            this.technologies = Object.assign(Object.assign({}, this.technologies), technologiesFromFile);
        }
        this.initialized = true;
        this.detectionConfig = Object.assign(Object.assign({}, this.detectionConfig), detectionConfig);
    },
    analyze(url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.initialized) {
                console.warn("WebAnalyzer was not initialized. Using default tech.json.");
                this.init(["src/tests/tech-test.json"]);
            }
            const webPage = new webPage_1.WebPage(url);
            const webPageData = yield webPage.extractData(this.detectionConfig.fetchTimeout);
            const detector = new technologyDetector_1.TechnologyDetector(this.technologies, this.detectionConfig.mode);
            const technologies = detector.detectTechnologies(webPageData);
            const analyzer = new analyzer_1.Analyzer(url, {
                includeRawData: this.detectionConfig.includeRawData,
                blockingDetectionEnabled: this.detectionConfig.blockingDetectionEnabled,
            });
            return yield analyzer.analyze(webPageData, technologies);
        });
    },
};
