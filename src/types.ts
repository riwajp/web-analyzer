// Updated types.ts with enhanced detection support

export type URLData = {
  source_code: string;
  headers: Headers;
  cookies: string;
};

export type SiteData = {
  scriptSrc: string[];
  js: string[];
  meta: Record<string, string>;
  dom: any;
  assetUrls: string[];
};

// Legacy type for backward compatibility
export type DetectedTechnology = {
  name: string;
  detectedUsing: string | null;
};

// Enhanced detection result
export type EnhancedDetectedTechnology = {
  name: string;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  detectedUsing: string[];
  matches: PatternMatch[];
};

// Pattern matching types
export type PatternMatch = {
  pattern: string;
  confidence: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'exact' | 'regex' | 'fuzzy' | 'encoded';
};

// Enhanced detection result
export type EnhancedDetectionResult = {
  url: string;
  technologies: EnhancedDetectedTechnology[];
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
};

// Legacy detection result for backward compatibility
export type DetectionResult = {
  url: string;
  technologies: DetectedTechnology[];
  timings: {
    fetch: number;
    parse: number;
    detect: number;
    total: number;
  };
};

export type TechnologiesMap = Record<string, any>;

// Configuration types
export type DetectionMode = 'STRICT' | 'NORMAL' | 'LOOSE';

export type DetectionConfig = {
  mode: DetectionMode;
  maxExternalScripts: number;
  scriptTimeout: number;
  enableFuzzyMatching: boolean;
  enableEncodedMatching: boolean;
};