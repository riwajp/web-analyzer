export type URLData = {
  source_code: string;
  headers: Headers;
  cookies: string;
  status_code: number;
  response_time: number;
  content_length: number;
  content_type: string;
  final_url: string; // After redirects
  redirect_count: number;
};

export type SiteData = {
  scriptSrc: string[];
  js: string[];
  meta: Record<string, string>;
  dom: any;
  assetUrls: string[];
  title: string;
  description: string;
  dom_element_count: number;
  text_content_length: number;
  script_count: number;
  image_count: number;
  link_count: number;
  form_count: number;
  has_captcha_elements: boolean;
  has_challenge_elements: boolean;
  suspicious_elements: string[];
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
  location: string; // Where the match was found
  matched_value: string; // What was actually matched
};

export type BlockingIndicators = {
  likely_blocked: boolean;
  blocking_score: number; // 0-100
  indicators: {
    status_code_suspicious: boolean;
    minimal_content: boolean;
    challenge_detected: boolean;
    captcha_detected: boolean;
    access_denied_text: boolean;
    suspicious_redirects: boolean;
    bot_detection_js: boolean;
    minimal_dom_elements: boolean;
    unusual_response_time: boolean;
  };
  suspicious_phrases: string[];
  challenge_type?: 'captcha' | 'javascript' | 'browser_check' | 'rate_limit' | 'access_denied';
};

export type PageAnalysis = {
  dom_element_count: number;
  page_size_bytes: number;
  page_size_human: string;
  dom_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  content_type: string;
  title: string;
  description: string;
  language: string;
  viewport: string;
  charset: string;
  has_forms: boolean;
  has_javascript: boolean;
  external_resources: number;
  internal_resources: number;
  performance_metrics: {
    fetch_time: number;
    parse_time: number;
    total_time: number;
  };
};

export type EnhancedDetectionResult = {
  url: string;
  final_url: string;
  status_code: number;
  technologies: EnhancedDetectedTechnology[];
  blocking_indicators: BlockingIndicators;
  page_analysis: PageAnalysis;
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
  raw_data?: {
    headers: Record<string, string>;
    cookies: string[];
    suspicious_elements: string[];
    meta_tags: Record<string, string>;
  };
};

export type DetectionResult = {
  url: string;
  final_url: string;
  status_code: number;
  technologies: DetectedTechnology[];
  blocking_indicators: BlockingIndicators;
  page_analysis: PageAnalysis;
  timings: {
    fetch: number;
    parse: number;
    detect: number;
    total: number;
  };
  raw_data?: {
    headers: Record<string, string>;
    cookies: string[];
    suspicious_elements: string[];
  };
};

export type TechnologiesMap = Record<string, any>;
export type DetectionMode = 'STRICT' | 'NORMAL' | 'LOOSE';

export type DetectionConfig = {
  mode: DetectionMode;
  maxExternalScripts: number;
  scriptTimeout: number;
  enableFuzzyMatching: boolean;
  enableEncodedMatching: boolean;
  includeRawData: boolean;
  blockingDetectionEnabled: boolean;
};