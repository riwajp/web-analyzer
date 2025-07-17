import { performance } from "perf_hooks";
import { TechnologyDetector } from "./technologyDetector";
import type {
  URLData,
  SiteData,
  EnhancedDetectionResult,
  DetectionConfig,
  BlockingIndicators,
  PageAnalysis,
  EnhancedDetectedTechnology,
  TechnologiesMap,
} from "./types";

export class Analyzer {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async analyze(
    siteData: SiteData,
    detectedTechnologies: EnhancedDetectedTechnology[],
    urlData: URLData
  ): Promise<EnhancedDetectionResult | null> {
    const timings: Record<string, number> = {};
    try {
      timings.detectStart = performance.now();
      const technologies = detectedTechnologies;
      timings.afterDetect = performance.now();

      const blockingIndicators = this.analyzeBlocking(
        siteData,
        technologies,
        urlData
      );

      const pageAnalysis = this.analyzePageMetrics(siteData, {
        fetch: urlData.responseTime,
        parse: 0,
        total: urlData.responseTime,
      });

      const stats = this.calculateStats(technologies);
      const rawData = {
        headers: Object.fromEntries(urlData.headers.entries()),
        cookies: urlData.cookies
          .split(";")
          .map((c) => c.trim())
          .filter(Boolean),
        suspiciousElements: siteData.suspiciousElements,
        metaTags: siteData.meta,
      };

      return {
        url: this.url,
        finalUrl: urlData.finalUrl,
        statusCode: urlData.statusCode,
        technologies,
        blockingIndicators,
        pageAnalysis,
        stats,
        timings: {
          fetch: urlData.responseTime,
          parse: 0,
          detect: 0,
          total: urlData.responseTime,
        },
        rawData,
      };
    } catch (error) {
      console.error(`Error analyzing ${this.url}:`, error);
      return null;
    }
  }

  private analyzeBlocking(
    siteData: SiteData,
    detectedTechnologies: EnhancedDetectedTechnology[],
    urlData: URLData
  ): BlockingIndicators {
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

    const SUSPICIOUS_STATUS_CODES = [
      403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527, 530,
    ];
    const SUSPICIOUS_TITLES = [
      "just a moment",
      "please wait",
      "access denied",
      "blocked",
      "error",
      "forbidden",
      "unauthorized",
      "security check",
      "ddos protection",
      "bot detection",
    ];

    if (SUSPICIOUS_STATUS_CODES.includes(urlData.statusCode)) {
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

    for (const tech of detectedTechnologies) {
      blockingScore += Math.min(25);
      indicators.botDetectionJs = true;
    }

    // Check for suspicious page titles
    const lowerTitle = siteData.title.toLowerCase();
    if (SUSPICIOUS_TITLES.some((title) => lowerTitle.includes(title))) {
      indicators.accessDeniedText = true;
      blockingScore += 20;
    }

    // Check for suspicious redirects
    if (urlData.redirectCount > 2) {
      indicators.suspiciousRedirects = true;
      blockingScore += 10;
    }

    // Check for unusual response times
    if (urlData.responseTime > 10000) {
      // 10 seconds as an example threshold
      indicators.unusualResponseTime = true;
      blockingScore += 5;
    }

    // Determine challenge type
    let challengeType:
      | "captcha"
      | "javascript"
      | "browser_check"
      | "rate_limit"
      | "access_denied"
      | undefined;

    const captchaTechnologies = [
      "captcha",
      "recaptcha",
      "hcaptcha",
      "turnstile",
      "geetest",
      "keycaptcha",
      "arkose",
      "funcaptcha",
    ];
    const challengeTechnologies = [
      "cloudflare",
      "datadome",
      "imperva",
      "akamai",
      "perimeterx",
      "incapsula",
    ];

    const detectedCaptchaTechnologies = detectedTechnologies.filter((tech) =>
      captchaTechnologies.some((keyword) =>
        tech.name.toLowerCase().includes(keyword)
      )
    );

    const detectedJavascriptTechnologies = detectedTechnologies.filter((tech) =>
      challengeTechnologies.some((keyword) =>
        tech.name.toLowerCase().includes(keyword)
      )
    );

    if (detectedCaptchaTechnologies.length > 0) {
      challengeType = "captcha";
    } else if (detectedJavascriptTechnologies.length > 0) {
      challengeType = "javascript";
    } else if (suspiciousPhrases.some((p) => p.includes("browser"))) {
      challengeType = "browser_check";
    } else if (
      suspiciousPhrases.some(
        (p) =>
          p.includes("429") ||
          p.includes("rate limit") ||
          p.includes("too many requests")
      )
    ) {
      challengeType = "rate_limit";
    } else if (indicators.accessDeniedText) {
      challengeType = "access_denied";
    }

    return {
      likelyBlocked: blockingScore >= 40,
      blockingScore: Math.min(blockingScore, 100),
      indicators,
      suspiciousPhrases,
      challengeType,
      detectedBotProtectionTechs: [
        ...detectedCaptchaTechnologies.map((t) => t.name),
        ...detectedJavascriptTechnologies.map((t) => t.name),
      ],
    };
  }

  private analyzePageMetrics(
    siteData: SiteData,
    p0: { fetch: number; parse: number; total: number }
  ): PageAnalysis {
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const getDomComplexity = (
      elementCount: number
    ): "LOW" | "MEDIUM" | "HIGH" => {
      if (elementCount < 100) return "LOW";
      if (elementCount < 1000) return "MEDIUM";
      return "HIGH";
    };

    return {
      pageSizeBytes: 0, // Assuming reqData.contentLength is not available
      pageSizeHuman: "0 Bytes",
      domElementCount: siteData.domElementCount,
      domComplexity: getDomComplexity(siteData.domElementCount),
      contentType: "", // Assuming reqData.contentType is not available
      title: siteData.title,
      description: siteData.description,
      language: siteData.meta["language"] || siteData.meta["lang"] || "unknown",
      viewport: siteData.meta["viewport"] || "not set",
      charset: siteData.meta["charset"] || "unknown",
      hasForms: siteData.formCount > 0,
      hasJavascript: siteData.scriptCount > 0,
      externalResources: 0, // Assuming siteData.assetUrls is not available
      internalResources: 0, // Assuming siteData.assetUrls is not available
      performanceMetrics: {
        fetchTime: 0, // Assuming timings.fetch is not available
        parseTime: 0, // Assuming timings.parse is not available
        totalTime: 0, // Assuming timings.total is not available
      },
    };
  }

  private calculateStats(results: EnhancedDetectedTechnology[]) {
    return {
      total: results.length,
      byConfidence: {
        HIGH: results.filter((r) => r.confidenceLevel === "HIGH").length,
        MEDIUM: results.filter((r) => r.confidenceLevel === "MEDIUM").length,
        LOW: results.filter((r) => r.confidenceLevel === "LOW").length,
      },
      averageConfidence:
        results.length > 0
          ? Math.round(
              (results.reduce((sum, r) => sum + r.confidence, 0) /
                results.length) *
                10
            ) / 10
          : 0,
      topDetection: results.length > 0 ? results[0] : null,
    };
  }
}
