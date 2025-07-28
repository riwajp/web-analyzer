"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnologyDetector = void 0;
const confidence_constants_1 = require("../confidence-constants");
const patternMatcher_1 = require("./patternMatcher");
class TechnologyDetector {
    constructor(technologies, mode = "NORMAL") {
        this.dectionSources = [
            {
                techKey: "js",
                dataKey: "js",
                checkMethod: "checkPatterns",
                type: "js",
            },
            {
                techKey: "scriptSrc",
                dataKey: "assetUrls",
                checkMethod: "checkPatterns",
                type: "scriptSrc",
            },
            {
                techKey: "headers",
                dataKey: "headers",
                checkMethod: "checkHeaders",
                type: "headers",
            },
            {
                techKey: "cookies",
                dataKey: "cookies",
                checkMethod: "checkCookies",
                type: "cookies",
            },
            {
                techKey: "html",
                dataKey: "sourceCode",
                checkMethod: "checkHtml",
                type: "html",
            },
            {
                techKey: "dom",
                dataKey: "dom",
                checkMethod: "checkDom",
                type: "dom",
            },
        ];
        this.technologies = technologies;
        this.detectionMode = mode;
    }
    setDetectionMode(mode) {
        this.detectionMode = mode;
    }
    detectTechnologies(webPageData) {
        const detectedTechnologies = [];
        const visited = {
            detection: new Set(),
            transitive: new Set(),
        };
        const minConfidence = confidence_constants_1.TECH_DETECTION_MODE_CONFIDENCE[this.detectionMode];
        // console.log(
        //   `[DEBUG] Detection mode: ${this.detectionMode}, Min confidence: ${minConfidence}%`
        // );
        const detect = (techName, type = "detection") => {
            if (visited.detection.has(techName) && type == "detection")
                return;
            if (visited.transitive.has(techName) && type == "transitive")
                return;
            visited[type].add(techName);
            const techData = this.technologies[techName];
            if (!techData)
                return;
            const result = this.detectTechnologyWithConfidence(techName, techData, webPageData);
            const confidenceLevel = (0, confidence_constants_1.getConfidenceLevel)(result.confidence);
            //  If tech is actually detected, promote its type to detection
            const isDetected = result.confidence >= minConfidence;
            if (isDetected || type === "transitive") {
                detectedTechnologies.push({
                    name: techName,
                    confidence: Math.round(result.confidence * 10) / 10,
                    confidenceLevel,
                    detectedUsing: result.detectedUsing,
                    matches: result.matches,
                    detectionType: isDetected ? "detection" : "transitive",
                });
                ["implies", "requires"].forEach((key) => {
                    const transitiveTechs = techData[key];
                    if (transitiveTechs) {
                        const transitiveTechsList = Array.isArray(transitiveTechs)
                            ? transitiveTechs
                            : [transitiveTechs];
                        transitiveTechsList.forEach((tech) => detect(tech, "transitive"));
                    }
                });
            }
        };
        for (const techName of Object.keys(this.technologies)) {
            detect(techName);
        }
        return detectedTechnologies.sort((a, b) => b.confidence - a.confidence);
    }
    detectTechnologyWithConfidence(techName, techData, webpageData) {
        const allMatches = [];
        const detectedTypes = [];
        let totalConfidence = 0;
        for (const detectionSource of this.dectionSources) {
            const result = this.processDetection(detectionSource, webpageData, techData, allMatches, detectedTypes);
            totalConfidence += result;
        }
        totalConfidence = Math.min(totalConfidence, 100);
        return {
            name: techName,
            confidence: totalConfidence,
            matches: allMatches,
            detectedUsing: detectedTypes,
        };
    }
    processDetection(detectionSource, webPageData, techData, allMatches, detectedTypes) {
        const { techKey, dataKey, checkMethod, type } = detectionSource;
        if (!techData[techKey] || !webPageData[dataKey]) {
            return 0;
        }
        let result;
        switch (checkMethod) {
            case "checkPatterns":
                result = this.checkPatterns(techData[techKey], webPageData[dataKey], type);
                break;
            case "checkHeaders":
                result = this.checkHeaders(techData[techKey], webPageData[dataKey]);
                break;
            case "checkCookies":
                result = this.checkCookies(techData[techKey], webPageData[dataKey]);
                break;
            case "checkHtml":
                result = this.checkHtml(techData[techKey], webPageData[dataKey]);
                break;
            case "checkDom":
                result = this.checkDom(techData[techKey], webPageData[dataKey]);
                break;
            default:
                return 0;
        }
        if (result.matched) {
            allMatches.push(...result.matches);
            detectedTypes.push(type);
            return result.confidence;
        }
        return 0;
    }
    runDetectionCheck(inputs, patterns, matchFn, confidenceLimit = 100) {
        const allMatches = [];
        let totalConfidence = 0;
        for (const input of inputs) {
            for (const pattern of patterns) {
                const result = matchFn(input, pattern);
                if (result) {
                    allMatches.push(result);
                    totalConfidence += result.confidence;
                }
            }
        }
        return {
            matched: allMatches.length > 0,
            confidence: Math.min(totalConfidence, confidenceLimit),
            matches: allMatches,
        };
    }
    checkPatterns(patterns, items, type) {
        const normalized = this.normalizePatterns(patterns, type);
        return this.runDetectionCheck(items, normalized, (item, pattern) => {
            const result = patternMatcher_1.PatternMatcher.matchPatternWithConfidence(item, pattern);
            return result.matched ? result.match : null;
        });
    }
    checkHeaders(headerPatterns, headers) {
        const patterns = Object.entries(headerPatterns);
        return this.runDetectionCheck([headers], patterns, (headers, [headerName, headerPattern]) => {
            const headerValue = headers.get(headerName.trim().replace(":", ""));
            if (!headerValue)
                return null;
            const pattern = {
                pattern: headerPattern,
                confidence: 75,
                priority: "HIGH",
                type: "regex",
                location: "headers",
                matchedValues: [],
            };
            const result = patternMatcher_1.PatternMatcher.matchPatternWithConfidence(headerValue, pattern);
            return result.matched ? result.match : null;
        });
    }
    checkCookies(cookiePatterns, cookies) {
        const cookiePatternKeys = Object.keys(cookiePatterns);
        const cookieKeys = Object.keys(cookies);
        return this.runDetectionCheck(cookieKeys, cookiePatternKeys, (cookieKey, cookiePatternKey) => {
            var _a;
            if (!cookieKey.includes(cookiePatternKey))
                return null;
            if (!cookiePatterns[cookiePatternKey] ||
                RegExp(cookiePatterns[cookiePatternKey]).test((_a = cookies[cookieKey]) !== null && _a !== void 0 ? _a : ""))
                return {
                    pattern: cookiePatternKey,
                    confidence: 85,
                    priority: "HIGH",
                    type: "exact",
                    location: "cookies",
                    matchedValues: [],
                };
            return null;
        });
    }
    checkHtml(htmlPatterns, html) {
        return this.runDetectionCheck([html], htmlPatterns, (html, pattern) => {
            const patternMatch = {
                pattern,
                confidence: 45,
                priority: "HIGH",
                type: "exact",
                location: "html",
                matchedValues: [],
            };
            const result = patternMatcher_1.PatternMatcher.matchPatternWithConfidence(html, patternMatch);
            return result.matched ? result.match : null;
        });
    }
    checkDom(domPatterns, dom) {
        const selectors = Object.keys(domPatterns || {});
        return this.runDetectionCheck(selectors, [dom], (selector) => {
            if (dom.window.document.querySelectorAll(selector).length > 0) {
                return {
                    pattern: selector,
                    confidence: 45,
                    priority: "HIGH",
                    type: "exact",
                    location: "dom",
                    matchedValues: [],
                };
            }
            return null;
        });
    }
    normalizePatterns(patterns, type) {
        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }
        return patterns.map((pattern) => {
            if (typeof pattern === "string") {
                return {
                    pattern,
                    confidence: this.getDefaultConfidence(type),
                    priority: this.getDefaultPriority(type),
                    type: this.getDefaultType(pattern),
                    location: type,
                    matchedValues: [],
                };
            }
            return pattern;
        });
    }
    getDefaultConfidence(type) {
        const confidenceMap = confidence_constants_1.DETECTION_TYPE_CONFIDENCE;
        return confidenceMap[type] || 50;
    }
    getDefaultPriority(type) {
        const priorityMap = confidence_constants_1.DETECTION_TYPE_PRIORITY;
        return priorityMap[type] || "MEDIUM";
    }
    getDefaultType(pattern) {
        if (/[.*+?^${}()|[\]\\]/.test(pattern)) {
            return "regex";
        }
        if (/[0-9]{2,}|[A-Z]{2,}[a-z]{2,}[A-Z]{2,}/.test(pattern)) {
            return "fuzzy";
        }
        return "exact";
    }
}
exports.TechnologyDetector = TechnologyDetector;
