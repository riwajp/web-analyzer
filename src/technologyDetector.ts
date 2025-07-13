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

      const result = EnhancedTechnologyDetector.detectTechnologyWithConfidence(techName, techData, siteData, urlData);
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
}