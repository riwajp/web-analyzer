import fs from "fs";
import path from "path";
import { WebPage } from "./webPage";
import { Analyzer } from "./analyzer";
import { TechnologyDetector } from "./technologyDetector";
import type {
  DetectionConfig,
  DetectionMode,
  DetectionResult,
  TechnologiesMap,
} from "./types";

export const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,
  detectionConfig: {
    mode: "LOOSE" as DetectionMode,
    maxExternalScripts: 5,
    fetchTimeout: 3000,
    blockingDetectionEnabled: true,
  },

  init(dataFiles: string[], detectionConfig?: Partial<DetectionConfig>) {
    for (const file of dataFiles) {
      const filePath = path.resolve(file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const technologiesFromFile: TechnologiesMap = JSON.parse(fileContent);
      this.technologies = { ...this.technologies, ...technologiesFromFile };
    }
    this.initialized = true;
    this.detectionConfig = { ...this.detectionConfig, ...detectionConfig };
    console.log(
      `Loaded ${Object.keys(this.technologies).length} technologies.`
    );
  },

  async analyze(url: string): Promise<DetectionResult | null> {
    if (!this.initialized) {
      this.init(["src/data/tech.json"]);
    }
    const webPage = new WebPage(url);
    const { urlData, siteData } = await webPage.extractData(
      this.detectionConfig.fetchTimeout
    );
    const detector = new TechnologyDetector(
      this.technologies,
      this.detectionConfig.mode
    );
    const technologies = detector.detectTechnologies(urlData, siteData);
    const analyzer = new Analyzer(url);
    return await analyzer.analyze(
      siteData,
      technologies,
      urlData,
      this.detectionConfig.blockingDetectionEnabled
    );
  },
};
