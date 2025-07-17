import {
  DETECTION_TYPE_CONFIDENCE,
  DETECTION_TYPE_PRIORITY,
} from "./confidence-constants";

export interface PatternMatch {
  pattern: string;
  confidence: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "exact" | "regex" | "fuzzy" | "encoded";
  location: string;
  matchedValue: string;
}

export interface DetectionResult {
  name: string;
  confidence: number;
  matches: PatternMatch[];
  detectedUsing: string[];
}

export class EnhancedPatternMatcher {
  private static readonly PATTERN_WEIGHTS = {
    HIGH: 1.0,
    MEDIUM: 0.7,
    LOW: 0.4,
  };

  static matchPatternWithConfidence(
    value: string,
    pattern: string | PatternMatch | PatternMatch[],
    baseConfidence: number = 50
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    if (typeof pattern === "string") {
      const patternMatch: PatternMatch = {
        pattern,
        confidence: baseConfidence,
        priority: "MEDIUM",
        type: "exact",
        location: "",
        matchedValue: "",
      };
      return this.matchSinglePattern(value, patternMatch);
    }

    if (Array.isArray(pattern)) {
      return this.matchMultiplePatterns(value, pattern);
    }
    return this.matchSinglePattern(value, pattern);
  }

  private static matchSinglePattern(
    value: string,
    pattern: PatternMatch
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const lowerValue = value.toLowerCase();
    const lowerPattern = pattern.pattern.toLowerCase();
    let matched = false;
    let confidence = 0;

    switch (pattern.type) {
      case "exact":
        matched = lowerValue.includes(lowerPattern);
        break;
      case "regex":
        try {
          const regex = new RegExp(pattern.pattern, "i");
          matched = regex.test(value);
        } catch (e) {
          matched = lowerValue.includes(lowerPattern);
        }
        break;
      case "fuzzy":
        matched = this.fuzzyMatch(lowerValue, lowerPattern);
        break;
      case "encoded":
        matched = this.matchEncodedPattern(value, pattern.pattern);
        break;
    }

    if (matched) {
      confidence = pattern.confidence * this.PATTERN_WEIGHTS[pattern.priority];
      return {
        matched: true,
        confidence,
        matches: [{ ...pattern, matchedValue: value }],
      };
    }

    return {
      matched: false,
      confidence: 0,
      matches: [],
    };
  }

  private static matchMultiplePatterns(
    value: string,
    patterns: PatternMatch[]
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const matches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const pattern of patterns) {
      const result = this.matchSinglePattern(value, pattern);
      if (result.matched) {
        matches.push(...result.matches);
        totalConfidence += result.confidence;
      }
    }

    totalConfidence = Math.min(totalConfidence, 100);

    return {
      matched: matches.length > 0,
      confidence: totalConfidence,
      matches,
    };
  }

  private static fuzzyMatch(value: string, pattern: string): boolean {
    const cleanValue = value.replace(/[0-9_\-\[\]]/g, "");
    const cleanPattern = pattern.replace(/[0-9_\-\[\]]/g, "");
    if (cleanValue.includes(cleanPattern)) {
      return true;
    }

    const similarity = this.calculateStringSimilarity(cleanValue, cleanPattern);
    return similarity > 0.7;
  }

  private static matchEncodedPattern(value: string, pattern: string): boolean {
    try {
      const base64Pattern = btoa(pattern);
      if (value.includes(base64Pattern)) {
        return true;
      }
    } catch (e) {}

    const hexPattern = pattern
      .split("")
      .map((c) => c.charCodeAt(0).toString(16))
      .join("");
    if (value.includes(hexPattern)) {
      return true;
    }

    const urlEncodedPattern = encodeURIComponent(pattern);
    if (value.includes(urlEncodedPattern)) {
      return true;
    }

    return false;
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }
}

