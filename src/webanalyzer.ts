import { JSDOM } from "jsdom";
import type { SiteData, TechnologiesMap, URLData, BlockingIndicators, PageAnalysis } from "./types";
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

 
  CONFIDENCE_THRESHOLDS: {
    STRICT: 80,    
    NORMAL: 60,   
    LOOSE: 40      
  },

  // Detection mode
  detectionMode: 'NORMAL' as 'STRICT' | 'NORMAL' | 'LOOSE',

  // Blocking detection patterns
  BLOCKING_PATTERNS: {
    CHALLENGE_PHRASES: [
      'checking your browser',
      'please wait',
      'ddos protection',
      'ray id',
      'cloudflare',
      'access denied',
      'blocked',
      'captcha',
      'bot detection',
      'security check',
      'please enable javascript',
      'browser verification',
      'challenge platform',
      'verify you are human',
      'unusual traffic',
      'suspicious activity',
      'rate limit',
      'too many requests',
      'forbidden',
      'not authorized',
      'incapsula incident',
      'perimeterx',
      'datadome',
      'imperva',
      'akamai',
      'protection by',
      'firewall',
      'security service'
    ],
    SUSPICIOUS_TITLES: [
      'just a moment',
      'please wait',
      'access denied',
      'blocked',
      'error',
      'forbidden',
      'unauthorized',
      'security check',
      'ddos protection',
      'bot detection'
    ],
    SUSPICIOUS_STATUS_CODES: [403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527, 530],
    BOT_DETECTION_SCRIPTS: [
      'challenge-platform',
      'datadome',
      'perimeterx',
      'incapsula',
      'imperva',
      'akamai',
      'bot-detection',
      'anti-bot',
      'security-check',
      'captcha',
      'recaptcha',
      'hcaptcha',
      'turnstile'
    ]
  },

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
    const startTime = Date.now();
    let redirectCount = 0;
    let currentUrl = url;
    
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const responseTime = Date.now() - startTime;
      const source_code = await response.text();
      const contentLength = source_code.length;
      
      if (response.url !== url) {
        redirectCount = 1; 
      }

      return {
        source_code,
        headers: response.headers,
        cookies: response.headers.get("set-cookie") || "",
        status_code: response.status,
        response_time: responseTime,
        content_length: contentLength,
        content_type: response.headers.get('content-type') || '',
        final_url: response.url,
        redirect_count: redirectCount
      };
    } catch (error) {
      console.error(`Failed to fetch URL: ${url}`, error);
      throw error;
    }
  },

  parseSourceCode: async (source_code: string, baseUrl?: string): Promise<SiteData> => {
    const dom = new JSDOM(source_code);
    const doc = dom.window.document;

    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    const allElements = doc.querySelectorAll('*');
    const dom_element_count = allElements.length;
    
    // Count specific element types
    const script_count = doc.querySelectorAll('script').length;
    const image_count = doc.querySelectorAll('img').length;
    const link_count = doc.querySelectorAll('link').length;
    const form_count = doc.querySelectorAll('form').length;

    // Check for CAPTCHA and challenge elements
    const has_captcha_elements = !!(
      doc.querySelector('.g-recaptcha') ||
      doc.querySelector('.h-captcha') ||
      doc.querySelector('.cf-turnstile') ||
      doc.querySelector('[data-sitekey]') ||
      source_code.includes('recaptcha') ||
      source_code.includes('hcaptcha') ||
      source_code.includes('turnstile')
    );

    const has_challenge_elements = !!(
      doc.querySelector('[id*="challenge"]') ||
      doc.querySelector('[class*="challenge"]') ||
      doc.querySelector('[id*="verification"]') ||
      doc.querySelector('[class*="verification"]') ||
      source_code.includes('challenge-platform') ||
      source_code.includes('browser-verification')
    );

    // Find suspicious elements
    const suspicious_elements: string[] = [];
    const suspiciousSelectors = [
      '[id*="challenge"]',
      '[class*="challenge"]',
      '[id*="captcha"]',
      '[class*="captcha"]',
      '[id*="block"]',
      '[class*="block"]',
      '[id*="protection"]',
      '[class*="protection"]',
      '[id*="security"]',
      '[class*="security"]'
    ];

    suspiciousSelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.id) suspicious_elements.push(`#${el.id}`);
        if (el.className) suspicious_elements.push(`.${el.className.split(' ')[0]}`);
      });
    });

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


    let js = Array.from<HTMLElement>(doc.querySelectorAll("script"))
      .map((el) => el.textContent || "")
      .filter((script) => script.trim());

    // Fetch external scripts (limited for performance)
    if (baseUrl && scriptSrc.length > 0) {
      const fetchPromises = scriptSrc.slice(0, 10).map(async (src) => {
        try {
          const url = src.startsWith("http") ? src : new URL(src, baseUrl).href;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
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

    // Extract meta tags
    const meta: Record<string, string> = {};
    Array.from<HTMLElement>(doc.querySelectorAll("meta")).forEach((metaElement) => {
      const nameAttr = metaElement.getAttribute("name") || metaElement.getAttribute("property");
      const contentAttr = metaElement.getAttribute("content");
      if (nameAttr && contentAttr) {
        meta[nameAttr.toLowerCase()] = contentAttr;
      }
    });

    // Calculate text content length
    const text_content_length = doc.body?.textContent?.trim().length || 0;

    return { 
      scriptSrc, 
      js, 
      meta, 
      dom, 
      assetUrls,
      title,
      description,
      dom_element_count,
      text_content_length,
      script_count,
      image_count,
      link_count,
      form_count,
      has_captcha_elements,
      has_challenge_elements,
      suspicious_elements
    };
  },

  analyzeBlocking: (site_data: SiteData, url_data: URLData): BlockingIndicators => {
    const indicators = {
      status_code_suspicious: false,
      minimal_content: false,
      challenge_detected: false,
      captcha_detected: false,
      access_denied_text: false,
      suspicious_redirects: false,
      bot_detection_js: false,
      minimal_dom_elements: false,
      unusual_response_time: false
    };

    const suspicious_phrases: string[] = [];
    let blocking_score = 0;

    // Check status code
    if (WebAnalyzer.BLOCKING_PATTERNS.SUSPICIOUS_STATUS_CODES.includes(url_data.status_code)) {
      indicators.status_code_suspicious = true;
      blocking_score += 30;
    }

    // Check for minimal content
    if (site_data.text_content_length < 500 && site_data.dom_element_count < 50) {
      indicators.minimal_content = true;
      blocking_score += 20;
    }

    // Check for minimal DOM elements
    if (site_data.dom_element_count < 10) {
      indicators.minimal_dom_elements = true;
      blocking_score += 25;
    }

    // Check for challenge/captcha elements
    if (site_data.has_challenge_elements) {
      indicators.challenge_detected = true;
      blocking_score += 25;
    }

    if (site_data.has_captcha_elements) {
      indicators.captcha_detected = true;
      blocking_score += 30;
    }

    // Check for suspicious phrases in content
    const fullContent = `${site_data.title} ${site_data.description} ${url_data.source_code}`.toLowerCase();
    
    WebAnalyzer.BLOCKING_PATTERNS.CHALLENGE_PHRASES.forEach(phrase => {
      if (fullContent.includes(phrase.toLowerCase())) {
        suspicious_phrases.push(phrase);
        blocking_score += 5;
      }
    });

    // Check for suspicious title
    const lowerTitle = site_data.title.toLowerCase();
    if (WebAnalyzer.BLOCKING_PATTERNS.SUSPICIOUS_TITLES.some(title => lowerTitle.includes(title))) {
      indicators.access_denied_text = true;
      blocking_score += 20;
    }

    // Check for bot detection scripts
    const allScripts = [...site_data.scriptSrc, ...site_data.js].join(' ').toLowerCase();
    if (WebAnalyzer.BLOCKING_PATTERNS.BOT_DETECTION_SCRIPTS.some(script => allScripts.includes(script))) {
      indicators.bot_detection_js = true;
      blocking_score += 15;
    }

    // Check for suspicious redirects
    if (url_data.redirect_count > 2) {
      indicators.suspicious_redirects = true;
      blocking_score += 10;
    }

    // Check for unusual response time (very fast might indicate immediate blocking)
    if (url_data.response_time < 100) {
      indicators.unusual_response_time = true;
      blocking_score += 5;
    }

    // Determine challenge type
    let challenge_type: 'captcha' | 'javascript' | 'browser_check' | 'rate_limit' | 'access_denied' | undefined;
    
    if (indicators.captcha_detected) {
      challenge_type = 'captcha';
    } else if (indicators.challenge_detected) {
      challenge_type = 'javascript';
    } else if (suspicious_phrases.some(p => p.includes('browser'))) {
      challenge_type = 'browser_check';
    } else if (url_data.status_code === 429) {
      challenge_type = 'rate_limit';
    } else if (indicators.access_denied_text) {
      challenge_type = 'access_denied';
    }

    return {
      likely_blocked: blocking_score >= 40,
      blocking_score: Math.min(blocking_score, 100),
      indicators,
      suspicious_phrases,
      challenge_type
    };
  },

  analyzePageMetrics: (site_data: SiteData, url_data: URLData, timings: any): PageAnalysis => {
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getDomComplexity = (elementCount: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
      if (elementCount < 100) return 'LOW';
      if (elementCount < 1000) return 'MEDIUM';
      return 'HIGH';
    };

    return {
      page_size_bytes: url_data.content_length,
      page_size_human: formatBytes(url_data.content_length),
      dom_element_count: site_data.dom_element_count,
      dom_complexity: getDomComplexity(site_data.dom_element_count),
      content_type: url_data.content_type,
      title: site_data.title,
      description: site_data.description,
      language: site_data.meta['language'] || site_data.meta['lang'] || 'unknown',
      viewport: site_data.meta['viewport'] || 'not set',
      charset: site_data.meta['charset'] || 'unknown',
      has_forms: site_data.form_count > 0,
      has_javascript: site_data.script_count > 0,
      external_resources: site_data.assetUrls.filter(url => url.startsWith('http')).length,
      internal_resources: site_data.assetUrls.filter(url => !url.startsWith('http')).length,
      performance_metrics: {
        fetch_time: timings.fetch || 0,
        parse_time: timings.parse || 0,
        total_time: timings.total || 0
      }
    };
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
          confidence: Math.round(result.confidence * 10) / 10,
          confidenceLevel,
          detectedUsing: Array.isArray(result.detectedUsing) ? result.detectedUsing : [result.detectedUsing].filter(Boolean),
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