import { JSDOM } from "jsdom";
import { SiteData, type URLData } from "./types";

const WebAnalyzer = {
  technologies: {} as Record<string, any>,
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

      // Match CSS
      // if (!detected && techData.css) {
      //   const cssPatterns = Array.isArray(techData.css)
      //     ? techData.css
      //     : [techData.css];

      //   if (
      //     cssPatterns.some((pattern: string) =>
      //       site_data.css_selectors.some((selector) =>
      //         WebAnalyzer.matchPattern(selector, pattern)
      //       )
      //     )
      //   ) {
      //     detected = true;
      //     detectedUsing = "css";
      //   }
      // }

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

      if (detected) {
        detectedTechnologies[techName] = {
          ...techData,
          detectedUsing,
        };

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
