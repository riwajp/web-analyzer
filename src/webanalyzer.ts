import { JSDOM } from "jsdom";
import type { SiteData, TechnologiesMap, URLData } from "./types";
import fs from "fs";
import path from "path";

const WebAnalyzer = {
  initialized: false,

  technologies: {} as TechnologiesMap,

  // Adds technologies data from the provided list of json files
  init: (data_files: string[]) => {
    for (const file of data_files) {
      const filePath = path.resolve(file);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      const technologiesFromFile: TechnologiesMap = JSON.parse(fileContent);

      WebAnalyzer.technologies = {
        ...WebAnalyzer.technologies,
        ...technologiesFromFile,
      };
    }

    WebAnalyzer.initialized = true;

    console.log(
      `Loaded ${Object.keys(WebAnalyzer.technologies).length} technologies.`
    );
  },

  // Fetches the source code, headers, and set-cookie headers from a given URL
  fetchURL: async (url: string): Promise<URLData> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return {
        source_code: await response.text(),
        headers: response.headers,
        cookies: response.headers.get("set-cookie") || "",
      };
    } catch (error) {
      console.error(`Failed to fetch URL: ${url}`, error);
      throw error;
    }
  },

  // Parses the source code of a webpage and extracts components for further analysis and detection
  parseSourceCode: (source_code: string): SiteData => {
    const dom = new JSDOM(source_code);
    const doc = dom.window.document;

    //  extract script src attributes
    const scriptSrc = Array.from<HTMLElement>(
      doc.querySelectorAll("script[src]")
    )
      .map((el) => el.getAttribute("src"))
      .filter((src) => src != null);

    // extract script text content
    const js = Array.from<HTMLElement>(doc.querySelectorAll("script"))
      .map((el) => el.textContent || "")
      .filter((script) => script.trim());

    //  extract meta data
    const meta: Record<string, string> = {};

    Array.from<HTMLElement>(doc.querySelectorAll("meta")).forEach(
      (metaElement) => {
        const nameAttr =
          metaElement.getAttribute("name") ||
          metaElement.getAttribute("property");
        const contentAttr = metaElement.getAttribute("content");

        if (nameAttr && contentAttr) {
          meta[nameAttr.toLowerCase()] = contentAttr;
        }
      }
    );

    return {
      scriptSrc,
      js,
      meta,
      dom,
    };
  },

  // utility function to match a text and object pattern
  matchPattern: (
    value: string,
    pattern: string | Record<string, string>
  ): boolean => {
    if (typeof pattern === "string") {
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(value);
      } catch {
        return value.includes(pattern);
      }
    }
    // For object patterns
    if (typeof pattern === "object") {
      return Object.entries(pattern).every(([key, val]) => {
        if (key.toLowerCase() !== key) key = key.toLowerCase();
        return (
          value.toLowerCase().includes(key) &&
          (val === "" || new RegExp(val, "i").test(value))
        );
      });
    }
    return false;
  },

  detectPatterns: (site_data: SiteData, url_data: URLData) => {
    const detectedTechnologies: any[] = [];
    const visited = new Set<string>();

    const detect = (techName: string) => {
      if (visited.has(techName)) return;
      visited.add(techName);

      const techData = WebAnalyzer.technologies[techName];
      if (!techData) return;

      let detected = false;
      let detectedUsing: string | null = null;

      // Match JavaScript keys
      if (
        techData.js &&
        site_data.js.some((script) =>
          Object.keys(techData.js).some((key) =>
            WebAnalyzer.matchPattern(script, key)
          )
        )
      ) {
        detected = true;
        detectedUsing = "js";
      }

      // Match scriptSrc
      if (!detected && techData.scriptSrc) {
        const patterns = Array.isArray(techData.scriptSrc)
          ? techData.scriptSrc
          : [techData.scriptSrc];

        if (
          patterns.some((pattern: string) =>
            site_data.scriptSrc.some((src) =>
              WebAnalyzer.matchPattern(src, pattern)
            )
          )
        ) {
          detected = true;
          detectedUsing = "scriptSrc";
        }
      }

      // Match cookies
      if (!detected && techData.cookies) {
        if (
          Object.keys(techData.cookies).some((key) =>
            url_data.cookies.includes(key)
          )
        ) {
          detected = true;
          detectedUsing = "cookies";
        }
      }

      // Match headers
      if (!detected && techData.headers) {
        if (
          Object.entries(techData.headers).some(([key, val]: [string, any]) => {
            const headerValue = url_data.headers.get(
              key.trim().replace(":", "")
            );
            return (
              headerValue !== null &&
              (val === "" || WebAnalyzer.matchPattern(headerValue, val))
            );
          })
        ) {
          detected = true;
          detectedUsing = "headers";
        }
      }

      // Match meta
      if (!detected && techData.meta && site_data.meta) {
        if (
          Object.entries(techData.meta).some(([key, val]: [string, any]) => {
            const metaVal = site_data.meta[key.toLowerCase()];
            return metaVal ? WebAnalyzer.matchPattern(metaVal, val) : false;
          })
        ) {
          detected = true;
          detectedUsing = "meta";
        }
      }

      // Match DOM
      if (!detected && techData.dom && site_data.dom) {
        const document = site_data.dom.window.document;
        const domPatterns = Array.isArray(techData.dom)
          ? techData.dom
          : [techData.dom];

        if (
          domPatterns.some((selector: string) => {
            try {
              return document.querySelector(selector) !== null;
            } catch (e) {
              return false;
            }
          })
        ) {
          detected = true;
          detectedUsing = "dom";
        }
      }

      if (detected) {
        detectedTechnologies.push({ name: techName, detectedUsing });

        // Recursively add implied technologies
        const implies = techData.implies;
        if (implies) {
          const impliedTechs = Array.isArray(implies) ? implies : [implies];
          impliedTechs.forEach(detect);
        }

        // Recursively add required technologies
        const requires = techData.requires;
        if (requires) {
          const requiredTechs = Array.isArray(requires) ? requires : [requires];
          requiredTechs.forEach(detect);
        }
      }
    };

    // Main detection loop
    for (const techName of Object.keys(WebAnalyzer.technologies)) {
      detect(techName);
    }

    return detectedTechnologies;
  },
};

export default WebAnalyzer;
