import path from "path";
import fs from "fs";
import { DetectedTechnology, TechnologiesMap } from "../types";
import { WebPage } from "../webPage";
import { TechnologyDetector } from "../technologyDetector";
import { getUrlForTech, mockFetchForTech } from "./utils";
import { TECH_DETECTION_MODE_CONFIDENCE } from "../confidence-constants";

const filePath = path.resolve("src/tests/tech-test.json");
const fileContent = fs.readFileSync(filePath, "utf-8");

const technologies: TechnologiesMap = JSON.parse(fileContent);

describe("technologyDetector", () => {
  const detectedTechnologiesMap: Record<string, DetectedTechnology[]> = {};

  beforeAll(async () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      const mockFetchResponse = mockFetchForTech(techName, techData);
      global.fetch = jest.fn().mockResolvedValueOnce(mockFetchResponse);

      const webPage = new WebPage(getUrlForTech(techName));
      const webPageData = await webPage.extractData();
      const detector = new TechnologyDetector(technologies, "NORMAL");
      const results = detector.detectTechnologies(webPageData);
      detectedTechnologiesMap[techName] = results;
    }
  });

  it("detects expected technologies with minimum confidence", () => {
    for (const [techName] of Object.entries(technologies)) {
      const results = detectedTechnologiesMap[techName];
      const detected = results.find((r) => r.name === techName);
      if (!detected) console.log(`Testing for ${techName}`);
      expect(detected).toBeDefined();
      expect(detected?.confidence).toBeGreaterThanOrEqual(
        TECH_DETECTION_MODE_CONFIDENCE.NORMAL
      );
    }
  });

  it("includes expected detection sources for detected technologies", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      const results = detectedTechnologiesMap[techName];
      const detected = results.find((r) => r.name === techName);

      if (!detected) continue;

      const expectedSources = Object.keys(techData).filter((key) =>
        ["js", "scriptSrc", "headers", "cookies", "html", "dom"].includes(key)
      );

      for (const expectedSource of expectedSources) {
        expect(detected.detectedUsing).toContain(expectedSource);
      }
    }
  });

  it("resolves implied and required technologies", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.implies && !techData.requires) continue;

      const results = detectedTechnologiesMap[techName];
      const detectedNames = results.map((r) => r.name);
      const expectedTechnologies = new Set([techName]);

      const expand = (techNames: string[]) => {
        for (const name of techNames) {
          if (!expectedTechnologies.has(name)) {
            expectedTechnologies.add(name);
            const impliedTech = technologies[name]?.implies;
            const requiredTech = technologies[name]?.requires;

            if (impliedTech) {
              expand(Array.isArray(impliedTech) ? impliedTech : [impliedTech]);
            }
            if (requiredTech) {
              expand(
                Array.isArray(requiredTech) ? requiredTech : [requiredTech]
              );
            }
          }
        }
      };

      ["implies", "requires"].forEach((key) => {
        const transitiveTechs = techData[key];
        if (transitiveTechs) {
          const transitiveTechsList = Array.isArray(transitiveTechs)
            ? transitiveTechs
            : [transitiveTechs];
          expand(transitiveTechsList);
        }
      });

      for (const name of expectedTechnologies) {
        expect(detectedNames).toContain(name);
      }
    }
  });

  //   it("returns sorted results by confidence", () => {
  //     for (const [techName, results] of Object.entries(detectedTechnologiesMap)) {
  //       const confidences = results.map((r) => r.confidence);
  //       const sorted = [...confidences].sort((a, b) => b - a);
  //       expect(confidences).toEqual(sorted);
  //     }
  //   });
});
