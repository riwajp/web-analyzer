export interface URLData {
  source_code: string;
  headers: Headers;
  cookies: string;
}

export interface SiteData {
  css_selectors: string[];
  links: string[];
  js: string[];
  scriptSrc: string[];
  script: string[];
  meta: Record<string, string>;
  text: string[];
}

export type TechnologiesMap = Record<string, any>;
