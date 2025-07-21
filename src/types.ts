export type URLData = {
  sourceCode: string;
  headers: Headers;
  cookies: Record<string, any>;
  statusCode: number;
  responseTime: number;
  contentLength: number;
  contentType: string;
  finalUrl: string;
  redirectCount: number;
};

export type SiteData = {
  scriptSrc: string[];
  js: string[];
  meta: Record<string, string>;
  dom: any;
  assetUrls: string[];
  title: string;
  description: string;
  domElementCount: number;
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
    accessDeniedText: boolean;
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
  domElementCount: number;
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
  internalResources: number;
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
    cookies: string[];
    suspiciousElements: string[];
    metaTags: Record<string, string>;
  };
};

export type DetectionConfig = {
  mode: DetectionMode;
  maxExternalScripts: number;
  scriptTimeout: number;
  enableFuzzyMatching: boolean;
  enableEncodedMatching: boolean;
  includeRawData: boolean;
  blockingDetectionEnabled: boolean;
};

export type TechnologiesMap = Record<string, any>;
export type DetectionMode = "STRICT" | "NORMAL" | "LOOSE";
