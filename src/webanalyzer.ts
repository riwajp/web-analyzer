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

    const meta = Array.from<HTMLElement>(doc.querySelectorAll("meta")).map(
      (el) => el.outerHTML
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

      // Check JS keys (look for substring in any site js strings)
      if (techData.js) {
        const jsKeys = Object.keys(techData.js);
        detected = jsKeys.some((key) =>
          site_data.js.some((script) => script.includes(key))
        );
      }

      // Check scriptSrc with regex matching against each scriptSrc string
      if (!detected && techData.scriptSrc) {
        try {
          const regex = new RegExp(techData.scriptSrc, "i");
          detected = site_data.scriptSrc.some((src) => regex.test(src));
        } catch {
          // fallback: exact match
          detected = site_data.scriptSrc.includes(techData.scriptSrc);
        }
      }

      // Check cookies keys
      // if (!detected && techData.cookies) {
      //   const cookieKeys = Object.keys(techData.cookies);
      //   detected = cookieKeys.some(key =>
      //     url_data.cookies.some(cookie => cookie.includes(key))
      //   );
      // }

      // Check CSS selectors/regex
      if (!detected && techData.css) {
        const cssPatterns = Array.isArray(techData.css)
          ? techData.css
          : [techData.css];
        detected = cssPatterns.some((pattern: string) =>
          site_data.css_selectors.some((css) =>
            WebAnalyzer.matchPattern(css, pattern)
          )
        );
      }

      // Check headers with key-value regex matching
      if (!detected && techData.headers) {
        detected = Object.entries(techData.headers).every(
          ([headerKey, headerVal]: [string, any]) => {
            const siteHeaderVal = url_data.headers.get(
              headerKey.trim().replace(":", "")
            );
            if (!siteHeaderVal) return false;
            return (
              headerVal === "" || new RegExp(headerVal, "i").test(siteHeaderVal)
            );
          }
        );
      }

      // Check meta tags with key-value regex matching
      // if (!detected && techData.meta) {
      //   detected = Object.entries(techData.meta).every(([metaKey, metaVal]:[string,any]) => {
      //     const siteMetaVal = site_data.meta[metaKey.toLowerCase()];
      //     if (!siteMetaVal) return false;
      //     return metaVal === '' || new RegExp(metaVal, 'i').test(siteMetaVal);
      //   });
      // }

      if (detected) {
        detectedTechnologies[techName] = techData;
      }
    }

    return detectedTechnologies;
  },
};

export default WebAnalyzer;
