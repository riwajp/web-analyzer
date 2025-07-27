import type { DetectedTechnology } from "../types";
import { Analyzer } from "../analyzer";
import { generateMockWebPageData, generateMockDetectedTechs } from "./utils";

describe("Analyzer", () => {
  it("detects captcha and challenge with correct blocking indicators and page analysis", async () => {
    const url = "https://blocked.com";
    const analyzer = new Analyzer(url);

    const webPageData = generateMockWebPageData({
      bodyDomElementCount: 8,
      statusCode: 403,
      textContentLength: 200,
      hasCaptchaElement: true,
      hasChallengeElement: true,
      redirectCount: 3,
      title: "Access Denied",
    });

    const detectedTechs = generateMockDetectedTechs([
      "Cloudflare",
      "reCAPTCHA",
    ]);

    const result = await analyzer.analyze(webPageData, detectedTechs, true);

    // Tests for PageAnalysis
    const pageAnalysis = result!.pageAnalysis;

    expect(pageAnalysis.hasForms).toBe(true);
    expect(pageAnalysis.hasJavascript).toBe(true);
    expect(pageAnalysis.hasCaptchaElements).toBe(true);
    expect(pageAnalysis.hasChallengeElements).toBe(true);
    expect(pageAnalysis.suspiciousElements.length).toBe(1);

    // Tests for BlockingIndicators
    const blockingIndicators = result!.blockingIndicators!;
    expect(blockingIndicators.likelyBlocked).toBe(true);
    expect(blockingIndicators.blockingScore).toBeGreaterThanOrEqual(40);
    expect(blockingIndicators.indicators.statusCodeSuspicious).toBe(true);
    expect(blockingIndicators.indicators.minimalContent).toBe(true);
    expect(blockingIndicators.indicators.minimalDomElements).toBe(true);
    expect(blockingIndicators.indicators.challengeDetected).toBe(true);
    expect(blockingIndicators.indicators.captchaDetected).toBe(true);
    expect(blockingIndicators.indicators.suspiciousRedirects).toBe(true);
    expect(blockingIndicators.indicators.suspiciousTitle).toBe(true);
    expect(blockingIndicators.indicators.botDetectionJs).toBe(true);
    expect(blockingIndicators.challengeType).toBe("captcha");
    expect(blockingIndicators.detectedBotProtectionTechs).toEqual(
      expect.arrayContaining(["reCAPTCHA", "Cloudflare"])
    );
  });

  it("doesn't flag blocked when blocking score is low", async () => {
    const analyzer = new Analyzer("https://normal-page.com");

    const webPageData = generateMockWebPageData({
      bodyDomElementCount: 200,
      statusCode: 200,
      textContentLength: 5000,
      redirectCount: 0,
      title: "Normal Page",
    });

    const detectedTechs: DetectedTechnology[] = [];

    const result = await analyzer.analyze(webPageData, detectedTechs, true);

    expect(result!.blockingIndicators?.likelyBlocked).toBe(false);
  });
});
