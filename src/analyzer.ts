import { performance } from 'perf_hooks';
import { TechnologyDetector } from './technologyDetector';
import type { URLData, SiteData, EnhancedDetectionResult, DetectionConfig, BlockingIndicators, PageAnalysis, EnhancedDetectedTechnology, TechnologiesMap } from './types';

export class Analyzer {
  private url: string;
  private config: DetectionConfig;
  private technologies: TechnologiesMap;

  constructor(url: string, config: DetectionConfig, technologies: TechnologiesMap) {
    this.url = url;
    this.config = config;
    this.technologies = technologies;
  }

  async analyze(reqData: URLData, siteData: SiteData): Promise<EnhancedDetectionResult | null> {
    const timings: Record<string, number> = {};

    try {
      timings.detectStart = performance.now();
      const detector = new TechnologyDetector(this.technologies, this.config.mode);
      const technologies = detector.detectTechnologies(reqData, siteData);
      timings.afterDetect = performance.now();

      const blockingIndicators = this.config.blockingDetectionEnabled
        ? this.analyzeBlocking(siteData, reqData, technologies)
        : undefined;

      const pageAnalysis = this.analyzePageMetrics(siteData, reqData, {
        fetch: reqData.responseTime,
        parse: (timings.afterDetect - timings.detectStart) / 2,
        total: timings.afterDetect - timings.detectStart,
      });

      const stats = this.getDetectionStats(technologies);
      timings.afterAnalysis = performance.now();

      const rawData = this.config.includeRawData
        ? {
            headers: Object.fromEntries(reqData.headers.entries()),
            cookies: reqData.cookies ? [reqData.cookies] : [],
            suspiciousElements: siteData.suspiciousElements,
            metaTags: siteData.meta,
          }
        : undefined;

      return {
        url: this.url,
        finalUrl: reqData.finalUrl,
        statusCode: reqData.statusCode,
        technologies,
        blockingIndicators,
        pageAnalysis,
        stats,
        timings: {
          fetch: reqData.responseTime,
          parse: +((timings.afterDetect - timings.detectStart) / 2).toFixed(2),
          detect: +((timings.afterAnalysis - timings.afterDetect) / 2).toFixed(2),
          total: +(timings.afterAnalysis - timings.detectStart).toFixed(2),
        },
        rawData,
      };
    } catch (error) {
      console.error(`Error analyzing ${this.url}:`, error);
      return null;
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

    // Check script src patterns
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

  private analyzeBlocking(siteData: SiteData, reqData: URLData, detectedTechnologies: EnhancedDetectedTechnology[]): BlockingIndicators {
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

    if (SUSPICIOUS_STATUS_CODES.includes(reqData.statusCode)) {
      indicators.statusCodeSuspicious = true;
      blockingScore += 30;
    }

    if (siteData.textContentLength < 500 && siteData.domElementCount < 50) {
      indicators.minimalContent = true;
      blockingScore += 20;
    }

    if (siteData.domElementCount < 10) {
      indicators.minimalDomElements = true;
      blockingScore += 25;
    }
    if (siteData.hasChallengeElements) {
      indicators.challengeDetected = true;
      blockingScore += 25;
    }
    if (siteData.hasCaptchaElements) {
      indicators.captchaDetected = true;
      blockingScore += 30;
    }

    const fullContent = `${siteData.title} ${siteData.description} ${reqData.sourceCode}`.toLowerCase();
    const allScripts = [...siteData.scriptSrc, ...siteData.js].join(' ').toLowerCase();
    const allCookies = reqData.cookies.toLowerCase();
    const allHeaders = Array.from(reqData.headers.entries()).map(([k, v]) => `${k}: ${v}`).join(' ').toLowerCase();

    for (const tech of detectedTechnologies) {
      const techData = this.technologies[tech.name];
      if (!techData) continue;

      const techResult = this.checkBotProtectionPatterns(techData, {
        fullContent,
        allScripts,
        allCookies,
        allHeaders,
        suspiciousElements: siteData.suspiciousElements
      });

      if (techResult.detected) {
        detectedBotProtectionTechs.push(tech.name);
        suspiciousPhrases.push(...techResult.phrases);
        blockingScore += Math.min(techResult.score, 25);
        indicators.botDetectionJs = true;
        console.log(`[BOT PROTECTION] Detected: ${tech.name} (score: ${techResult.score})`);
      }
    }

    // Check for suspicious page titles
    const lowerTitle = siteData.title.toLowerCase();
    if (SUSPICIOUS_TITLES.some((title) => lowerTitle.includes(title))) {
      indicators.accessDeniedText = true;
      blockingScore += 20;
    }

    // Check for suspicious redirects
    if (reqData.redirectCount > 2) {
      indicators.suspiciousRedirects = true;
      blockingScore += 10;
    }

    // Check for unusual response times
    if (reqData.responseTime < 100) {
      indicators.unusualResponseTime = true;
      blockingScore += 5;
    }

    // Determine challenge type
    let challengeType: 'captcha' | 'javascript' | 'browser_check' | 'rate_limit' | 'access_denied' | undefined;
    
    const captchaKeywords = ['captcha', 'recaptcha', 'hcaptcha', 'turnstile', 'geetest', 'keycaptcha', 'arkose', 'funcaptcha'];
    if (detectedBotProtectionTechs.some(tech => 
      captchaKeywords.some(keyword => tech.toLowerCase().includes(keyword))
    )) {
      challengeType = 'captcha';
    } else if (detectedBotProtectionTechs.some(tech => 
      ['cloudflare', 'datadome', 'imperva', 'akamai', 'perimeterx', 'incapsula'].some(keyword => 
        tech.toLowerCase().includes(keyword)
      )
    )) {
      challengeType = 'javascript';
    } else if (suspiciousPhrases.some((p) => p.includes('browser'))) {
      challengeType = 'browser_check';
    } else if (reqData.statusCode === 429) {
      challengeType = 'rate_limit';
    } else if (indicators.accessDeniedText) {
      challengeType = 'access_denied';
    }

    return {
      likelyBlocked: blockingScore >= 40,
      blockingScore: Math.min(blockingScore, 100),
      indicators,
      suspiciousPhrases,
      challengeType,
      detectedBotProtectionTechs,
    };
  }

  private analyzePageMetrics(siteData: SiteData, reqData: URLData, timings: any): PageAnalysis {
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
      pageSizeBytes: reqData.contentLength,
      pageSizeHuman: formatBytes(reqData.contentLength),
      domElementCount: siteData.domElementCount,
      domComplexity: getDomComplexity(siteData.domElementCount),
      contentType: reqData.contentType,
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
}