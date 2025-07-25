import {
  DETECTION_TYPE_CONFIDENCE,
  DETECTION_TYPE_PRIORITY,
  getConfidenceLevel,
  TECH_DETECTION_MODE_CONFIDENCE,
} from "./confidence-constants";
import type { JSDOM } from "jsdom";
import { PatternMatcher, PatternMatch } from "./patternMatcher";

import type {
  WebPageData,
  DetectedTechnology,
  TechnologiesMap,
  DetectionMode,
  DetectionSource,
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
  private dectionSources: DetectionSource[] = [
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

  constructor(technologies: TechnologiesMap, mode: DetectionMode = "NORMAL") {
    this.technologies = technologies;
    this.detectionMode = mode;
  }

  setDetectionMode(mode: DetectionMode) {
    this.detectionMode = mode;
  }

  detectTechnologies(webPageData: WebPageData): DetectedTechnology[] {
    const detectedTechnologies: DetectedTechnology[] = [];
    const visited = {
      detection: new Set<string>(),
      transitive: new Set<string>(),
    };

    const minConfidence = TECH_DETECTION_MODE_CONFIDENCE[this.detectionMode];

    // console.log(
    //   `[DEBUG] Detection mode: ${this.detectionMode}, Min confidence: ${minConfidence}%`
    // );

    const detect = (
      techName: string,
      type: "detection" | "transitive" = "detection"
    ) => {
      if (visited.detection.has(techName) && type == "detection") return;
      if (visited.transitive.has(techName) && type == "transitive") return;

      visited[type].add(techName);

      const techData = this.technologies[techName];
      if (!techData) return;

      const result = this.detectTechnologyWithConfidence(
        techName,
        techData,
        webPageData
      );

      const confidenceLevel = getConfidenceLevel(result.confidence);

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
            transitiveTechsList.forEach((tech: string) =>
              detect(tech, "transitive")
            );
          }
        });
      }
    };

    for (const techName of Object.keys(this.technologies)) {
      detect(techName);
    }

    return detectedTechnologies.sort((a, b) => b.confidence - a.confidence);
  }

  private detectTechnologyWithConfidence(
    techName: string,
    techData: Record<string, string | object | string[]>,
    webpageData: WebPageData
  ): DetectionResult {
    const allMatches: PatternMatch[] = [];
    const detectedTypes: string[] = [];
    let totalConfidence = 0;

    for (const detectionSource of this.dectionSources) {
      const result = this.processDetection(
        detectionSource,
        webpageData,
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
    detectionSource: DetectionSource,
    webPageData: WebPageData,
    techData: Record<string, string | object | string[]>,
    allMatches: PatternMatch[],
    detectedTypes: string[]
  ): number {
    const { techKey, dataKey, checkMethod, type } = detectionSource;

    if (!techData[techKey] || !webPageData[dataKey]) {
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
          techData[techKey] as string[],
          webPageData[dataKey] as string[],
          type
        );
        break;
      case "checkHeaders":
        result = this.checkHeaders(
          techData[techKey] as Record<string, string>,
          webPageData[dataKey] as Headers
        );
        break;
      case "checkCookies":
        result = this.checkCookies(
          techData[techKey] as Record<string, string>,
          webPageData[dataKey] as Record<string, string>
        );
        break;
      case "checkHtml":
        result = this.checkHtml(
          techData[techKey] as string[],
          webPageData[dataKey] as string
        );
        break;
      case "checkDom":
        result = this.checkDom(
          techData[techKey] as Record<string, string>,
          webPageData[dataKey] as JSDOM
        );
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
    cookies: Record<string, string | undefined>
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
          RegExp(cookiePatterns[cookiePatternKey]).test(
            cookies[cookieKey] ?? ""
          )
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

  private checkDom(domPatterns: Record<string, unknown>, dom: JSDOM) {
    const selectors = Object.keys(domPatterns || {});
    return this.runDetectionCheck(selectors, [dom], (selector) => {
      if (dom.window.document.querySelectorAll(selector).length > 0) {
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
