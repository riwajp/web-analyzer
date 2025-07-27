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
Object.defineProperty(exports, "__esModule", { value: true });
const analyzer_1 = require("../lib/analyzer");
const utils_1 = require("./utils");
describe("Analyzer", () => {
    it("detects captcha and challenge with correct blocking indicators and page analysis", () => __awaiter(void 0, void 0, void 0, function* () {
        const url = "https://blocked.com";
        const analyzer = new analyzer_1.Analyzer(url, { blockingDetectionEnabled: true });
        const webPageData = (0, utils_1.generateMockWebPageData)({
            bodyDomElementCount: 8,
            statusCode: 403,
            textContentLength: 200,
            hasCaptchaElement: true,
            hasChallengeElement: true,
            redirectCount: 3,
            title: "Access Denied",
        });
        const detectedTechs = (0, utils_1.generateMockDetectedTechs)([
            "Cloudflare",
            "reCAPTCHA",
        ]);
        const result = yield analyzer.analyze(webPageData, detectedTechs);
        // Tests for PageAnalysis
        const pageAnalysis = result.pageAnalysis;
        expect(pageAnalysis.hasForms).toBe(true);
        expect(pageAnalysis.hasJavascript).toBe(true);
        expect(pageAnalysis.hasCaptchaElements).toBe(true);
        expect(pageAnalysis.hasChallengeElements).toBe(true);
        expect(pageAnalysis.suspiciousElements.length).toBe(1);
        // Tests for BlockingIndicators
        const blockingIndicators = result.blockingIndicators;
        expect(blockingIndicators.likelyBlocked).toBe(true);
        expect(blockingIndicators.blockingScore).toBeGreaterThanOrEqual(40);
        expect(blockingIndicators.indicators.statusCodeSuspicious).toBe(true);
        expect(blockingIndicators.indicators.minimalContent).toBe(true);
        expect(blockingIndicators.indicators.minimalDomElements).toBe(true);
        expect(blockingIndicators.indicators.challengeDetected).toBe(true);
        expect(blockingIndicators.indicators.captchaDetected).toBe(true);
        expect(blockingIndicators.indicators.suspiciousRedirects).toBe(true);
        expect(blockingIndicators.indicators.suspiciousTitle).toBe(true);
        expect(blockingIndicators.indicators.botDetectionJs).toBe(true);
        expect(blockingIndicators.challengeType).toBe("captcha");
        expect(blockingIndicators.detectedBotProtectionTechs).toEqual(expect.arrayContaining(["reCAPTCHA", "Cloudflare"]));
    }));
    it("doesn't flag blocked when blocking score is low", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const analyzer = new analyzer_1.Analyzer("https://normal-page.com", {
            blockingDetectionEnabled: true,
        });
        const webPageData = (0, utils_1.generateMockWebPageData)({
            bodyDomElementCount: 200,
            statusCode: 200,
            textContentLength: 5000,
            redirectCount: 0,
            title: "Normal Page",
        });
        const detectedTechs = [];
        const result = yield analyzer.analyze(webPageData, detectedTechs);
        expect((_a = result.blockingIndicators) === null || _a === void 0 ? void 0 : _a.likelyBlocked).toBe(false);
    }));
});
