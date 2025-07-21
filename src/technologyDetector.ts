import {
  DETECTION_TYPE_CONFIDENCE,
  DETECTION_TYPE_PRIORITY,
  getConfidenceLevel,
  TECH_DETECTION_MODE_CONFIDENCE,
} from "./confidence-constants";

import { PatternMatcher, PatternMatch } from "./patternMatcher";

import type {
  URLData,
  SiteData,
  DetectedTechnology,
  TechnologiesMap,
  DetectionMode,
} from "./types";

export interface DetectionResult {
  name: string;
  confidence: number;
  matches: PatternMatch[];
  detectedUsing: string[];
}

export class TechnologyDetector {
  private technologies: TechnologiesMap;
  private detectionMode: DetectionMode;
  private detectionConfigs = [
    {
      techKey: "js",
      dataKey: "js",
      dataSource: "siteData",
      checkMethod: "checkPatterns",
      type: "js",
    },
    {
      techKey: "scriptSrc",
      dataKey: "assetUrls",
      dataSource: "siteData",
      checkMethod: "checkPatterns",
      type: "scriptSrc",
    },
    {
      techKey: "headers",
      dataKey: "headers",
      dataSource: "urlData",
      checkMethod: "checkHeaders",
      type: "headers",
    },
    {
      techKey: "cookies",
      dataKey: "cookies",
      dataSource: "urlData",
      checkMethod: "checkCookies",
      type: "cookies",
    },
    {
      techKey: "html",
      dataKey: "html",
      dataSource: "urlData",
      checkMethod: "checkHtml",
      type: "html",
    },
    {
      techKey: "dom",
      dataKey: "dom",
      dataSource: "urlData",
      checkMethod: "checkDom",
      type: "dom",
    },
  ];

  constructor(technologies: TechnologiesMap, mode: DetectionMode = "NORMAL") {
    this.technologies = technologies;
    this.detectionMode = mode;
  }

  setDetectionMode(mode: DetectionMode) {
    this.detectionMode = mode;
    console.log(`Detection mode set to: ${mode}`);
  }

  detectTechnologies(
    urlData: URLData,
    siteData: SiteData
  ): DetectedTechnology[] {
    const detectedTechnologies: DetectedTechnology[] = [];
    const visited = new Set<string>();
    const minConfidence = TECH_DETECTION_MODE_CONFIDENCE[this.detectionMode];

    console.log(
      `[DEBUG] Detection mode: ${this.detectionMode}, Min confidence: ${minConfidence}%`
    );

    const detect = (techName: string) => {
      if (visited.has(techName)) return;
      visited.add(techName);

      const techData = this.technologies[techName];
      if (!techData) return;

      const result = this.detectTechnologyWithConfidence(
        techName,
        techData,
        siteData,
        urlData
      );
      const confidenceLevel = getConfidenceLevel(result.confidence);

      console.log(
        `[DEBUG] ${techName}: ${result.confidence.toFixed(
          1
        )}% confidence (${confidenceLevel})`
      );
      if (result.confidence >= minConfidence) {
        console.log(
          `[DETECTED] ${techName} - ${result.confidence.toFixed(1)}% confidence`
        );
        detectedTechnologies.push({
          name: techName,
          confidence: Math.round(result.confidence * 10) / 10,
          confidenceLevel,
          detectedUsing: result.detectedUsing,
          matches: result.matches,
        });

        if (techData.implies) {
          const impliedTechs = Array.isArray(techData.implies)
            ? techData.implies
            : [techData.implies];
          impliedTechs.forEach(detect);
        }

        if (techData.requires) {
          const requiredTechs = Array.isArray(techData.requires)
            ? techData.requires
            : [techData.requires];
          requiredTechs.forEach(detect);
        }
      }
    };

    for (const techName of Object.keys(this.technologies)) {
      detect(techName);
    }

    return detectedTechnologies.sort((a, b) => b.confidence - a.confidence);
  }

