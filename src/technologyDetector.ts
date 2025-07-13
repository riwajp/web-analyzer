import { EnhancedPatternMatcher, EnhancedTechnologyDetector } from './patternMatcher';
import type { URLData, SiteData, EnhancedDetectedTechnology, TechnologiesMap, DetectionMode } from './types';

export class TechnologyDetector {
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

  detectTechnologies(reqData: URLData, siteData: SiteData): EnhancedDetectedTechnology[] {
    const detected: EnhancedDetectedTechnology[] = [];
    for (const techName in this.technologies) {
      const techData = this.technologies[techName];
      const result = EnhancedTechnologyDetector.detectTechnologyWithConfidence(techName, techData, siteData, reqData);
      if (result.confidence > 0) {
        detected.push({
          name: techName,
          confidence: result.confidence,
          matches: result.matches,
          detectedUsing: result.detectedUsing,
        });
      }
    }
    return detected;
  }
}