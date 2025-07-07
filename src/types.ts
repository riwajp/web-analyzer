export type URLData = {
  source_code: string;
  headers: Headers;
  cookies: string;
};

export type SiteData = {
  scriptSrc: string[];
  js: string[];
  meta: Record<string, string>;
};

export type DetectedTechnology = {
  name: string;
  detectedUsing: string | null;
};

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
