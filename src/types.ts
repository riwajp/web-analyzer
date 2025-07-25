import type { JSDOM } from "jsdom";

export type WebPageData = {
  sourceCode: string;
  headers: Headers;
  cookies: Record<string, string | undefined>;
  statusCode: number;
  responseTime: number;
  contentLength: number;
  contentType: string;
  finalUrl: string;
  redirectCount: number;
  scriptSrc: string[];
  js: string[];
  meta: Record<string, string>;
  dom: JSDOM;
  assetUrls: string[];
  title: string;
  description: string;
  bodyDomElementCount: number;
  textContentLength: number;
  scriptCount: number;
  imageCount: number;
  linkCount: number;
  formCount: number;
};

export type DetectedTechnology = {
  name: string;
  confidence: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  detectedUsing: string[];
  matches: PatternMatch[];
  detectionType: "transitive" | "detection";
};

export type PatternMatch = {
  pattern: string;
  confidence: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "exact" | "regex" | "fuzzy" | "encoded";
  location: string;
  matchedValue: string;
};

export type BlockingIndicators = {
  likelyBlocked: boolean;
  blockingScore: number;
  indicators: {
    statusCodeSuspicious: boolean;
    minimalContent: boolean;
    challengeDetected: boolean;
    captchaDetected: boolean;
    suspiciousTitle: boolean;
    suspiciousRedirects: boolean;
    botDetectionJs: boolean;
    minimalDomElements: boolean;
    unusualResponseTime: boolean;
  };
  suspiciousPhrases: string[];
  challengeType?:
    | "captcha"
    | "javascript"
    | "browser_check"
    | "rate_limit"
    | "access_denied";
  detectedBotProtectionTechs?: string[];
};

export type PageAnalysis = {
  bodyDomElementCount: number;
  pageSizeBytes: number;
  pageSizeHuman: string;
  domComplexity: "LOW" | "MEDIUM" | "HIGH";
  contentType: string;
  title: string;
  description: string;
  language: string;
  viewport: string;
  charset: string;
  hasForms: boolean;
  hasJavascript: boolean;
  externalResources: number;
  hasCaptchaElements: boolean;
  hasChallengeElements: boolean;
  suspiciousElements: { tag: string; id: string; class: string }[];
};

export type DetectionResult = {
  url: string;
  fetchTime: number;
  finalUrl: string;
  statusCode: number;
  technologies: DetectedTechnology[];
  blockingIndicators?: BlockingIndicators;
  pageAnalysis: PageAnalysis;
  textContentLength?: number;
  stats: {
    total: number;
    byConfidence: {
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
    averageConfidence: number;
    topDetection: DetectedTechnology | null;
  };

  rawData?: {
    headers: Record<string, string>;
    cookies: Record<string, string | undefined>;
    suspiciousElements: SuspiciousElement[];
    metaTags: Record<string, string>;
    sourceCode?: string;
  };
};

export type DetectionConfig = {
  mode: DetectionMode;
  includeRawData: boolean;
  blockingDetectionEnabled: boolean;
};

export type DetectionSource = {
  techKey: string;
  dataKey: keyof WebPageData;
  checkMethod: string;
  type: string;
};

export type SuspiciousElement = {
  tag: string;
  id: string;
  class: string;
};

export type TechData = Record<string, string | object | string[]>;
export type TechnologiesMap = Record<string, TechData>;
export type DetectionMode = "STRICT" | "NORMAL" | "LOOSE";
