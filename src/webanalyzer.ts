import fs from 'fs';
import path from 'path';
import { Analyzer } from './analyzer';
import type { EnhancedDetectionResult, DetectionConfig, TechnologiesMap } from './types';

export const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,
  defaultConfig: {
    mode: 'NORMAL' as 'NORMAL' | 'STRICT' | 'LOOSE',
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