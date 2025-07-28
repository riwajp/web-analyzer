"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPage = void 0;
const jsdom_1 = require("jsdom");
const cookie = __importStar(require("cookie"));
class WebPage {
    constructor(url) {
        this.url = url;
    }
    fetch() {
        return __awaiter(this, arguments, void 0, function* (timeoutMs = 10000, maxRedirects = 10) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            const startTime = Date.now();
            let currentUrl = this.url;
            let redirects = 0;
            let response;
            try {
                while (redirects <= maxRedirects) {
                    response = yield fetch(currentUrl, {
                        redirect: "manual",
                        signal: controller.signal,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        },
                    });
                    if (![301, 302, 303, 307, 308].includes(response.status)) {
                        break;
                    }
                    const location = response.headers.get("Location");
                    if (!location) {
                        console.warn(`Redirect status but no location header for ${currentUrl}`);
                        break;
                    }
                    currentUrl = new URL(location, currentUrl).toString();
                    redirects++;
                }
                clearTimeout(timeout);
                const responseTime = Date.now() - startTime;
                const sourceCode = yield response.text();
                return {
                    response: response,
                    responseTime,
                    sourceCode,
                    redirectCount: redirects,
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                if (error.name === "AbortError") {
                    console.error(`Fetch for ${this.url} timed out after ${timeoutMs}ms.`);
                }
                else {
                    console.error(`Failed to fetch ${this.url}:`, error);
                }
                throw error;
            }
            finally {
                clearTimeout(timeout);
            }
        });
    }
    parse(response, responseTime, sourceCode, redirectCount) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const finalRedirectCount = redirectCount;
            const contentLength = sourceCode.length;
            const dom = new jsdom_1.JSDOM(sourceCode);
            const doc = dom.window.document;
            const title = ((_b = (_a = doc.querySelector("title")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
            const description = ((_c = doc
                .querySelector('meta[name="description"]')) === null || _c === void 0 ? void 0 : _c.getAttribute("content")) || "";
            const body = doc.querySelector("body");
            const bodyElements = body ? body.querySelectorAll("*") : [];
            const bodyDomElementCount = bodyElements.length;
            const scriptCount = doc.querySelectorAll("script").length;
            const imageCount = doc.querySelectorAll("img").length;
            const linkCount = doc.querySelectorAll("link").length;
            const formCount = doc.querySelectorAll("form").length;
            const scriptSrc = [...doc.querySelectorAll("script[src]")]
                .map((el) => el.getAttribute("src"))
                .filter((src) => !!src);
            const assetUrls = [
                ...doc.querySelectorAll(`script[src],
     link[href],
     img[src],
     iframe[src],
     source[src],
     video[src],
     audio[src]`),
            ]
                .map((el) => {
                const tag = el.tagName.toLowerCase();
                return tag === "link"
                    ? el.getAttribute("href")
                    : el.getAttribute("src");
            })
                .filter((src) => !!src);
            const js = [...doc.querySelectorAll("script")]
                .map((el) => el.textContent || "")
                .filter((script) => script.trim());
            const meta = [...doc.querySelectorAll("meta")].reduce((acc, metaElement) => {
                const nameAttr = metaElement.getAttribute("name") ||
                    metaElement.getAttribute("property");
                const contentAttr = metaElement.getAttribute("content");
                if (nameAttr && contentAttr) {
                    acc[nameAttr.toLowerCase()] = contentAttr;
                }
                return acc;
            }, {});
            const textContentLength = ((_e = (_d = doc.body) === null || _d === void 0 ? void 0 : _d.textContent) === null || _e === void 0 ? void 0 : _e.trim().length) || 0;
            const webpageData = {
                sourceCode,
                headers: response.headers,
                cookies: cookie.parse((_f = response.headers.get("set-cookie")) !== null && _f !== void 0 ? _f : ""),
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
        }
        catch (error) {
            console.error(`Failed to parse ${this.url}:`, error);
            throw error;
        }
    }
    extractData() {
        return __awaiter(this, arguments, void 0, function* (fetchTimeout = 5000) {
            const { response, responseTime, sourceCode, redirectCount } = yield this.fetch(fetchTimeout);
            const webPageData = yield this.parse(response, responseTime, sourceCode, redirectCount);
            return webPageData;
        });
    }
}
exports.WebPage = WebPage;
