import { TechData } from "../types";

export function generateWebPageForTech(
  techName: string,
  techData: TechData
): string {
  const externalScriptTags: string[] = [];
  const bodySnippets: string[] = [];

  if (techData.scriptSrc) {
    (techData.scriptSrc as Array<string>).forEach((srcPattern) => {
      externalScriptTags.push(
        `<script src="${getDummyMatchForRegex(srcPattern)}"></script>`
      );
    });
  }

  if (techData.dom) {
    Object.keys(techData.dom).forEach((selector) => {
      if (selector.startsWith(".")) {
        bodySnippets.push(`<div class="${selector.slice(1)}"></div>`);
      } else if (selector.startsWith("#")) {
        bodySnippets.push(`<div id="${selector.slice(1)}"></div>`);
      } else if (selector.startsWith("[")) {
        const attr = selector.slice(1, -1);
        bodySnippets.push(`<div ${attr}></div>`);
      } else {
        bodySnippets.push(`<${selector}></${selector}>`);
      }
    });
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${techName} example webpage</title>

        ${Object.entries(techData.meta ?? {}).map(
          ([name, content]) => `<meta name="${name}" content="${content}">`
        )}
        
        ${externalScriptTags?.join("\n")}
      </head>
      <body>
        ${((techData.html as Array<string>) ?? []).join("\n")}
        ${bodySnippets.join("\n")}
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
    const cookieString = Object.entries(techData.cookies)
      .map(
        ([name, _regex]) => `${name}=${getDummyMatchForRegex(_regex)}; Path=/;`
      )
      .join(";");
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

  const source = regex.source;

  let dummyMatch = source;

  // Handle escaped slashes
  dummyMatch = dummyMatch.replace(/\\\//g, "/");

  // Handle escaped backslashes
  dummyMatch = dummyMatch.replace(/\\\\/g, "\\");

  // Replace escaped dots with literal dots:
  dummyMatch = dummyMatch.replace(/\\\./g, ".");

  // Replace .* or .+ with dummy text:
  dummyMatch = dummyMatch.replace(/\.\*/g, "dummy");
  dummyMatch = dummyMatch.replace(/\.\+/g, "dummy");

  return dummyMatch;
}
