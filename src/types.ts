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

// export interface Technology {
//   cats: number[];
//   description?: string;
//   icon?: string;
//   implies?: string | string[];
//   js?: Record<string, string>;
//   dom?: string;
//   oss?: boolean;
//   saas?: boolean;
//   pricing?: string[];
//   scriptSrc?: string;
//   website?: string;
// }

export type TechnologiesMap = Record<string, any>;
