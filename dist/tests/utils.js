"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWebPageForTech = generateWebPageForTech;
exports.mockFetchForTech = mockFetchForTech;
exports.getUrlForTech = getUrlForTech;
exports.getDummyMatchForRegex = getDummyMatchForRegex;
exports.generateMockWebPageData = generateMockWebPageData;
exports.generateMockDetectedTechs = generateMockDetectedTechs;
const jsdom_1 = require("jsdom");
function generateWebPageForTech(techName, techData) {
    var _a, _b, _c, _d;
    const externalScriptTags = (_b = (_a = techData.scriptSrc) === null || _a === void 0 ? void 0 : _a.reduce((acc, srcPattern) => acc + `<script src="${getDummyMatchForRegex(srcPattern)}"></script>\n`, "")) !== null && _b !== void 0 ? _b : "";
    const bodySnippets = techData.dom
        ? Object.keys(techData.dom).reduce((acc, selector) => {
            if (selector.startsWith(".")) {
                return acc + `<div class="${selector.slice(1)}"></div>\n`;
            }
            else if (selector.startsWith("#")) {
                return acc + `<div id="${selector.slice(1)}"></div>\n`;
            }
            else if (selector.startsWith("[")) {
                const attr = selector.slice(1, -1);
                return acc + `<div ${attr}></div>\n`;
            }
            else {
                return acc + `<${selector}></${selector}>\n`;
            }
        }, "")
        : "";
    const metaTags = techData.meta
        ? Object.entries(techData.meta).reduce((acc, [name, content]) => acc + `<meta name="${name}" content="${content}">\n`, "")
        : "";
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${techName} example webpage</title>
        ${metaTags}
        ${externalScriptTags}
      </head>
      <body>
        ${((_c = techData.html) !== null && _c !== void 0 ? _c : []).join("\n")}
        ${bodySnippets}
      </body>
      <script>
        ${((_d = techData.js) !== null && _d !== void 0 ? _d : []).join("\n")}
      </script>
    </html>
  `;
    return html.trim();
}
function mockFetchForTech(techName, techData) {
    const html = generateWebPageForTech(techName, techData);
    const responseHeaders = new Headers({
        "content-type": "text/html",
    });
    if (techData.headers) {
        Object.entries(techData.headers).forEach(([key, valPattern]) => {
            responseHeaders.set(key, getDummyMatchForRegex(valPattern));
        });
    }
    if (techData.cookies) {
        const cookieString = Object.entries(techData.cookies).reduce((acc, [name, regex]) => acc + `${name}=${getDummyMatchForRegex(regex)}; Path=/;`, "");
        responseHeaders.set("set-cookie", cookieString);
    }
    const mockResponse = {
        url: getUrlForTech(techName),
        status: 200,
        text: jest.fn().mockResolvedValue(html),
        headers: responseHeaders,
    };
    return mockResponse;
}
function getUrlForTech(techName) {
    return `https://mocked-${techName.toLowerCase().replace(/\s+/g, "-")}.com`;
}
function getDummyMatchForRegex(pattern) {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    let dummyMatch = regex.source;
    dummyMatch = dummyMatch.replace(/\\\//g, "/");
    dummyMatch = dummyMatch.replace(/\\\\/g, "\\");
    dummyMatch = dummyMatch.replace(/\\\./g, ".");
    dummyMatch = dummyMatch.replace(/\.\*/g, "dummy");
    dummyMatch = dummyMatch.replace(/\.\+/g, "dummy");
    return dummyMatch;
}
function generateMockWebPageData(options) {
    var _a, _b, _c, _d, _e, _f;
    const dom = new jsdom_1.JSDOM(`<html>
    <head><title>${options.title || "Test Page"}</title></head>
    <body>
      ${options.hasCaptchaElement ? '<div id="captcha-box"></div>' : ""}
      ${options.hasChallengeElement ? '<div id="challenge-box"></div>' : ""}
    </body>
  </html>`);
    return {
        sourceCode: options.hasCaptchaElement
            ? "<div>recaptcha</div>"
            : "<html></html>",
        headers: new Headers(),
        cookies: {},
        statusCode: (_a = options.statusCode) !== null && _a !== void 0 ? _a : 200,
        responseTime: (_b = options.responseTime) !== null && _b !== void 0 ? _b : 200,
        contentLength: 1500,
        contentType: "text/html",
        finalUrl: "https://example.com",
        redirectCount: (_c = options.redirectCount) !== null && _c !== void 0 ? _c : 0,
        scriptSrc: [],
        js: [],
        meta: options.meta || {},
        dom,
        assetUrls: [],
        title: (_d = options.title) !== null && _d !== void 0 ? _d : "Test Page",
        description: "Mocked page",
        bodyDomElementCount: (_e = options.bodyDomElementCount) !== null && _e !== void 0 ? _e : 50,
        textContentLength: (_f = options.textContentLength) !== null && _f !== void 0 ? _f : 800,
        scriptCount: 1,
        imageCount: 1,
        linkCount: 1,
        formCount: 1,
    };
}
function generateMockDetectedTechs(names) {
    return names.map((name) => ({
        name,
        confidence: 90,
        confidenceLevel: "HIGH",
        detectedUsing: ["pattern"],
        matches: [],
        detectionType: "detection",
    }));
}