export class EnhancedTechnologyDetector {
  static detectTechnologyWithConfidence(
    techName: string,
    techData: any,
    siteData: any,
    reqData: any
  ): DetectionResult {
    const allMatches: PatternMatch[] = [];
    const detectedTypes: string[] = [];
    let totalConfidence = 0;

    const detectionConfigs = [
      {
        techKey: "js",
        dataKey: "js",
        dataSource: siteData,
        checkMethod: "checkPatterns",
        type: "js",
      },
      {
        techKey: "scriptSrc",
        dataKey: "assetUrls",
        dataSource: siteData,
        checkMethod: "checkPatterns",
        type: "scriptSrc",
      },
      {
        techKey: "headers",
        dataKey: "headers",
        dataSource: reqData,
        checkMethod: "checkHeaders",
        type: "headers",
      },
      {
        techKey: "cookies",
        dataKey: "cookies",
        dataSource: reqData,
        checkMethod: "checkCookies",
        type: "cookies",
      },
      {
        techKey: "html",
        dataKey: "html",
        dataSource: reqData,
        checkMethod: "checkHtml",
        type: "html",
      },
      {
        techKey: "dom",
        dataKey: "dom",
        dataSource: reqData,
        checkMethod: "checkDom",
        type: "dom",
      },
    ];

    for (const config of detectionConfigs) {
      const result = this.processDetection(
        config,
        techData,
        allMatches,
        detectedTypes
      );
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

  private static processDetection(
    config: {
      techKey: string;
      dataKey: string;
      dataSource: any;
      checkMethod: string;
      type: string;
    },
    techData: any,
    allMatches: PatternMatch[],
    detectedTypes: string[]
  ): number {
    const { techKey, dataKey, dataSource, checkMethod, type } = config;

    if (!techData[techKey] || !dataSource[dataKey]) {
      return 0;
    }

    let result: {
      matched: boolean;
      confidence: number;
      matches: PatternMatch[];
    };

    switch (checkMethod) {
      case "checkPatterns":
        result = this.checkPatterns(
          techData[techKey],
          dataSource[dataKey],
          type
        );
        break;
      case "checkHeaders":
        result = this.checkHeaders(techData[techKey], dataSource[dataKey]);
        break;
      case "checkCookies":
        result = this.checkCookies(techData[techKey], dataSource[dataKey]);
        break;
      case "checkHtml":
        result = this.checkHtml(techData[techKey], dataSource[dataKey]);
        break;
      case "checkDom":
        result = this.checkDom(techData[techKey], dataSource[dataKey]);
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

  private static checkPatterns(
    patterns: string[] | PatternMatch[],
    items: string[],
    type: string
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const normalizedPatterns = this.normalizePatterns(patterns, type);
    const allMatches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const item of items) {
      const result = EnhancedPatternMatcher.matchPatternWithConfidence(
        item,
        normalizedPatterns
      );
      totalConfidence = this.processResult(result, allMatches, totalConfidence);
    }

    return {
      matched: allMatches.length > 0,
      confidence: Math.min(totalConfidence, 100),
      matches: allMatches,
    };
  }

  private static processResult(
    result: { matched: boolean; confidence: number; matches: PatternMatch[] },
    allMatches: PatternMatch[],
    currentConfidence: number
  ): number {
    if (result.matched) {
      allMatches.push(...result.matches);
      return currentConfidence + result.confidence;
    }
    return currentConfidence;
  }

  private static checkHeaders(
    headerPatterns: Record<string, string>,
    headers: Headers
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const allMatches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const [headerName, headerPattern] of Object.entries(headerPatterns)) {
      const headerValue = headers.get(headerName.trim().replace(":", ""));
      if (headerValue) {
        const pattern: PatternMatch = {
          pattern: headerPattern,
          confidence: 75,
          priority: "HIGH",
          type: "regex",
          location: "headers",
          matchedValue: headerValue,
        };
        const result = EnhancedPatternMatcher.matchPatternWithConfidence(
          headerValue,
          pattern
        );
        totalConfidence = this.processResult(
          result,
          allMatches,
          totalConfidence
        );
      }
    }

    return {
      matched: allMatches.length > 0,
      confidence: Math.min(totalConfidence, 100),
      matches: allMatches,
    };
  }

  private static checkCookies(
    cookiePatterns: Record<string, string>,
    cookies: string
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const allMatches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const [cookieName, cookiePattern] of Object.entries(cookiePatterns)) {
      if (cookies.includes(cookieName)) {
        const pattern: PatternMatch = {
          pattern: cookieName,
          confidence: 85,
          priority: "HIGH",
          type: "exact",
          location: "cookies",
          matchedValue: cookieName,
        };
        allMatches.push(pattern);
        totalConfidence +=
          pattern.confidence *
          EnhancedPatternMatcher["PATTERN_WEIGHTS"][pattern.priority];
      }
    }

    return {
      matched: allMatches.length > 0,
      confidence: Math.min(totalConfidence, 100),
      matches: allMatches,
    };
  }

  private static checkHtml(htmlPatterns: string[], html: string) {
    const allMatches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const pattern of htmlPatterns) {
      const patternMatch: PatternMatch = {
        pattern: pattern,
        confidence: 45,
        priority: "HIGH",
        type: "exact",
        location: "headers",
        matchedValue: pattern,
      };
      const result = EnhancedPatternMatcher.matchPatternWithConfidence(
        html,
        patternMatch
      );
      totalConfidence = this.processResult(result, allMatches, totalConfidence);
    }

    return {
      matched: allMatches.length > 0,
      confidence: Math.min(totalConfidence, 100),
      matches: allMatches,
    };
  }

  private static checkDom(domPatterns: any, dom: any) {
    const allMatches: PatternMatch[] = [];
    let totalConfidence = 0;

    if (domPatterns && typeof domPatterns === "object") {
      for (const domSelector of Object.keys(domPatterns)) {
        const patternMatch: PatternMatch = {
          pattern: domSelector,
          confidence: 45,
          priority: "HIGH",
          type: "exact",
          location: "headers",
          matchedValue: "",
        };
        if (dom.querySelectorAll(domSelector).length > 0) {
          allMatches.push(patternMatch);
          totalConfidence += 30;
        }
      }
    }
    return {
      matched: allMatches.length > 0,
      confidence: Math.min(totalConfidence, 100),
      matches: allMatches,
    };
  }

  private static normalizePatterns(
    patterns: string[] | PatternMatch[],
    type: string
  ): PatternMatch[] {
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
          matchedValue: "",
        } as PatternMatch;
      }
      return pattern;
    });
  }

  private static getDefaultConfidence(type: string): number {
    const confidenceMap = DETECTION_TYPE_CONFIDENCE;
    return confidenceMap[type] || 50;
  }

  private static getDefaultPriority(type: string): "HIGH" | "MEDIUM" | "LOW" {
    const priorityMap = DETECTION_TYPE_PRIORITY;
    return priorityMap[type] || "MEDIUM";
  }

  private static getDefaultType(
    pattern: string
  ): "exact" | "regex" | "fuzzy" | "encoded" {
    if (/[.*+?^${}()|[\]\\]/.test(pattern)) {
      return "regex";
    }
    if (/[0-9]{2,}|[A-Z]{2,}[a-z]{2,}[A-Z]{2,}/.test(pattern)) {
      return "fuzzy";
    }
    return "exact";
  }
}
