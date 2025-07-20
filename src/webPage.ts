import { JSDOM } from "jsdom";
import type { URLData, SiteData } from "./types";

export class WebPage {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async fetch(timeoutMs = 5000): Promise<{
    response: Response;
    responseTime: number;
    sourceCode: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(this.url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;
      const sourceCode = await response.text();

      return { response, responseTime, sourceCode };
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error(`Fetch for ${this.url} timed out after ${timeoutMs}ms.`);
      } else {
        console.error(`Failed to fetch ${this.url}:`, error);
      }
      throw error;
    }
  }

  parse(
    response: Response,
    responseTime: number,
    sourceCode: string
  ): { urlData: URLData; siteData: SiteData } {
    try {
      let redirectCount = 0;
      const contentLength = sourceCode.length;

      if (response.url !== this.url) {
        redirectCount = 1;
      }

      const urlData: URLData = {
        sourceCode,
        headers: response.headers,
        cookies: response.headers.get("set-cookie") || "",
        statusCode: response.status,
        responseTime,
        contentLength,
        contentType: response.headers.get("content-type") || "",
        finalUrl: response.url,
        redirectCount,
      };

      const dom = new JSDOM(sourceCode);
      const doc = dom.window.document;

      const title = doc.querySelector("title")?.textContent?.trim() || "";
      const description =
        doc
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";

      const allElements = doc.querySelectorAll("*");
      const domElementCount = allElements.length;

      const scriptCount = doc.querySelectorAll("script").length;
      const imageCount = doc.querySelectorAll("img").length;
      const linkCount = doc.querySelectorAll("link").length;
      const formCount = doc.querySelectorAll("form").length;

      const scriptSrc = [...doc.querySelectorAll("script[src]")]
        .map((el) => el.getAttribute("src"))
        .filter((src): src is string => !!src);

      const assetUrls = [
        ...doc.querySelectorAll(
          `script[src],
     link[href],
     img[src],
     iframe[src],
     source[src],
     video[src],
     audio[src]`
        ),
      ]
        .map((el) => {
          const tag = el.tagName.toLowerCase();
          return tag === "link"
            ? el.getAttribute("href")
            : el.getAttribute("src");
        })
        .filter((src): src is string => !!src);

      const js = [...doc.querySelectorAll("script")]
        .map((el) => el.textContent || "")
        .filter((script) => script.trim());

      const meta: Record<string, string> = {};

      [...doc.querySelectorAll("meta")].forEach((metaElement: HTMLElement) => {
        const nameAttr =
          metaElement.getAttribute("name") ||
          metaElement.getAttribute("property");
        const contentAttr = metaElement.getAttribute("content");
        if (nameAttr && contentAttr) {
          meta[nameAttr.toLowerCase()] = contentAttr;
        }
      });

      const textContentLength = doc.body?.textContent?.trim().length || 0;

      const siteData: SiteData = {
        scriptSrc,
        js,
        meta,
        dom,
        assetUrls,
        title,
        description,
        domElementCount,
        textContentLength,
        scriptCount,
        imageCount,
        linkCount,
        formCount,
      };

      return { urlData, siteData };
    } catch (error) {
      console.error(`Failed to parse ${this.url}:`, error);
      throw error;
    }
  }

  async extractData(
    fetchTimeout: number
  ): Promise<{ urlData: URLData; siteData: SiteData }> {
    const { response, responseTime, sourceCode } = await this.fetch(
      fetchTimeout
    );
    const { urlData, siteData } = await this.parse(
      response,
      responseTime,
      sourceCode
    );

    return { urlData, siteData };
  }
}
