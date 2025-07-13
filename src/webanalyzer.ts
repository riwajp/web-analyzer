import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { WebPage } from './webPage';
import { Analyzer } from './analyzer';
import { TechnologyDetector } from './technologyDetector';
import type { EnhancedDetectionResult, DetectionConfig, TechnologiesMap } from './types';

export const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,

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

  async analyze(url: string, config: DetectionConfig): Promise<EnhancedDetectionResult | null> {
    if (!this.initialized) {
      this.init(['src/data/tech.json']);
    }

    const finalConfig = config;
    const timings: Record<string, number> = {};

    try {
      timings.fetchStart = performance.now();
      const webPage = new WebPage(url);
      const { response, responseTime, sourceCode } = await webPage.fetch();
      timings.afterFetch = performance.now();

      const { urlData, siteData } = webPage.parse(response, responseTime, sourceCode);
      timings.afterParse = performance.now();

      // tech detection here.
      const detector = new TechnologyDetector(this.technologies, finalConfig.mode);
      const technologies = detector.detectTechnologies(urlData, siteData);

      const analyzer = new Analyzer(url, finalConfig, this.technologies);
      const result = await analyzer.analyze(urlData, siteData);
      timings.afterAnalysis = performance.now();

      // Use URLData and provide defaults for any missing fields.
      return {
        url,
        finalUrl: urlData.finalUrl,
        statusCode: urlData.statusCode,
        technologies: result?.technologies || [],
        blockingIndicators: result?.blockingIndicators || {
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
          suspiciousPhrases: result?.blockingIndicators?.suspiciousPhrases || [],
        },
        pageAnalysis: result?.pageAnalysis || {
          domElementCount: siteData.domElementCount,
          pageSizeBytes: urlData.contentLength,
          pageSizeHuman: this.formatBytes(urlData.contentLength),
          domComplexity: 'LOW' as const,
          contentType: urlData.contentType,
          title: siteData.title,
          description: siteData.description,
          language: 'en',
          viewport: '',
          charset: 'utf-8',
          hasForms: siteData.formCount > 0,
          hasJavascript: siteData.scriptCount > 0,
          externalResources: 0,
          internalResources: 0,
          performanceMetrics: {
            fetchTime: +(timings.afterFetch - timings.fetchStart).toFixed(2),
            parseTime: +(timings.afterParse - timings.afterFetch).toFixed(2),
            totalTime: +(timings.afterAnalysis - timings.fetchStart).toFixed(2),
          },
        },
        stats: result?.stats || {
          total: 0,
          byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
          averageConfidence: 0,
          topDetection: null,
        },
        timings: {
          fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
          parse: +(timings.afterParse - timings.afterFetch).toFixed(2),
          detect: +(timings.afterAnalysis - timings.afterParse).toFixed(2),
          total: +(timings.afterAnalysis - timings.fetchStart).toFixed(2),
        },
        ...(finalConfig.includeRawData && {
          rawData: {
            headers: Object.fromEntries(urlData.headers.entries()),
            cookies: urlData.cookies ? [urlData.cookies] : [],
            suspiciousElements: siteData.suspiciousElements,
            metaTags: siteData.meta,
          },
        }),
      };
    } catch (error) {
      console.error(`Error analyzing ${url}:`, error);
      return null;
    }
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};