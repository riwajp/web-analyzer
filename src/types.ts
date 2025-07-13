export type URLData = {
  sourceCode: string;
  headers: Headers;
  cookies: string;
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
  hasCaptchaElements: boolean;
  hasChallengeElements: boolean;
  suspiciousElements: string[];
};

export type DetectedTechnology = {
  name: string;
  detectedUsing: string[];
};

export type EnhancedDetectedTechnology = {
  name: string;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  detectedUsing: string[];
  matches: PatternMatch[];
};

export type PatternMatch = {
  pattern: string;
  confidence: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'exact' | 'regex' | 'fuzzy' | 'encoded';
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
  challengeType?: 'captcha' | 'javascript' | 'browser_check' | 'rate_limit' | 'access_denied';
};

export type PageAnalysis = {
  domElementCount: number;
  pageSizeBytes: number;
  pageSizeHuman: string;
  domComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
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
  performanceMetrics: {
    fetchTime: number;
    parseTime: number;
    totalTime: number;
  };
};

export type EnhancedDetectionResult = {
  url: string;
  finalUrl: string;
  statusCode: number;
  technologies: EnhancedDetectedTechnology[];
  blockingIndicators: BlockingIndicators;
  pageAnalysis: PageAnalysis;
  stats: {
    total: number;
    byConfidence: {
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
    averageConfidence: number;
    topDetection: EnhancedDetectedTechnology | null;
  };
  timings: {
    fetch: number;
    parse: number;
    detect: number;
    total: number;
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
export type DetectionMode = 'STRICT' | 'NORMAL' | 'LOOSE';