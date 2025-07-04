import WebAnalyzer from "./webanalyzer";
import fs from "fs";
import path from "path";

import type { TechnologiesMap } from "./types";

let technologies: TechnologiesMap = {};

// Load all technology data from JSON files in the technologies directory
for (const index of Array(27).keys()) {
  const character = index ? String.fromCharCode(index + 96) : "_";

  technologies = {
    ...technologies,
    ...JSON.parse(
      fs.readFileSync(
        path.resolve(`${__dirname}/technologies/${character}.json`),
        "utf-8"
      )
    ),
  };
}

WebAnalyzer.technologies = technologies;

(async () => {
  const url_data = await WebAnalyzer.fetchURL("https://discord.com/");
  const site_data = WebAnalyzer.parseSourceCode(url_data.source_code);
  console.log(site_data);

  console.log(WebAnalyzer.detectPatterns(site_data, url_data));
})();
