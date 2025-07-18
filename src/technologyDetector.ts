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

  private checkPatterns(
    patterns: string[] | PatternMatch[],
    items: string[],
    type: string
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const normalizedPatterns = this.normalizePatterns(patterns, type);
    const allMatches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const item of items) {
      const result = PatternMatcher.matchPatternWithConfidence(
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

  private processResult(
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

  private checkHeaders(
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
        const result = PatternMatcher.matchPatternWithConfidence(
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

  private checkCookies(
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
          PatternMatcher["PATTERN_WEIGHTS"][pattern.priority];
      }
    }

    return {
      matched: allMatches.length > 0,
      confidence: Math.min(totalConfidence, 100),
      matches: allMatches,
    };
  }

  private checkHtml(htmlPatterns: string[], html: string) {
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
      const result = PatternMatcher.matchPatternWithConfidence(
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

  private checkDom(domPatterns: any, dom: any) {
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
