import { JSDOM } from "jsdom";
import { SiteData, type URLData } from "./types";

const WebAnalyzer = {
  technologies: {},
  relations: {
    // certIssuer: "oo",
    cookies: "mm",
    css: "oo",
    dns: "mm",
    headers: "mm",
    html: "oo",
    meta: "mm",
    // probe: "mm",
    // robots: "oo",
    scriptSrc: "om",
    scripts: "oo",
    text: "oo",
    url: "oo",
    // xhr: "oo",
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

  // Parses the source code of a webpage and extracts data for further analysis and detection
  parseSourceCode: (source_code: string): SiteData => {
    const dom = new JSDOM(source_code);
    const doc = dom.window.document;

    const css_selectors = Array.from<HTMLElement>(doc.querySelectorAll("*"))
      .map((el) => el.tagName.toLowerCase())
      .filter((value, index, self) => self.indexOf(value) === index);

    const links = Array.from<HTMLAnchorElement>(doc.querySelectorAll("a"))
      .map((el) => el.href)
      .filter((href) => href);

    const js = Array.from<HTMLElement>(doc.querySelectorAll("script"))
      .map((el) => el.textContent || "")
      .filter((script) => script.trim());

    const scriptSrc = Array.from<HTMLElement>(
      doc.querySelectorAll("script[src]")
    )
      .map((el) => el.getAttribute("src"))
      .filter((src) => src != null);

    const script = Array.from<HTMLElement>(doc.querySelectorAll("script"))
      .map((el) => el.textContent || "")
      .filter((script) => script.trim());

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

    const text =
      doc.body.innerText?.split("\n").filter((line: string) => line.trim()) ??
      "";

    return {
      css_selectors,
      links,
      js,
      scriptSrc,
      script,
      meta,
      text,
    };
  },

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
    const detectedTechnologies: Record<string, any> = {};

    for (const [techName, techData] of Object.entries(
      WebAnalyzer.technologies
    ) as [string, any][]) {
      let detected = false;

      // Match JavaScript keys
      if (techData.js) {
        detected = Object.keys(techData.js).some((key: string) =>
          site_data.js.some((script) => WebAnalyzer.matchPattern(script, key))
        );
      }

      // Match scriptSrc (using regex or fallback)
      if (!detected && techData.scriptSrc) {
        const patterns = Array.isArray(techData.scriptSrc)
          ? techData.scriptSrc
          : [techData.scriptSrc];

        detected = patterns.some((pattern: string) =>
          site_data.scriptSrc.some((src) =>
            WebAnalyzer.matchPattern(src, pattern)
          )
        );
      }

      //   Check cookies keys
      if (!detected && techData.cookies) {
        const cookieKeys = Object.keys(techData.cookies);
        detected = cookieKeys.some((key) => url_data.cookies.includes(key));
      }

      // Check CSS selectors/regex
      if (!detected && techData.css) {
        const cssPatterns = Array.isArray(techData.css)
          ? techData.css
          : [techData.css];

        detected = cssPatterns.some((pattern: string) =>
          site_data.css_selectors.some((selector) =>
            WebAnalyzer.matchPattern(selector, pattern)
          )
        );
      }

      if (!detected && techData.headers) {
        detected = Object.entries(techData.headers).some(
          ([key, val]: [string, any]) => {
            const headerValue = url_data.headers.get(
              key.trim().replace(":", "")
            );
            return (
              headerValue !== null &&
              (val === "" || WebAnalyzer.matchPattern(headerValue, val))
            );
          }
        );
      }

      if (!detected && techData.meta && site_data.meta) {
        detected = Object.entries(techData.meta).some(
          ([key, val]: [string, any]) => {
            const metaVal = site_data.meta[key];
            return metaVal ? WebAnalyzer.matchPattern(metaVal, val) : false;
          }
        );
      }

      if (detected) {
        detectedTechnologies[techName] = techData;
      }
    }

    return detectedTechnologies;
  },
};

export default WebAnalyzer;
