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
exports.Analyzer = void 0;
class Analyzer {
    constructor(url, config) {
        this.SUSPICIOUS_STATUS_CODES = [
            403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527, 530,
        ];
        this.SUSPICIOUS_PHRASE_PATTERNS = [
            /\brate ?limit(ed)?\b/i,
            /\btoo many requests\b/i,
            /\bsuspicious (activity|traffic)\b/i,
            /\baccess (denied|restricted|blocked)\b/i,
            /\b(blocked|your connection has been blocked)\b/i,
            /\b(request looks automated|automated request)\b/i,
            /\b(unusual|suspicious) traffic\b/i,
            /\bverify (you are )?(human|(ro)?bot)?\b/i,
            /\b((ro)?bot check|you are not a (ro)?bot)\b/i,
            /\bsolve (the )?(captcha|puzzle|challenge)\b/i,
            /\b(security check|browser verification|checking your browser)\b/i,
            /\bcloudflare\b/i,
            /\bddos protection\b/i,
            /\bplease wait\b/i,
            /\b(cookies|javascript)\b.*\b(enabled|disabled)\b|\b(enabled|disabled)\b.*\b(cookies|javascript)\b/i,
        ];
        this.SUSPICIOUS_TITLE_PATTERNS = [
            /\bjust a moment\b/i,
            /\bplease wait\b/i,
            /\b(access|permission) denied\b/i,
            /\b(blocked|blocked access)\b/i,
            /\b(error|error \d{3})\b/i,
            /\bforbidden\b/i,
            /\bunauthorized\b/i,
            /\bsecurity (check|verification)\b/i,
            /\bddos protection\b/i,
            /\b(ro)?bot detection\b/i,
            /\b(human)\b.*\b((ro)?bot)\b|\b((ro)?bot)\b.*\b(human)\b/i,
        ];
        this.url = url;
        this.config = config !== null && config !== void 0 ? config : {};
    }
    analyze(webPageData, detectedTechnologies) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const technologies = detectedTechnologies;
                const pageAnalysis = this.analyzePageMetrics(webPageData);
                const blockingIndicators = this.config.blockingDetectionEnabled
                    ? this.analyzeBlocking(webPageData, detectedTechnologies, pageAnalysis)
                    : {};
                const stats = this.calculateStats(technologies);
                const rawData = {
                    headers: Object.fromEntries(webPageData.headers.entries()),
                    cookies: webPageData.cookies,
                    metaTags: webPageData.meta,
                    sourceCode: (_b = (_a = webPageData.dom.window.document.querySelector("body")) === null || _a === void 0 ? void 0 : _a.innerHTML) !== null && _b !== void 0 ? _b : "",
                };
                return Object.assign(Object.assign(Object.assign(Object.assign({ url: this.url, fetchTime: webPageData.responseTime, finalUrl: webPageData.finalUrl, statusCode: webPageData.statusCode, technologies }, (this.config.blockingDetectionEnabled ? { blockingIndicators } : {})), { pageAnalysis,
                    stats }), (this.config.includeRawData ? { rawData } : {})), { textContentLength: webPageData.textContentLength });
            }
            catch (error) {
                console.error(`Error analyzing ${this.url}:`, error);
                return null;
            }
        });
    }
    analyzeBlocking(webPageData, detectedTechnologies, pageAnalysis) {
        const indicators = {
            statusCodeSuspicious: false,
            minimalContent: false,
            challengeDetected: false,
            captchaDetected: false,
            suspiciousTitle: false,
            suspiciousRedirects: false,
            botDetectionJs: false,
            minimalDomElements: false,
            unusualResponseTime: false,
            suspiciousElements: false,
        };
        const detectedSuspiciousPhrases = [];
        let blockingScore = 0;
        if (this.SUSPICIOUS_STATUS_CODES.includes(webPageData.statusCode)) {
            indicators.statusCodeSuspicious = true;
            blockingScore += 100;
        }
        if (webPageData.bodyDomElementCount < 10) {
            blockingScore += 70;
            indicators.minimalDomElements = true;
        }
        else if (webPageData.bodyDomElementCount < 50) {
            blockingScore += 30;
            indicators.minimalDomElements = true;
        }
        if (webPageData.textContentLength < 500) {
            indicators.minimalContent = true;
            blockingScore += 30;
        }
        // Check for suspicious page titles
        if (this.SUSPICIOUS_TITLE_PATTERNS.some((pattern) => pattern.test(webPageData.title))) {
            indicators.suspiciousTitle = true;
            blockingScore += 30;
        }
        if (pageAnalysis.hasChallengeElements || pageAnalysis.hasCaptchaElements) {
            indicators.challengeDetected = pageAnalysis.hasChallengeElements;
            indicators.captchaDetected = pageAnalysis.hasCaptchaElements;
            blockingScore += 10;
        }
        if (pageAnalysis.suspiciousElements.length > 0) {
            indicators.suspiciousElements = true;
            blockingScore += 10;
        }
        // Check for suspicious phrases
        const urls = webPageData.finalUrl + this.url;
        for (const pattern of this.SUSPICIOUS_PHRASE_PATTERNS) {
            if (pattern.test(webPageData.sourceCode) || pattern.test(urls)) {
                detectedSuspiciousPhrases.push(pattern.source);
                if (indicators.minimalDomElements || indicators.minimalContent)
                    blockingScore += 10;
            }
        }
        // Check for suspicious redirects
        if (webPageData.redirectCount >= 2) {
            indicators.suspiciousRedirects = true;
            blockingScore += 10;
        }
        // Check for unusual response times
        if (webPageData.responseTime > 10000) {
            indicators.unusualResponseTime = true;
            blockingScore += 10;
        }
        // Determine challenge type
        let challengeType;
        const captchaTechnologies = [
            "captcha",
            "recaptcha",
            "hcaptcha",
            "turnstile",
            "geetest",
            "keycaptcha",
            "arkose",
            "funcaptcha",
        ];
        const challengeTechnologies = [
            "cloudflare",
            "datadome",
            "imperva",
            "akamai",
            "perimeterx",
            "incapsula",
        ];
        const detectedCaptchaTechnologies = detectedTechnologies.filter((tech) => captchaTechnologies.some((keyword) => tech.name.toLowerCase().includes(keyword)));
        const detectedJavascriptTechnologies = detectedTechnologies.filter((tech) => challengeTechnologies.some((keyword) => tech.name.toLowerCase().includes(keyword)));
        if (detectedCaptchaTechnologies.length +
            detectedJavascriptTechnologies.length >
            0)
            indicators.botDetectionJs = true;
        if (detectedCaptchaTechnologies.length > 0) {
            challengeType = "captcha";
        }
        else if (detectedJavascriptTechnologies.length > 0) {
            challengeType = "javascript";
        }
        else if (detectedSuspiciousPhrases.some((p) => p.includes("browser"))) {
            challengeType = "browser_check";
        }
        else if (detectedSuspiciousPhrases.some((p) => p.includes("rate limit") || p.includes("too many requests"))) {
            challengeType = "rate_limit";
        }
        else if (indicators.suspiciousTitle) {
            challengeType = "access_denied";
        }
        return {
            likelyBlocked: blockingScore >= 40,
            blockingScore: Math.min(blockingScore, 100),
            indicators,
            suspiciousPhrases: detectedSuspiciousPhrases,
            challengeType,
            detectedBotProtectionTechs: [
                ...detectedCaptchaTechnologies.map((t) => t.name),
                ...detectedJavascriptTechnologies.map((t) => t.name),
            ],
        };
    }
    analyzePageMetrics(webPageData) {
        const doc = webPageData.dom.window.document;
        const hasCaptchaElements = !!(doc.querySelector(".g-recaptcha,.h-captcha,.cf-turnstile,[data-sitekey]") || /recaptcha|hcaptcha|turnstile/i.test(webPageData.sourceCode));
        const hasChallengeElements = !!(doc.querySelector('[id*="challenge"], [class*="challenge"], [id*="verification"], [class*="verification"]') ||
            /challenge-platform|browser-verification/i.test(webPageData.sourceCode));
        const suspiciousSelectors = [
            '[id*="captcha"]',
            '[class*="captcha"]',
            '[id*="protection"]',
            '[class*="protection"]',
        ];
        const suspiciousElements = [
            ...doc.querySelectorAll(suspiciousSelectors.join(",")),
        ].map((el) => ({
            tag: el.tagName,
            id: el.id,
            class: el.className,
        }));
        const getDomComplexity = (elementCount) => {
            if (elementCount < 100)
                return "LOW";
            if (elementCount < 1000)
                return "MEDIUM";
            return "HIGH";
        };
        return {
            bodyDomElementCount: webPageData.bodyDomElementCount,
            domComplexity: getDomComplexity(webPageData.bodyDomElementCount),
            contentType: webPageData.contentType,
            title: webPageData.title,
            description: webPageData.description,
            language: webPageData.meta["language"] || webPageData.meta["lang"] || "unknown",
            viewport: webPageData.meta["viewport"] || "not set",
            charset: webPageData.meta["charset"] || "unknown",
            hasForms: webPageData.formCount > 0,
            hasJavascript: webPageData.scriptCount > 0,
            externalResources: webPageData.assetUrls.length,
            hasCaptchaElements,
            hasChallengeElements,
            suspiciousElements,
        };
    }
    calculateStats(results) {
        return {
            total: results.length,
            byConfidence: {
                HIGH: results.filter((r) => r.confidenceLevel === "HIGH").length,
                MEDIUM: results.filter((r) => r.confidenceLevel === "MEDIUM").length,
                LOW: results.filter((r) => r.confidenceLevel === "LOW").length,
            },
            averageConfidence: results.length > 0
                ? Math.round((results.reduce((sum, r) => sum + r.confidence, 0) /
                    results.length) *
                    10) / 10
                : 0,
            topDetection: results.length > 0 ? results[0] : null,
        };
    }
}
exports.Analyzer = Analyzer;
