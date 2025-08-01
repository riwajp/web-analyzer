import { JSDOM } from "jsdom";
import type { WebPageData } from "../types";
import * as cookie from "cookie";

export class WebPage {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async fetch(
    timeoutMs = 10000,
    maxRedirects = 10
  ): Promise<{
    response: Response;
    responseTime: number;
    sourceCode: string;
    redirectCount: number;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    let currentUrl = this.url;
    let redirects = 0;
    let response: Response;

    try {
      while (redirects <= maxRedirects) {
        response = await fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) {
          break;
        }

        const location = response.headers.get("Location");
        if (!location) {
          console.warn(
            `Redirect status but no location header for ${currentUrl}`
          );
          break;
        }

        currentUrl = new URL(location, currentUrl).toString();
        redirects++;
      }

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;
      const sourceCode = await response!.text();

      return {
        response: response!,
        responseTime,
        sourceCode,
        redirectCount: redirects,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error(`Fetch for ${this.url} timed out after ${timeoutMs}ms.`);
      } else {
        console.error(`Failed to fetch ${this.url}:`, error);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  parse(
    response: Response,
    responseTime: number,
    sourceCode: string,
    redirectCount: number
  ): WebPageData {
    try {
      const finalRedirectCount = redirectCount;
      const contentLength = sourceCode.length;

      const dom = new JSDOM(sourceCode);
      const doc = dom.window.document;

      const title = doc.querySelector("title")?.textContent?.trim() || "";
      const description =
        doc
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";

      const body = doc.querySelector("body");
      const bodyElements = body ? body.querySelectorAll("*") : [];
      const bodyDomElementCount = bodyElements.length;

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

      const meta = [...doc.querySelectorAll("meta")].reduce<
        Record<string, string>
      >((acc, metaElement) => {
        const nameAttr =
          metaElement.getAttribute("name") ||
          metaElement.getAttribute("property");
        const contentAttr = metaElement.getAttribute("content");

        if (nameAttr && contentAttr) {
          acc[nameAttr.toLowerCase()] = contentAttr;
        }

        return acc;
      }, {});

      const textContentLength = doc.body?.textContent?.trim().length || 0;

      const webpageData: WebPageData = {
        sourceCode,
        headers: response.headers,
        cookies: cookie.parse(response.headers.get("set-cookie") ?? ""),
        statusCode: response.status,
        responseTime,
        contentLength,
        contentType: response.headers.get("content-type") || "",
        finalUrl: response.url,
        redirectCount: finalRedirectCount,
        scriptSrc,
        js,
        meta,
        dom,
        assetUrls,
        title,
        description,
        bodyDomElementCount,
        textContentLength,
        scriptCount,
        imageCount,
        linkCount,
        formCount,
      };
      return webpageData;
    } catch (error) {
      console.error(`Failed to parse ${this.url}:`, error);
      throw error;
    }
  }

  async extractData(fetchTimeout: number = 5000): Promise<WebPageData> {
    const { response, responseTime, sourceCode, redirectCount } =
      await this.fetch(fetchTimeout);
    const webPageData = await this.parse(
      response,
      responseTime,
      sourceCode,
      redirectCount
    );
    return webPageData;
  }
}
