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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const webPage_1 = require("../lib/webPage");
const technologyDetector_1 = require("../lib/technologyDetector");
const utils_1 = require("./utils");
const confidence_constants_1 = require("../confidence-constants");
const filePath = path_1.default.resolve("src/data/tech-test.json");
const fileContent = fs_1.default.readFileSync(filePath, "utf-8");
const technologies = JSON.parse(fileContent);
describe("technologyDetector", () => {
    const detectedTechnologiesMap = {};
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        for (const [techName, techData] of Object.entries(technologies)) {
            const mockFetchResponse = (0, utils_1.mockFetchForTech)(techName, techData);
            global.fetch = jest.fn().mockResolvedValueOnce(mockFetchResponse);
            const webPage = new webPage_1.WebPage((0, utils_1.getUrlForTech)(techName));
            const webPageData = yield webPage.extractData();
            const detector = new technologyDetector_1.TechnologyDetector(technologies, "NORMAL");
            const results = detector.detectTechnologies(webPageData);
            detectedTechnologiesMap[techName] = results;
        }
    }));
    it("detects expected technologies with minimum confidence", () => {
        for (const [techName] of Object.entries(technologies)) {
            const results = detectedTechnologiesMap[techName];
            const detected = results.find((r) => r.name === techName);
            expect(detected).toBeDefined();
            expect(detected === null || detected === void 0 ? void 0 : detected.confidence).toBeGreaterThanOrEqual(confidence_constants_1.TECH_DETECTION_MODE_CONFIDENCE.NORMAL);
        }
    });
    it("includes expected detection sources for detected technologies", () => {
        for (const [techName, techData] of Object.entries(technologies)) {
            const results = detectedTechnologiesMap[techName];
            const detected = results.find((r) => r.name === techName);
            if (!detected)
                continue;
            const expectedSources = Object.keys(techData).filter((key) => ["js", "scriptSrc", "headers", "cookies", "html", "dom"].includes(key));
            for (const expectedSource of expectedSources) {
                expect(detected.detectedUsing).toContain(expectedSource);
            }
        }
    });
    it("resolves implied and required technologies", () => {
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.implies && !techData.requires)
                continue;
            const results = detectedTechnologiesMap[techName];
            const detectedNames = results.map((r) => r.name);
            const expectedTechnologies = new Set([techName]);
            const expand = (techNames) => {
                var _a, _b;
                for (const name of techNames) {
                    if (!expectedTechnologies.has(name)) {
                        expectedTechnologies.add(name);
                        const impliedTech = (_a = technologies[name]) === null || _a === void 0 ? void 0 : _a.implies;
                        const requiredTech = (_b = technologies[name]) === null || _b === void 0 ? void 0 : _b.requires;
                        if (impliedTech) {
                            expand(Array.isArray(impliedTech) ? impliedTech : [impliedTech]);
                        }
                        if (requiredTech) {
                            expand(Array.isArray(requiredTech) ? requiredTech : [requiredTech]);
                        }
                    }
                }
            };
            ["implies", "requires"].forEach((key) => {
                const transitiveTechs = techData[key];
                if (transitiveTechs) {
                    const transitiveTechsList = Array.isArray(transitiveTechs)
                        ? transitiveTechs
                        : [transitiveTechs];
                    expand(transitiveTechsList);
                }
            });
            for (const name of expectedTechnologies) {
                expect(detectedNames).toContain(name);
            }
        }
    });
    it("returns sorted results by confidence", () => {
        for (const [, results] of Object.entries(detectedTechnologiesMap)) {
            const confidences = results.map((r) => r.confidence);
            const sorted = [...confidences].sort((a, b) => b - a);
            expect(confidences).toEqual(sorted);
        }
    });
});
