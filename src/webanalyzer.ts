import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import type { URLData, SiteData, EnhancedDetectedTechnology, DetectionConfig, BlockingIndicators, PageAnalysis, EnhancedDetectionResult, TechnologiesMap, DetectionMode, PatternMatch } from './types';
import { EnhancedPatternMatcher, EnhancedTechnologyDetector } from './patternMatcher';

class WebPage {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async fetchAndParse(): Promise<{ urlData: URLData; siteData: SiteData }> {
    try {
      const startTime = Date.now();
      let redirectCount = 0;
      const response = await fetch(this.url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const responseTime = Date.now() - startTime;
      const sourceCode = await response.text();
      const contentLength = sourceCode.length;

      if (response.url !== this.url) {
        redirectCount = 1;
      }

      const urlData: URLData = {
        sourceCode,
        headers: response.headers,
        cookies: response.headers.get('set-cookie') || '',
        statusCode: response.status,
        responseTime,
        contentLength,
        contentType: response.headers.get('content-type') || '',
        finalUrl: response.url,
        redirectCount,
      };

      const dom = new JSDOM(sourceCode);
      const doc = dom.window.document;

      const title = doc.querySelector('title')?.textContent?.trim() || '';
      const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      const allElements = doc.querySelectorAll('*');
      const domElementCount = allElements.length;

      const scriptCount = doc.querySelectorAll('script').length;
      const imageCount = doc.querySelectorAll('img').length;
      const linkCount = doc.querySelectorAll('link').length;
      const formCount = doc.querySelectorAll('form').length;

      const hasCaptchaElements = !!(
        doc.querySelector('.g-recaptcha') ||
        doc.querySelector('.h-captcha') ||
        doc.querySelector('.cf-turnstile') ||
        doc.querySelector('[data-sitekey]') ||
        sourceCode.includes('recaptcha') ||
        sourceCode.includes('hcaptcha') ||
        sourceCode.includes('turnstile')
      );

      const hasChallengeElements = !!(
        doc.querySelector('[id*="challenge"]') ||
        doc.querySelector('[class*="challenge"]') ||
        doc.querySelector('[id*="verification"]') ||
        doc.querySelector('[class*="verification"]') ||
        sourceCode.includes('challenge-platform') ||
        sourceCode.includes('browser-verification')
      );

      const suspiciousElements: string[] = [];
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
        '[class*="security"]',
      ];

      suspiciousSelectors.forEach((selector) => {
        const elements = doc.querySelectorAll(selector);
        elements.forEach((el) => {
          if ((el as Element).id) suspiciousElements.push(`#${(el as Element).id}`);
          if ((el as Element).className) suspiciousElements.push(`.${(el as Element).className.split(' ')[0]}`);
        });
      });

      const scriptSrc = Array.from(doc.querySelectorAll('script[src]'))
        .map((el) => el.getAttribute('src'))
        .filter((src): src is string => !!src);

      const assetUrls = [
        ...Array.from(doc.querySelectorAll('script[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('link[href]')).map((el) => el.getAttribute('href')),
        ...Array.from(doc.querySelectorAll('img[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('iframe[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('source[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('video[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('audio[src]')).map((el) => el.getAttribute('src')),
      ].filter((src): src is string => !!src);

      const js = Array.from(doc.querySelectorAll('script'))
        .map((el) => el.textContent || '')
        .filter((script) => script.trim());

      const meta: Record<string, string> = {};
      Array.from(doc.querySelectorAll('meta')).forEach((metaElement: HTMLElement) => {
        const nameAttr = metaElement.getAttribute('name') || metaElement.getAttribute('property');
        const contentAttr = metaElement.getAttribute('content');
        if (nameAttr && contentAttr) {
          meta[nameAttr.toLowerCase()] = contentAttr;
        }
      });

      const textContentLength = doc.body?.textContent?.trim().length || 0;

      const siteData: SiteData = {
        scriptSrc,
        js,
        meta,
        dom,
        assetUrls,
        title,
        description,
        domElementCount,
        textContentLength,
        scriptCount,
        imageCount,
        linkCount,
        formCount,
        hasCaptchaElements,
        hasChallengeElements,
        suspiciousElements,
      };

      return { urlData, siteData };
    } catch (error) {
      console.error(`Failed to fetch and parse ${this.url}:`, error);
      throw error;
    }
  }
}

class TechnologyDetector {
  private technologies: TechnologiesMap;
  private detectionMode: DetectionMode;

  constructor(technologies: TechnologiesMap, mode: DetectionMode = 'NORMAL') {
    this.technologies = technologies;
    this.detectionMode = mode;
  }

  setDetectionMode(mode: DetectionMode) {
    this.detectionMode = mode;
    console.log(`Detection mode set to: ${mode}`);
  }

  detectTechnologies(urlData: URLData, siteData: SiteData): EnhancedDetectedTechnology[] {
    const detectedTechnologies: EnhancedDetectedTechnology[] = [];
    const visited = new Set<string>();
    const minConfidence = {
      STRICT: 80,
      NORMAL: 60,
      LOOSE: 40,
    }[this.detectionMode];

    console.log(`[DEBUG] Detection mode: ${this.detectionMode}, Min confidence: ${minConfidence}%`);
    console.log(`[DEBUG] Analyzing ${siteData.js.length} scripts, ${siteData.assetUrls.length} assets`);

    const detect = (techName: string) => {
      if (visited.has(techName)) return;
      visited.add(techName);

      const techData = this.technologies[techName];
      if (!techData) return;

      const result = this.detectTechnologyWithConfidence(techName, techData, siteData, urlData);
      const confidenceLevel = EnhancedPatternMatcher.getConfidenceLevel(result.confidence);

      console.log(`[DEBUG] ${techName}: ${result.confidence.toFixed(1)}% confidence (${confidenceLevel})`);
      if (result.confidence >= minConfidence) {
        console.log(`[DETECTED] ${techName} - ${result.confidence.toFixed(1)}% confidence`);
        detectedTechnologies.push({
          name: techName,
          confidence: Math.round(result.confidence * 10) / 10,
          confidenceLevel,
          detectedUsing: result.detectedUsing,
          matches: result.matches,
        });

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

    for (const techName of Object.keys(this.technologies)) {
      detect(techName);
    }

    return detectedTechnologies.sort((a, b) => b.confidence - a.confidence);
  }

  private detectTechnologyWithConfidence(
    techName: string,
    techData: any,
    siteData: SiteData,
    urlData: URLData
  ): { confidence: number; matches: PatternMatch[]; detectedUsing: string[] } {
    // Use the EnhancedTechnologyDetector from patternMatcher.ts to avoid duplication
    const result = EnhancedTechnologyDetector.detectTechnologyWithConfidence(techName, techData, siteData, urlData);
    return {
      confidence: result.confidence,
      matches: result.matches,
      detectedUsing: result.detectedUsing,
    };
  }
}

class Analyzer {
  private url: string;
  private config: DetectionConfig;
  private technologies: TechnologiesMap;

  constructor(url: string, config: DetectionConfig, technologies: TechnologiesMap) {
    this.url = url;
    this.config = config;
    this.technologies = technologies;
  }

  async analyze(): Promise<EnhancedDetectionResult> {
    const timings: Record<string, number> = {};

    try {
      timings.fetchStart = performance.now();
      const webPage = new WebPage(this.url);
      const { urlData, siteData } = await webPage.fetchAndParse();
      timings.afterFetch = performance.now();

      const detector = new TechnologyDetector(this.technologies, this.config.mode);
      const technologies = detector.detectTechnologies(urlData, siteData);
      timings.afterDetect = performance.now();

      const blockingIndicators = this.config.blockingDetectionEnabled
        ? this.analyzeBlocking(siteData, urlData)
        : this.getDefaultBlockingIndicators();

      const pageAnalysis = this.analyzePageMetrics(siteData, urlData, {
        fetch: timings.afterFetch - timings.fetchStart,
        parse: timings.afterDetect - timings.afterFetch,
        total: timings.afterDetect - timings.fetchStart,
      });

      const stats = this.getDetectionStats(technologies);
      timings.afterAnalysis = performance.now();

      const rawData = this.config.includeRawData
        ? {
            headers: Object.fromEntries(urlData.headers.entries()),
            cookies: urlData.cookies ? [urlData.cookies] : [],
            suspiciousElements: siteData.suspiciousElements,
            metaTags: siteData.meta,
          }
        : undefined;

      return {
        url: this.url,
        finalUrl: urlData.finalUrl,
        statusCode: urlData.statusCode,
        technologies,
        blockingIndicators,
        pageAnalysis,
        stats,
        timings: {
          fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
          parse: +(timings.afterDetect - timings.afterFetch).toFixed(2),
          detect: +(timings.afterAnalysis - timings.afterDetect).toFixed(2),
          total: +(timings.afterAnalysis - timings.fetchStart).toFixed(2),
        },
        rawData,
      };
    } catch (error) {
      console.error(`Error analyzing ${this.url}:`, error);
      return this.getDefaultResult();
    }
  }

  private checkBotProtectionPatterns(
    techData: any,
    content: {
      fullContent: string;
      allScripts: string;
      allCookies: string;
      allHeaders: string;
      suspiciousElements: string[];
    }
  ): { detected: boolean; score: number; phrases: string[] } {
    const phrases: string[] = [];
    let score = 0;
    let detected = false;

    // Check HTML patterns
    if (techData.html && Array.isArray(techData.html)) {
      for (const htmlPattern of techData.html) {
        if (content.fullContent.includes(htmlPattern.toLowerCase())) {
          phrases.push(htmlPattern);
          score += 15;
          detected = true;
        }
      }
    }

    // Check JavaScript patterns
    if (techData.js && Array.isArray(techData.js)) {
      for (const jsPattern of techData.js) {
        if (content.allScripts.includes(jsPattern.toLowerCase())) {
          score += 10;
          detected = true;
        }
      }
    }

    // Check script source patterns
    if (techData.scriptSrc && Array.isArray(techData.scriptSrc)) {
      for (const scriptPattern of techData.scriptSrc) {
        if (content.allScripts.includes(scriptPattern.toLowerCase())) {
          score += 12;
          detected = true;
        }
      }
    }

    // Check cookie patterns
    if (techData.cookies && typeof techData.cookies === 'object') {
      for (const cookieName of Object.keys(techData.cookies)) {
        if (content.allCookies.includes(cookieName.toLowerCase())) {
          score += 20;
          detected = true;
        }
      }
    }

    // Check header patterns
    if (techData.headers && typeof techData.headers === 'object') {
      for (const headerName of Object.keys(techData.headers)) {
        if (content.allHeaders.includes(headerName.toLowerCase())) {
          score += 18;
          detected = true;
        }
      }
    }

    // Check DOM patterns
    if (techData.dom && typeof techData.dom === 'object') {
      for (const domSelector of Object.keys(techData.dom)) {
        if (content.suspiciousElements.some(el => el.includes(domSelector))) {
          score += 15;
          detected = true;
        }
      }
    }

    return { detected, score, phrases };
  }

  private analyzeBlocking(siteData: SiteData, urlData: URLData): BlockingIndicators {
    const indicators = {
      statusCodeSuspicious: false,
      minimalContent: false,
      challengeDetected: false,
      captchaDetected: false,
      accessDeniedText: false,
      suspiciousRedirects: false,
      botDetectionJs: false,
      minimalDomElements: false,
      unusualResponseTime: false,
    };

    const suspiciousPhrases: string[] = [];
    let blockingScore = 0;
    const detectedBotProtectionTechs: string[] = [];

    const SUSPICIOUS_STATUS_CODES = [403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527, 530];
    const SUSPICIOUS_TITLES = [
      'just a moment', 'please wait', 'access denied', 'blocked', 'error',
      'forbidden', 'unauthorized', 'security check', 'ddos protection', 'bot detection'
    ];

    // Check status codes
    if (SUSPICIOUS_STATUS_CODES.includes(urlData.statusCode)) {
      indicators.statusCodeSuspicious = true;
      blockingScore += 30;
    }

    // Check for minimal content
    if (siteData.textContentLength < 500 && siteData.domElementCount < 50) {
      indicators.minimalContent = true;
      blockingScore += 20;
    }

    if (siteData.domElementCount < 10) {
      indicators.minimalDomElements = true;
      blockingScore += 25;
    }

    // Check for challenge elements using tech.json patterns
    if (siteData.hasChallengeElements) {
      indicators.challengeDetected = true;
      blockingScore += 25;
    }

    if (siteData.hasCaptchaElements) {
      indicators.captchaDetected = true;
      blockingScore += 30;
    }
    const fullContent = `${siteData.title} ${siteData.description} ${urlData.sourceCode}`.toLowerCase();
    const allScripts = [...siteData.scriptSrc, ...siteData.js].join(' ').toLowerCase();
    const allCookies = urlData.cookies.toLowerCase();
    const allHeaders = Array.from(urlData.headers.entries()).map(([k, v]) => `${k}: ${v}`).join(' ').toLowerCase();

    // Check all technologies for bot protection patterns
    for (const [techName, techData] of Object.entries(this.technologies)) {
      // Skip technologies without any patterns
      if (!techData.html && !techData.js && !techData.scriptSrc && 
          !techData.cookies && !techData.headers && !techData.dom) {
        continue;
      }

      const techResult = this.checkBotProtectionPatterns(techData, {
        fullContent,
        allScripts,
        allCookies,
        allHeaders,
        suspiciousElements: siteData.suspiciousElements
      });

      if (techResult.detected) {
        detectedBotProtectionTechs.push(techName);
        suspiciousPhrases.push(...techResult.phrases);
        blockingScore += Math.min(techResult.score, 25); // Cap per technology
        indicators.botDetectionJs = true;
        console.log(`[BOT PROTECTION] Detected: ${techName} (score: ${techResult.score})`);
      }
    }

    // Check for suspicious titles
    const lowerTitle = siteData.title.toLowerCase();
    if (SUSPICIOUS_TITLES.some((title) => lowerTitle.includes(title))) {
      indicators.accessDeniedText = true;
      blockingScore += 20;
    }

    // Check for redirects
    if (urlData.redirectCount > 2) {
      indicators.suspiciousRedirects = true;
      blockingScore += 10;
    }

    // Check response time
    if (urlData.responseTime < 100) {
      indicators.unusualResponseTime = true;
      blockingScore += 5;
    }

    // Determine challenge type based on detected technologies
    let challengeType: 'captcha' | 'javascript' | 'browser_check' | 'rate_limit' | 'access_denied' | undefined;
    
    // Check for CAPTCHA technologies
    const captchaKeywords = ['captcha', 'recaptcha', 'hcaptcha', 'turnstile', 'geetest', 'keycaptcha', 'arkose', 'funcaptcha'];
    if (detectedBotProtectionTechs.some(tech => 
      captchaKeywords.some(keyword => tech.toLowerCase().includes(keyword))
    )) {
      challengeType = 'captcha';
    } 
    // Check for DDoS protection technologies
    else if (detectedBotProtectionTechs.some(tech => 
      ['cloudflare', 'datadome', 'imperva', 'akamai', 'perimeterx', 'incapsula'].some(keyword => 
        tech.toLowerCase().includes(keyword)
      )
    )) {
      challengeType = 'javascript';
    } 
    // Check for browser verification
    else if (suspiciousPhrases.some((p) => p.includes('browser'))) {
      challengeType = 'browser_check';
    } 
    // Check for rate limiting
    else if (urlData.statusCode === 429) {
      challengeType = 'rate_limit';
    } 
    // Check for access denied
    else if (indicators.accessDeniedText) {
      challengeType = 'access_denied';
    }

    return {
      likelyBlocked: blockingScore >= 40,
      blockingScore: Math.min(blockingScore, 100),
      indicators,
      suspiciousPhrases,
      challengeType,
      detectedBotProtectionTechs, // Add detected technologies for better insights
    };
  }

  private analyzePageMetrics(siteData: SiteData, urlData: URLData, timings: any): PageAnalysis {
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
      pageSizeBytes: urlData.contentLength,
      pageSizeHuman: formatBytes(urlData.contentLength),
      domElementCount: siteData.domElementCount,
      domComplexity: getDomComplexity(siteData.domElementCount),
      contentType: urlData.contentType,
      title: siteData.title,
      description: siteData.description,
      language: siteData.meta['language'] || siteData.meta['lang'] || 'unknown',
      viewport: siteData.meta['viewport'] || 'not set',
      charset: siteData.meta['charset'] || 'unknown',
      hasForms: siteData.formCount > 0,
      hasJavascript: siteData.scriptCount > 0,
      externalResources: siteData.assetUrls.filter((url) => url.startsWith('http')).length,
      internalResources: siteData.assetUrls.filter((url) => !url.startsWith('http')).length,
      performanceMetrics: {
        fetchTime: timings.fetch || 0,
        parseTime: timings.parse || 0,
        totalTime: timings.total || 0,
      },
    };
  }

  private getDetectionStats(results: EnhancedDetectedTechnology[]) {
    return {
      total: results.length,
      byConfidence: {
        HIGH: results.filter((r) => r.confidenceLevel === 'HIGH').length,
        MEDIUM: results.filter((r) => r.confidenceLevel === 'MEDIUM').length,
        LOW: results.filter((r) => r.confidenceLevel === 'LOW').length,
      },
      averageConfidence:
        results.length > 0
          ? Math.round((results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 10) / 10
          : 0,
      topDetection: results.length > 0 ? results[0] : null,
    };
  }

  private getDefaultBlockingIndicators(): BlockingIndicators {
    return {
      likelyBlocked: false,
      blockingScore: 0,
      indicators: {
        statusCodeSuspicious: false,
        minimalContent: false,
        challengeDetected: false,
        captchaDetected: false,
        accessDeniedText: false,
        suspiciousRedirects: false,
        botDetectionJs: false,
        minimalDomElements: false,
        unusualResponseTime: false,
      },
      suspiciousPhrases: [],
      challengeType: undefined,
      detectedBotProtectionTechs: [],
    };
  }

  public getDefaultResult(): EnhancedDetectionResult {
    return {
      url: this.url,
      finalUrl: this.url,
      statusCode: 0,
      technologies: [],
      blockingIndicators: this.getDefaultBlockingIndicators(),
      pageAnalysis: {
        pageSizeBytes: 0,
        pageSizeHuman: '0 Bytes',
        domElementCount: 0,
        domComplexity: 'LOW',
        contentType: 'unknown',
        title: '',
        description: '',
        language: 'unknown',
        viewport: 'not set',
        charset: 'unknown',
        hasForms: false,
        hasJavascript: false,
        externalResources: 0,
        internalResources: 0,
        performanceMetrics: {
          fetchTime: 0,
          parseTime: 0,
          totalTime: 0,
        },
      },
      stats: {
        total: 0,
        byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        averageConfidence: 0,
        topDetection: null,
      },
      timings: { fetch: 0, parse: 0, detect: 0, total: 0 },
    };
  }
}

const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,
  defaultConfig: {
    mode: 'NORMAL' as DetectionMode,
    maxExternalScripts: 10,
    scriptTimeout: 5000,
    enableFuzzyMatching: true,
    enableEncodedMatching: true,
    includeRawData: false,
    blockingDetectionEnabled: true,
  },

  init(dataFiles: string[]) {
    for (const file of dataFiles) {
      const filePath = path.resolve(file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const technologiesFromFile: TechnologiesMap = JSON.parse(fileContent);
      this.technologies = { ...this.technologies, ...technologiesFromFile };
    }
    this.initialized = true;
    console.log(`Loaded ${Object.keys(this.technologies).length} technologies.`);
  },

  async analyze(url: string, config: Partial<DetectionConfig> = {}): Promise<EnhancedDetectionResult> {
    if (!this.initialized) {
      this.init(['src/data/tech.json']);
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    const analyzer = new Analyzer(url, finalConfig, this.technologies);
    return await analyzer.analyze();
  },

  getDefaultResult(url: string): EnhancedDetectionResult {
    const analyzer = new Analyzer(url, this.defaultConfig, this.technologies);
    return analyzer.getDefaultResult();
  },
};

export default WebAnalyzer;