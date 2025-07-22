import type {
  DetectionResult,
  BlockingIndicators,
  PageAnalysis,
  DetectedTechnology,
  WebPageData,
  SuspiciousElement,
} from "./types";

export class Analyzer {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async analyze(
    webPageData: WebPageData,
    detectedTechnologies: DetectedTechnology[],
    blockingDetectionEnabled: boolean
  ): Promise<DetectionResult | null> {
    try {
      const technologies = detectedTechnologies;

      const pageAnalysis = this.analyzePageMetrics(webPageData);

      const blockingIndicators = blockingDetectionEnabled
        ? this.analyzeBlocking(webPageData, detectedTechnologies, pageAnalysis)
        : {};

      const stats = this.calculateStats(technologies);
      const rawData = {
        headers: Object.fromEntries(webPageData.headers.entries()),
        cookies: webPageData.cookies,

        metaTags: webPageData.meta,
      };

      return {
        url: this.url,
        fetchTime: webPageData.responseTime,
        finalUrl: webPageData.finalUrl,
        statusCode: webPageData.statusCode,
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
    webPageData: WebPageData,
    detectedTechnologies: DetectedTechnology[],
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

    if (SUSPICIOUS_STATUS_CODES.includes(webPageData.statusCode)) {
      indicators.statusCodeSuspicious = true;
      blockingScore += 30;
    }

    if (
      webPageData.textContentLength < 500 &&
      webPageData.domElementCount < 50
    ) {
      indicators.minimalContent = true;
      blockingScore += 20;
    }

    if (webPageData.domElementCount < 10) {
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

    blockingScore += detectedTechnologies.length * 25;
    if (detectedTechnologies.length > 0) indicators.botDetectionJs = true;

    // Check for suspicious page titles
    const lowerTitle = webPageData.title.toLowerCase();
    if (SUSPICIOUS_TITLES.some((title) => lowerTitle.includes(title))) {
      indicators.accessDeniedText = true;
      blockingScore += 20;
    }

    // Check for suspicious redirects
    if (webPageData.redirectCount > 2) {
      indicators.suspiciousRedirects = true;
      blockingScore += 10;
    }

    // Check for unusual response times
    if (webPageData.responseTime > 10000) {
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

  private analyzePageMetrics(webPageData: WebPageData): PageAnalysis {
    const doc = webPageData.dom.window.document;

    const hasCaptchaElements = !!(
      doc.querySelector(
        ".g-recaptcha,.h-captcha,.cf-turnstile,[data-sitekey]"
      ) || /recaptcha|hcaptcha|turnstile/i.test(webPageData.sourceCode)
    );

    const hasChallengeElements = !!(
      doc.querySelector(
        '[id*="challenge"], [class*="challenge"], [id*="verification"], [class*="verification"]'
      ) ||
      /challenge-platform|browser-verification/i.test(webPageData.sourceCode)
    );

    const suspiciousSelectors: string[] = [
      '[id*="challenge"]',
      '[class*="challenge"]',
      '[id*="captcha"]',
      '[class*="captcha"]',
      '[id*="block"]',
      // '[class*="block"]',
      '[id*="protection"]',
      '[class*="protection"]',
      '[id*="security"]',
      '[class*="security"]',
    ];

    const suspiciousElements: SuspiciousElement[] = [
      ...doc.querySelectorAll(suspiciousSelectors.join(",")),
    ].map((el) => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
    }));

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
      domElementCount: webPageData.domElementCount,
      domComplexity: getDomComplexity(webPageData.domElementCount),
      contentType: "", // Assuming reqData.contentType is not available
      title: webPageData.title,
      description: webPageData.description,
      language:
        webPageData.meta["language"] || webPageData.meta["lang"] || "unknown",
      viewport: webPageData.meta["viewport"] || "not set",
      charset: webPageData.meta["charset"] || "unknown",
      hasForms: webPageData.formCount > 0,
      hasJavascript: webPageData.scriptCount > 0,
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