  private detectTechnologyWithConfidence(
    techName: string,
    techData: any,
    siteData: any,
    urlData: any
  ): DetectionResult {
    const allMatches: PatternMatch[] = [];
    const detectedTypes: string[] = [];
    let totalConfidence = 0;

    for (const config of this.detectionConfigs) {
      const dataSource = config["dataSource"] == "urlData" ? urlData : siteData;

      const result = this.processDetection(
        config,
        dataSource,
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

  private processDetection(
    config: {
      techKey: string;
      dataKey: string;
      dataSource: any;
      checkMethod: string;
      type: string;
    },
    dataSource: any,
    techData: any,
    allMatches: PatternMatch[],
    detectedTypes: string[]
  ): number {
    const { techKey, dataKey, checkMethod, type } = config;

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

  private runDetectionCheck<Input, Pattern>(
    inputs: Input[],
    patterns: Pattern[],
    matchFn: (input: Input, pattern: Pattern) => PatternMatch | null,
    confidenceLimit = 100
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const allMatches: PatternMatch[] = [];
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

  private checkPatterns(
    patterns: string[] | PatternMatch[],
    items: string[],
    type: string
  ) {
    const normalized = this.normalizePatterns(patterns, type);
    return this.runDetectionCheck(items, normalized, (item, pattern) => {
      const result = PatternMatcher.matchPatternWithConfidence(item, pattern);
      return result.matched ? { ...pattern, matchedValue: item } : null;
    });
  }

  private checkHeaders(
    headerPatterns: Record<string, string>,
    headers: Headers
  ) {
    const patterns = Object.entries(headerPatterns);
    return this.runDetectionCheck(
      [headers],
      patterns,

      (headers, [headerName, headerPattern]) => {
        const headerValue = headers.get(headerName.trim().replace(":", ""));
        if (!headerValue) return null;
        const pattern: PatternMatch = {
          pattern: headerPattern,
          confidence: 75,
          priority: "HIGH",
          type: "regex",
          location: "headers",
          matchedValue: headerValue,
        };
        const result = PatternMatcher.matchPatternWithConfidence(
          headerValue,
          pattern
        );
        return result.matched
          ? { ...pattern, matchedValue: headerValue }
          : null;
      }
    );
  }

  private checkCookies(
    cookiePatterns: Record<string, string>,
    cookies: Record<string, any>
  ) {
    const cookiePatternKeys = Object.keys(cookiePatterns);
    const cookieKeys = Object.keys(cookies);

    return this.runDetectionCheck(
      cookieKeys,
      cookiePatternKeys,
      (cookieKey, cookiePatternKey) => {
        if (!cookieKey.includes(cookiePatternKey)) return null;
        if (
          !cookiePatterns[cookiePatternKey] ||
          RegExp(cookiePatterns[cookiePatternKey]).test(cookies[cookieKey])
        )
          return {
            pattern: cookiePatternKey,
            confidence: 85,
            priority: "HIGH",
            type: "exact",
            location: "cookies",
            matchedValue: cookieKey,
          };

        return null;
      }
    );
  }

  private checkHtml(htmlPatterns: string[], html: string) {
    return this.runDetectionCheck([html], htmlPatterns, (html, pattern) => {
      const patternMatch: PatternMatch = {
        pattern,
        confidence: 45,
        priority: "HIGH",
        type: "exact",
        location: "html",
        matchedValue: pattern,
      };
      const result = PatternMatcher.matchPatternWithConfidence(
        html,
        patternMatch
      );
      return result.matched ? patternMatch : null;
    });
  }

  private checkDom(domPatterns: Record<string, unknown>, dom: Document) {
    const selectors = Object.keys(domPatterns || {});
    return this.runDetectionCheck(selectors, [dom], (selector) => {
      if (dom.querySelectorAll(selector).length > 0) {
        return {
          pattern: selector,
          confidence: 45,
          priority: "HIGH",
          type: "exact",
          location: "dom",
          matchedValue: selector,
        };
      }
      return null;
    });
  }

  private normalizePatterns(
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

  private getDefaultConfidence(type: string): number {
    const confidenceMap = DETECTION_TYPE_CONFIDENCE;
    return confidenceMap[type] || 50;
  }

  private getDefaultPriority(type: string): "HIGH" | "MEDIUM" | "LOW" {
    const priorityMap = DETECTION_TYPE_PRIORITY;
    return priorityMap[type] || "MEDIUM";
  }

  private getDefaultType(
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
