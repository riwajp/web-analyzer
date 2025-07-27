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
const utils_1 = require("./utils");
const filePath = path_1.default.resolve("src/data/tech.json");
const fileContent = fs_1.default.readFileSync(filePath, "utf-8");
const technologies = JSON.parse(fileContent);
describe("webPage", () => {
    const extractedWebPagesData = {};
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        for (const [techName, techData] of Object.entries(technologies)) {
            const mockFetchResponse = (0, utils_1.mockFetchForTech)(techName, techData);
            global.fetch = jest.fn().mockResolvedValueOnce(mockFetchResponse);
            const webPage = new webPage_1.WebPage((0, utils_1.getUrlForTech)(techName));
            const webPageData = yield webPage.extractData();
            extractedWebPagesData[techName] = webPageData;
        }
    }));
    it("extracts header correctly", () => {
        var _a;
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.headers)
                continue;
            const webPageData = extractedWebPagesData[techName];
            for (const [headerKey, pattern] of Object.entries(techData.headers)) {
                expect(webPageData.headers.has(headerKey)).toBe(true);
                expect(RegExp(pattern).test((_a = webPageData.headers.get(headerKey)) !== null && _a !== void 0 ? _a : "")).toBe(true);
            }
        }
    });
    it("extracts cookies correctly", () => {
        var _a;
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.cookies)
                continue;
            const webPageData = extractedWebPagesData[techName];
            for (const [cookieName, pattern] of Object.entries(techData.cookies)) {
                expect(webPageData.cookies[cookieName]).toBeDefined();
                expect(RegExp(pattern).test((_a = webPageData.cookies[cookieName]) !== null && _a !== void 0 ? _a : "")).toBe(true);
            }
        }
    });
    it("extracts inline JS correctly", () => {
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.js)
                continue;
            const webPageData = extractedWebPagesData[techName];
            for (const jsString of techData.js) {
                expect(webPageData.js.some((js) => js.includes(jsString))).toBe(true);
            }
        }
    });
    it("extracts HTML correctly", () => {
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.html)
                continue;
            const webPageData = extractedWebPagesData[techName];
            for (const html of techData.html) {
                expect(webPageData.sourceCode).toContain(html);
            }
        }
    });
    it("extracts scriptSrc correctly", () => {
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.scriptSrc)
                continue;
            const webPageData = extractedWebPagesData[techName];
            for (const scriptUrlPattern of techData.scriptSrc) {
                expect(webPageData.scriptSrc.some((src) => RegExp(scriptUrlPattern).test(src))).toBe(true);
            }
        }
    });
    it("extracts DOM elements correctly", () => {
        for (const [techName, techData] of Object.entries(technologies)) {
            if (!techData.dom)
                continue;
            const webPageData = extractedWebPagesData[techName];
            for (const selector of Object.keys(techData.dom)) {
                expect(webPageData.dom.window.document.querySelector(selector)).not.toBeNull();
            }
        }
    });
});
