import fs from "fs";
import path from "path";
import { WebPage } from "./webPage";
import { Analyzer } from "./analyzer";
import { TechnologyDetector } from "./technologyDetector";
import type { DetectionResult, TechnologiesMap } from "./types";

export const WebAnalyzer = {
  initialized: false,
  technologies: {} as TechnologiesMap,

  init(dataFiles: string[]) {
    for (const file of dataFiles) {
      const filePath = path.resolve(file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const technologiesFromFile: TechnologiesMap = JSON.parse(fileContent);
      this.technologies = { ...this.technologies, ...technologiesFromFile };
    }
    this.initialized = true;
    console.log(
      `Loaded ${Object.keys(this.technologies).length} technologies.`
    );
  },

  async analyze(url: string): Promise<DetectionResult | null> {
    if (!this.initialized) {
      this.init(["src/data/tech.json"]);
    }
    const webPage = new WebPage(url);
    const { urlData, siteData } = await webPage.extractData();
    const detector = new TechnologyDetector(this.technologies, "LOOSE");
    const technologies = detector.detectTechnologies(urlData, siteData);
    const analyzer = new Analyzer(url);
    return await analyzer.analyze(siteData, technologies, urlData);
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },
};
