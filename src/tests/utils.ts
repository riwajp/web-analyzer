import { TechData } from "../types";

export function generateWebPageForTech(
  techName: string,
  techData: TechData
): string {
  const externalScriptTags =
    (techData.scriptSrc as Array<string> | undefined)?.reduce(
      (acc, srcPattern) =>
        acc + `<script src="${getDummyMatchForRegex(srcPattern)}"></script>\n`,
      ""
    ) ?? "";

  const bodySnippets = techData.dom
    ? Object.keys(techData.dom).reduce((acc, selector) => {
        if (selector.startsWith(".")) {
          return acc + `<div class="${selector.slice(1)}"></div>\n`;
        } else if (selector.startsWith("#")) {
          return acc + `<div id="${selector.slice(1)}"></div>\n`;
        } else if (selector.startsWith("[")) {
          const attr = selector.slice(1, -1);
          return acc + `<div ${attr}></div>\n`;
        } else {
          return acc + `<${selector}></${selector}>\n`;
        }
      }, "")
    : "";

  const metaTags = techData.meta
    ? Object.entries(techData.meta).reduce(
        (acc, [name, content]) =>
          acc + `<meta name="${name}" content="${content}">\n`,
        ""
      )
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
        ${((techData.html as Array<string>) ?? []).join("\n")}
        ${bodySnippets}
      </body>
      <script>
        ${((techData.js as Array<string>) ?? []).join("\n")}
      </script>
    </html>
  `;

  return html.trim();
}

export function mockFetchForTech(
  techName: string,
  techData: TechData
): Response {
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
    const cookieString = Object.entries(techData.cookies).reduce(
      (acc, [name, regex]) =>
        acc + `${name}=${getDummyMatchForRegex(regex)}; Path=/;`,
      ""
    );
    responseHeaders.set("set-cookie", cookieString);
  }

  const mockResponse = {
    url: getUrlForTech(techName),
    status: 200,
    text: jest.fn().mockResolvedValue(html),
    headers: responseHeaders,
  } as unknown as Response;

  return mockResponse;
}

export function getUrlForTech(techName: string): string {
  return `https://mocked-${techName.toLowerCase().replace(/\s+/g, "-")}.com`;
}

export function getDummyMatchForRegex(pattern: string | RegExp): string {
  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
  let dummyMatch = regex.source;

  dummyMatch = dummyMatch.replace(/\\\//g, "/");
  dummyMatch = dummyMatch.replace(/\\\\/g, "\\");
  dummyMatch = dummyMatch.replace(/\\\./g, ".");
  dummyMatch = dummyMatch.replace(/\.\*/g, "dummy");
  dummyMatch = dummyMatch.replace(/\.\+/g, "dummy");

  return dummyMatch;
}
