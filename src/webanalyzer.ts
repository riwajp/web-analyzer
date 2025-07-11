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
  parseSourceCode: async (source_code: string, baseUrl?: string): Promise<SiteData> => {
    const dom = new JSDOM(source_code);
    const doc = dom.window.document;

    // extract script src attributes
    const scriptSrc = Array.from<HTMLElement>(
      doc.querySelectorAll("script[src]")
    )
      .map((el) => el.getAttribute("src"))
      .filter((src) => src != null);

    // extract all asset URLs (scripts, links, images, etc.)
    const assetUrls = [
      ...Array.from(doc.querySelectorAll("script[src]")).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("link[href]" )).map(el => el.getAttribute("href")),
      ...Array.from(doc.querySelectorAll("img[src]"   )).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("iframe[src]" )).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("source[src]" )).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("video[src]"  )).map(el => el.getAttribute("src")),
      ...Array.from(doc.querySelectorAll("audio[src]"  )).map(el => el.getAttribute("src")),
    ].filter((src): src is string => !!src);

    // extract inline script text content
    let js = Array.from<HTMLElement>(doc.querySelectorAll("script"))
      .map((el) => el.textContent || "")
      .filter((script) => script.trim());

    // fetch and add external JS file contents (limit to 50 for performance)
    if (baseUrl && scriptSrc.length > 0) {
      const fetchPromises = scriptSrc.slice(0, 50).map(async (src) => {
        try {
          // Handle relative URLs
          const url = src.startsWith("http") ? src : new URL(src, baseUrl).href;
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            return text;
          }
        } catch (e) {
          // Ignore fetch errors
        }
        return null;
      });
      const externalJs = await Promise.all(fetchPromises);
      js = js.concat(externalJs.filter(Boolean) as string[]);
    }

    // extract meta data
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
      assetUrls,
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

    // Technologies that can be detected with a single strong signal
    const strongMatchTechs = ["Amazon CloudFront"];

    // Debug: print scriptSrcs and headers
    console.log("[DEBUG] scriptSrcs:", site_data.scriptSrc);
    console.log("[DEBUG] assetUrls:", site_data.assetUrls);
    console.log("[DEBUG] headers:", Array.from(url_data.headers.entries()));

    const detect = (techName: string) => {
      if (visited.has(techName)) return;
      visited.add(techName);

      const techData = WebAnalyzer.technologies[techName];
      if (!techData) return;

      let detectedTypes: string[] = [];

      // Match JavaScript keys
      if (
        techData.js &&
        site_data.js.some((script) =>
          Object.keys(techData.js).some((key) => {
            const matched = WebAnalyzer.matchPattern(script, key);
            if (matched) {
              console.log(`[DEBUG] JS match for ${techName}: pattern="${key}" in script:`, script.slice(0, 100));
            }
            return matched;
          })
        )
      ) {
        detectedTypes.push("js");
      }

      // Match scriptSrc and assetUrls
      if (techData.scriptSrc) {
        const patterns = Array.isArray(techData.scriptSrc)
          ? techData.scriptSrc
          : [techData.scriptSrc];

        if (
          patterns.some((pattern: string) =>
            (site_data.assetUrls || []).some((src) => {
              const matched = WebAnalyzer.matchPattern(src, pattern);
              if (matched) {
                console.log(`[DEBUG] assetUrl match for ${techName}: pattern=\"${pattern}\" in url:`, src);
              }
              return matched;
            })
          )
        ) {
          detectedTypes.push("scriptSrc");
        }
      }

      // Match cookies
      if (techData.cookies) {
        if (
          Object.keys(techData.cookies).some((key) =>
            url_data.cookies.includes(key)
          )
        ) {
          detectedTypes.push("cookies");
        }
      }

      // Fix header debug log
      if (techData.headers) {
        if (
          Object.entries(techData.headers).some(([key, val]: [string, any]) => {
            const headerValue = url_data.headers.get(
              key.trim().replace(":", "")
            );
            const matched = headerValue !== null && (val === "" || WebAnalyzer.matchPattern(headerValue, val));
            if (matched) {
              console.log(`[DEBUG] header match for ${techName}: header=\"${key}\" value=\"${headerValue}\"`);
            }
            return matched;
          })
        ) {
          detectedTypes.push("headers");
        }
      }

      // Match meta
      if (techData.meta && site_data.meta) {
        if (
          Object.entries(techData.meta).some(([key, val]: [string, any]) => {
            const metaVal = site_data.meta[key.toLowerCase()];
            return metaVal ? WebAnalyzer.matchPattern(metaVal, val) : false;
          })
        ) {
          detectedTypes.push("meta");
        }
      }

      // Match DOM
      if (techData.dom && site_data.dom) {
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
          detectedTypes.push("dom");
        }
      }

      // Allow strong single match for certain technologies
      const minMatches = strongMatchTechs.includes(techName) ? 1 : 2;
      if (detectedTypes.length >= minMatches) {
        console.log(`[DETECTED] ${techName} using: ${detectedTypes.join(", ")}`);
        detectedTechnologies.push({ name: techName, detectedUsing: detectedTypes });

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
