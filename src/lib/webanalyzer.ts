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
} from "../types";

export const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,
  detectionConfig: {
    mode: "LOOSE" as DetectionMode,
    fetchTimeout: 10000,
    blockingDetectionEnabled: true,
  } as DetectionConfig,

  init(
    dataFiles: string[] = ["src/data/tech.json"],
    detectionConfig?: Partial<DetectionConfig>
  ) {
    for (const file of dataFiles) {
      const filePath = path.resolve(file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const technologiesFromFile: TechnologiesMap = JSON.parse(fileContent);
      this.technologies = { ...this.technologies, ...technologiesFromFile };
    }
    this.initialized = true;
    this.detectionConfig = { ...this.detectionConfig, ...detectionConfig };
  },

  async analyze(url: string): Promise<DetectionResult | null> {
    if (!this.initialized) {
      console.warn("WebAnalyzer was not initialized. Using default tech.json.");
      this.init(["src/tests/tech-test.json"]);
    }
    const webPage = new WebPage(url);
    const webPageData = await webPage.extractData(
      this.detectionConfig.fetchTimeout
    );
    const detector = new TechnologyDetector(
      this.technologies,
      this.detectionConfig.mode
    );
    const technologies = detector.detectTechnologies(webPageData);
    const analyzer = new Analyzer(url, {
      includeRawData: this.detectionConfig.includeRawData,
      blockingDetectionEnabled: this.detectionConfig.blockingDetectionEnabled,
    });
    return await analyzer.analyze(webPageData, technologies);
  },
};
