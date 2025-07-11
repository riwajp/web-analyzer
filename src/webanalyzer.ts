import { JSDOM } from "jsdom";
import type { SiteData, TechnologiesMap, URLData } from "./types";
import { EnhancedTechnologyDetector, EnhancedPatternMatcher } from "./patternMatcher";
import fs from "fs";
import path from "path";

// Updated DetectedTechnology interface
export interface EnhancedDetectedTechnology {
  name: string;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  detectedUsing: string[];
  matches: any[];
}

const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,

  // Confidence thresholds for detection
  CONFIDENCE_THRESHOLDS: {
    STRICT: 80,    // Only very confident detections
    NORMAL: 60,    // Balanced detection
    LOOSE: 40      // More permissive detection
  },

  // Detection mode
  detectionMode: 'NORMAL' as 'STRICT' | 'NORMAL' | 'LOOSE',

  init: (data_files: string[]) => {
    for (const file of data_files) {
      const filePath = path.resolve(file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const technologiesFromFile: TechnologiesMap = JSON.parse(fileContent);
      WebAnalyzer.technologies = { ...WebAnalyzer.technologies, ...technologiesFromFile };
    }
    WebAnalyzer.initialized = true;
    console.log(`Loaded ${Object.keys(WebAnalyzer.technologies).length} technologies.`);
  },

  fetchURL: async (url: string): Promise<URLData> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return {
        source_code: await response.text(),
        headers: response.headers,
        cookies: response.headers.get("set-cookie") || "",
      };
    } catch (error) {
      console.error(`Failed to fetch URL: ${url}`, error);
      throw error;
    }
  },

  parseSourceCode: async (source_code: string, baseUrl?: string): Promise<SiteData> => {
    const dom = new JSDOM(source_code);
    const doc = dom.window.document;

    const scriptSrc = Array.from<HTMLElement>(doc.querySelectorAll("script[src]"))
      .map((el) => el.getAttribute("src"))
      .filter((src) => src != null);

    const assetUrls = [
      ...Array.from(doc.querySelectorAll("script[src]")).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("link[href]")).map(el => el.getAttribute("href")),
      ...Array.from(doc.querySelectorAll("img[src]")).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("iframe[src]")).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("source[src]")).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("video[src]")).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("audio[src]")).map(el => el.getAttribute("src")),
    ].filter((src): src is string => !!src);

    // Extract inline script text content
    let js = Array.from<HTMLElement>(doc.querySelectorAll("script"))
      .map((el) => el.textContent || "")
      .filter((script) => script.trim());

    if (baseUrl && scriptSrc.length > 0) {
      const fetchPromises = scriptSrc.slice(0, 100).map(async (src) => {
        try {
          const url = src.startsWith("http") ? src : new URL(src, baseUrl).href;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const res = await fetch(url, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebAnalyzer/1.0)' }
          });
          clearTimeout(timeoutId);
          
          if (res.ok && res.headers.get('content-type')?.includes('javascript')) {
            const text = await res.text();
            return text;
          }
        } catch (e) {
          console.debug(`Failed to fetch external script: ${src}`);
        }
        return null;
      });
      
      const externalJs = await Promise.all(fetchPromises);
      js = js.concat(externalJs.filter(Boolean) as string[]);
    }
    const meta: Record<string, string> = {};
    Array.from<HTMLElement>(doc.querySelectorAll("meta")).forEach((metaElement) => {
      const nameAttr = metaElement.getAttribute("name") || metaElement.getAttribute("property");
      const contentAttr = metaElement.getAttribute("content");
      if (nameAttr && contentAttr) {
        meta[nameAttr.toLowerCase()] = contentAttr;
      }
    });

    return { scriptSrc, js, meta, dom, assetUrls };
  },

  detectPatterns: (site_data: SiteData, url_data: URLData): EnhancedDetectedTechnology[] => {
    const detectedTechnologies: EnhancedDetectedTechnology[] = [];
    const visited = new Set<string>();
    
    const minConfidence = WebAnalyzer.CONFIDENCE_THRESHOLDS[WebAnalyzer.detectionMode];

    console.log(`[DEBUG] Detection mode: ${WebAnalyzer.detectionMode}, Min confidence: ${minConfidence}%`);
    console.log(`[DEBUG] Analyzing ${site_data.js.length} scripts, ${site_data.assetUrls.length} assets`);

    const detect = (techName: string) => {
      if (visited.has(techName)) return;
      visited.add(techName);

      const techData = WebAnalyzer.technologies[techName];
      if (!techData) return;

      const result = EnhancedTechnologyDetector.detectTechnologyWithConfidence(
        techName,
        techData,
        site_data,
        url_data
      );

      const confidenceLevel = EnhancedPatternMatcher.getConfidenceLevel(result.confidence);
      
      console.log(`[DEBUG] ${techName}: ${result.confidence.toFixed(1)}% confidence (${confidenceLevel})`);
      if (result.confidence >= minConfidence) {
        console.log(`[DETECTED] ${techName} - ${result.confidence.toFixed(1)}% confidence`);
        
        const detectedTech: EnhancedDetectedTechnology = {
          name: techName,
          confidence: Math.round(result.confidence * 10) / 10, // Round to 1 decimal
          confidenceLevel,
          detectedUsing: result.detectedUsing,
          matches: result.matches
        };

        detectedTechnologies.push(detectedTech);

        if (techData.implies) {
          const impliedTechs = Array.isArray(techData.implies) ? techData.implies : [techData.implies];
          impliedTechs.forEach(detect);
        }

        if (techData.requires) {
          const requiredTechs = Array.isArray(techData.requires) ? techData.requires : [techData.requires];
          requiredTechs.forEach(detect);
        }
      }
    };


    for (const techName of Object.keys(WebAnalyzer.technologies)) {
      detect(techName);
    }

    detectedTechnologies.sort((a, b) => b.confidence - a.confidence);

    return detectedTechnologies;
  },


  setDetectionMode: (mode: 'STRICT' | 'NORMAL' | 'LOOSE') => {
    WebAnalyzer.detectionMode = mode;
    console.log(`Detection mode set to: ${mode}`);
  },


  getDetectionStats: (results: EnhancedDetectedTechnology[]) => {
    const stats = {
      total: results.length,
      byConfidence: {
        HIGH: results.filter(r => r.confidenceLevel === 'HIGH').length,
        MEDIUM: results.filter(r => r.confidenceLevel === 'MEDIUM').length,
        LOW: results.filter(r => r.confidenceLevel === 'LOW').length,
      },
      averageConfidence: results.length > 0 
        ? Math.round((results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 10) / 10
        : 0,
      topDetection: results.length > 0 ? results[0] : null
    };

    return stats;
  },

  matchPattern: (value: string, pattern: string | Record<string, string>): boolean => {
    if (typeof pattern === "string") {
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(value);
      } catch {
        return value.includes(pattern);
      }
    }
    if (typeof pattern === "object") {
      return Object.entries(pattern).every(([key, val]) => {
        if (key.toLowerCase() !== key) key = key.toLowerCase();
        return (
          value.toLowerCase().includes(key) &&
          (val === "" || new RegExp(val, "i").test(value))
        );
      });
    }
    return false;
  },
};

export default WebAnalyzer;