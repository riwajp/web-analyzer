"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcher = void 0;
class PatternMatcher {
    static matchPatternWithConfidence(value, pattern, baseConfidence = 50) {
        if (typeof pattern === "string") {
            const patternMatch = {
                pattern,
                confidence: baseConfidence,
                priority: "MEDIUM",
                type: "exact",
                location: "",
                matchedValues: [],
            };
            return this.matchSinglePattern(value, patternMatch);
        }
        return this.matchSinglePattern(value, pattern);
    }
    static matchSinglePattern(value, pattern) {
        var _a, _b, _c, _d;
        let matched = false;
        let confidence = 0;
        const matchedValues = [];
        switch (pattern.type) {
            case "exact": {
                const escapedPattern = pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const regexPattern = Object.assign(Object.assign({}, pattern), { pattern: escapedPattern, type: "regex" });
                const result = this.matchSinglePattern(value, regexPattern);
                matched = result.matched;
                matchedValues.push(...((_b = (_a = result.match) === null || _a === void 0 ? void 0 : _a.matchedValues) !== null && _b !== void 0 ? _b : []));
                break;
            }
            case "regex": {
                try {
                    const regex = new RegExp(pattern.pattern, "gi");
                    let m;
                    while ((m = regex.exec(value)) !== null) {
                        if (m[0].length === 0) {
                            regex.lastIndex++;
                            continue;
                        }
                        matchedValues.push(m[0]);
                    }
                    matched = matchedValues.length > 0;
                }
                catch (_e) {
                    const fallbackPattern = Object.assign(Object.assign({}, pattern), { type: "exact" });
                    const fallbackResult = this.matchSinglePattern(value, fallbackPattern);
                    matched = fallbackResult.matched;
                    matchedValues.push(...((_d = (_c = fallbackResult.match) === null || _c === void 0 ? void 0 : _c.matchedValues) !== null && _d !== void 0 ? _d : []));
                }
                break;
            }
        }
        if (matched) {
            confidence = pattern.confidence * this.PATTERN_WEIGHTS[pattern.priority];
            return {
                matched: true,
                confidence,
                match: Object.assign(Object.assign({}, pattern), { matchedValues: matchedValues }),
            };
        }
        return {
            matched: false,
            confidence: 0,
            match: pattern,
        };
    }
}
exports.PatternMatcher = PatternMatcher;
PatternMatcher.PATTERN_WEIGHTS = {
    HIGH: 1.0,
    MEDIUM: 0.7,
    LOW: 0.4,
};
