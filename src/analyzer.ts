import type {
  URLData,
  SiteData,
  DetectionResult,
  BlockingIndicators,
  PageAnalysis,
  DetectedTechnology,
} from "./types";

export class Analyzer {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async analyze(
    siteData: SiteData,
    detectedTechnologies: DetectedTechnology[],
    urlData: URLData,
    blockingDetectionEnabled: boolean
  ): Promise<DetectionResult | null> {
    try {
      const technologies = detectedTechnologies;

      const pageAnalysis = this.analyzePageMetrics(urlData, siteData);

      const blockingIndicators = blockingDetectionEnabled
        ? this.analyzeBlocking(siteData, technologies, urlData, pageAnalysis)
        : {};

      const stats = this.calculateStats(technologies);
      const rawData = {
        headers: Object.fromEntries(urlData.headers.entries()),
        cookies: urlData.cookies
          .split(";")
          .map((c) => c.trim())
          .filter(Boolean),
        metaTags: siteData.meta,
      };

      return {
        url: this.url,
        fetchTime: urlData.responseTime,

        finalUrl: urlData.finalUrl,
        statusCode: urlData.statusCode,
        technologies,
        ...(blockingDetectionEnabled ? { blockingIndicators } : {}),
        pageAnalysis,
        stats,

        rawData,
      } as DetectionResult;
    } catch (error) {
      console.error(`Error analyzing ${this.url}:`, error);
      return null;
    }
  }

  private analyzeBlocking(
    siteData: SiteData,
    detectedTechnologies: DetectedTechnology[],
    urlData: URLData,
    pageAnalysis: PageAnalysis
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
      suspiciousElements: false,
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
    if (pageAnalysis.hasChallengeElements) {
      indicators.challengeDetected = true;
      blockingScore += 25;
    }
    if (pageAnalysis.hasCaptchaElements) {
      indicators.captchaDetected = true;
      blockingScore += 30;
    }

    if (pageAnalysis.suspiciousElements.length > 0) {
      indicators.suspiciousElements = true;
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
    urlData: URLData,
    siteData: SiteData
  ): PageAnalysis {
    const doc = siteData.dom.window.document;

    const hasCaptchaElements = !!(
      doc.querySelector(
        ".g-recaptcha,.h-captcha,.cf-turnstile,[data-sitekey]"
      ) || /recaptcha|hcaptcha|turnstile/i.test(urlData.sourceCode)
    );

    const hasChallengeElements = !!(
      doc.querySelector(
        '[id*="challenge"], [class*="challenge"], [id*="verification"], [class*="verification"]'
      ) || /challenge-platform|browser-verification/i.test(urlData.sourceCode)
    );

    const suspiciousElements: string[] = [];

    const suspiciousSelectors: string[] = [
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

    for (const selector of suspiciousSelectors) {
      const elements = doc.querySelectorAll(selector);

      elements.forEach((el: Element) => {
        const id = el.id?.trim();
        if (id) {
          suspiciousElements.push(`#${id}`);
        }

        const className = el.className?.trim();
        if (className) {
          const firstClass = className.split(/\s+/)[0];
          if (firstClass) {
            suspiciousElements.push(`.${firstClass}`);
          }
        }
      });
    }

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
      hasCaptchaElements,
      hasChallengeElements,
      suspiciousElements,
    };
  }

  private calculateStats(results: DetectedTechnology[]) {
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
