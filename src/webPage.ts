import { JSDOM } from 'jsdom';
import type { URLData, SiteData } from './types';

export class WebPage {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async fetchAndParse(): Promise<{ urlData: URLData; siteData: SiteData }> {
    try {
      const startTime = Date.now();
      let redirectCount = 0;
      const response = await fetch(this.url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const responseTime = Date.now() - startTime;
      const sourceCode = await response.text();
      const contentLength = sourceCode.length;

      if (response.url !== this.url) {
        redirectCount = 1;
      }

      const urlData: URLData = {
        sourceCode,
        headers: response.headers,
        cookies: response.headers.get('set-cookie') || '',
        statusCode: response.status,
        responseTime,
        contentLength,
        contentType: response.headers.get('content-type') || '',
        finalUrl: response.url,
        redirectCount,
      };

      const dom = new JSDOM(sourceCode);
      const doc = dom.window.document;

      const title = doc.querySelector('title')?.textContent?.trim() || '';
      const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      const allElements = doc.querySelectorAll('*');
      const domElementCount = allElements.length;

      const scriptCount = doc.querySelectorAll('script').length;
      const imageCount = doc.querySelectorAll('img').length;
      const linkCount = doc.querySelectorAll('link').length;
      const formCount = doc.querySelectorAll('form').length;

      const hasCaptchaElements = !!(
        doc.querySelector('.g-recaptcha') ||
        doc.querySelector('.h-captcha') ||
        doc.querySelector('.cf-turnstile') ||
        doc.querySelector('[data-sitekey]') ||
        sourceCode.includes('recaptcha') ||
        sourceCode.includes('hcaptcha') ||
        sourceCode.includes('turnstile')
      );

      const hasChallengeElements = !!(
        doc.querySelector('[id*="challenge"]') ||
        doc.querySelector('[class*="challenge"]') ||
        doc.querySelector('[id*="verification"]') ||
        doc.querySelector('[class*="verification"]') ||
        sourceCode.includes('challenge-platform') ||
        sourceCode.includes('browser-verification')
      );

      const suspiciousElements: string[] = [];
      const suspiciousSelectors = [
        '[id*="challenge"]',
        '[class*="challenge"]',
        '[id*="captcha"]',
        '[class*="captcha"]',
        '[id*="block"]',
        '[class*="block"]',
        '[id*="protection"]',
        '[class*="protection"]',
        '[id*="security"]',
        '[class*="security"]',
      ];

      suspiciousSelectors.forEach((selector) => {
        const elements = doc.querySelectorAll(selector);
        elements.forEach((el) => {
          if ((el as Element).id) suspiciousElements.push(`#${(el as Element).id}`);
          if ((el as Element).className) suspiciousElements.push(`.${(el as Element).className.split(' ')[0]}`);
        });
      });

      const scriptSrc = Array.from(doc.querySelectorAll('script[src]'))
        .map((el) => el.getAttribute('src'))
        .filter((src): src is string => !!src);

      const assetUrls = [
        ...Array.from(doc.querySelectorAll('script[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('link[href]')).map((el) => el.getAttribute('href')),
        ...Array.from(doc.querySelectorAll('img[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('iframe[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('source[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('video[src]')).map((el) => el.getAttribute('src')),
        ...Array.from(doc.querySelectorAll('audio[src]')).map((el) => el.getAttribute('src')),
      ].filter((src): src is string => !!src);

      const js = Array.from(doc.querySelectorAll('script'))
        .map((el) => el.textContent || '')
        .filter((script) => script.trim());

      const meta: Record<string, string> = {};
      Array.from(doc.querySelectorAll('meta')).forEach((metaElement: HTMLElement) => {
        const nameAttr = metaElement.getAttribute('name') || metaElement.getAttribute('property');
        const contentAttr = metaElement.getAttribute('content');
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
        hasCaptchaElements,
        hasChallengeElements,
        suspiciousElements,
      };

      return { urlData, siteData };
    } catch (error) {
      console.error(`Failed to fetch and parse ${this.url}:`, error);
      throw error;
    }
  }
}