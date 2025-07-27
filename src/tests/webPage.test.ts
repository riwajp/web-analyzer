import path from "path";
import fs from "fs";
import { TechnologiesMap, WebPageData } from "../types";
import { WebPage } from "../lib/webPage";
import { getUrlForTech, mockFetchForTech } from "./utils";

const filePath = path.resolve("src/data/tech.json");
const fileContent = fs.readFileSync(filePath, "utf-8");

const technologies: TechnologiesMap = JSON.parse(fileContent);

describe("webPage", () => {
  const extractedWebPagesData: Record<string, WebPageData> = {};

  beforeAll(async () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      const mockFetchResponse = mockFetchForTech(techName, techData);
      global.fetch = jest.fn().mockResolvedValueOnce(mockFetchResponse);
      const webPage = new WebPage(getUrlForTech(techName));
      const webPageData = await webPage.extractData();
      extractedWebPagesData[techName] = webPageData;
    }
  });

  it("extracts header correctly", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.headers) continue;

      const webPageData = extractedWebPagesData[techName];
      for (const [headerKey, pattern] of Object.entries(techData.headers)) {
        expect(webPageData.headers.has(headerKey)).toBe(true);
        expect(
          RegExp(pattern).test(webPageData.headers.get(headerKey) ?? "")
        ).toBe(true);
      }
    }
  });

  it("extracts cookies correctly", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.cookies) continue;

      const webPageData = extractedWebPagesData[techName];
      for (const [cookieName, pattern] of Object.entries(techData.cookies)) {
        expect(webPageData.cookies[cookieName]).toBeDefined();
        expect(
          RegExp(pattern).test(webPageData.cookies[cookieName] ?? "")
        ).toBe(true);
      }
    }
  });

  it("extracts inline JS correctly", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.js) continue;

      const webPageData = extractedWebPagesData[techName];
      for (const jsString of techData.js as Array<string>) {
        expect(webPageData.js.some((js) => js.includes(jsString))).toBe(true);
      }
    }
  });

  it("extracts HTML correctly", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.html) continue;

      const webPageData = extractedWebPagesData[techName];
      for (const html of techData.html as Array<string>) {
        expect(webPageData.sourceCode).toContain(html);
      }
    }
  });

  it("extracts scriptSrc correctly", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.scriptSrc) continue;

      const webPageData = extractedWebPagesData[techName];
      for (const scriptUrlPattern of techData.scriptSrc as Array<string>) {
        expect(
          webPageData.scriptSrc.some((src) =>
            RegExp(scriptUrlPattern).test(src)
          )
        ).toBe(true);
      }
    }
  });

  it("extracts DOM elements correctly", () => {
    for (const [techName, techData] of Object.entries(technologies)) {
      if (!techData.dom) continue;

      const webPageData = extractedWebPagesData[techName];
      for (const selector of Object.keys(techData.dom)) {
        expect(
          webPageData.dom.window.document.querySelector(selector)
        ).not.toBeNull();
      }
    }
  });
});
