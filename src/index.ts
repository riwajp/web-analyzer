import fs from "fs";
import { WebAnalyzer } from "./webanalyzer";
import type { DetectionResult, DetectionConfig } from "./types";

const urls = [
  "https://www.grove.co/", // hCaptcha
  "https://login.payoneer.com/", //reblaze [js cookie :( ]
  "https://www.rafael.co.il/", //reblaze
  "https://darksmile.tickets/", // queue-fair [js cookie]
  "https://www.reukraine.org/villages-eng", // queue-fair
  "https://www.bankofamerica.com/", // akamai
  "http://marketplace.aps.com/", //sucuri
  "https://ezbatteryreconditioning.com/", //sucuri
  "https://www.cvs.com/",
  "https://www.footlocker.com/",
  "https://www.tripadvisor.com/",
  "https://www.cdiscount.com/",
  "https://www.salesforce.com/",
  "https://www.intuit.com/",
  "https://www.advanceautoparts.com/",
  "https://www.affitto.it/",
  "https://www.agoda.cn/",
  "https://www.albertsons.com/",
  "https://www.allpeople.com/",
  "https://www.autozone.com/",
  "https://www.bestbuy.com/",
  "https://www.bestwestern.com/",
  "https://www.billiger.de/",
  "https://www.bottlerover.com/",
  "https://www.carousell.com/",
  "https://www.carousell.com.hk/",
  "https://www.carousell.com.my/",
  "https://www.carousell.ph/",
  "https://www.carousell.sg/",
  "https://www.carsales.com.au/",
  "https://www.chewy.com/",
  "https://www.costco.com/",
  "https://www.cvs.com/",
  "https://www.despegar.com.mx/",
  "https://www.dickssportinggoods.com/",
  "https://www.dynos.es/",
  "https://www.emaxme.com/",
  "https://www.familytreenow.com/",
  "https://www.feuvert.fr/",
  "https://www.flooranddecor.com/",
  "https://www.foodlion.com/",
  "https://www.footlocker.co.uk/",
  "https://www.giantfoodstores.com/",
  "https://www.gopuff.com/",
  "https://www.gplay.bg/",
  "https://www.hermes.com/",
  "https://www.hyatt.com/",
  "https://www.idealo.de/",
  "https://www.immobilienscout24.de/",
  "https://www.ingatlan.com/",
  "https://www.instacart.com/",
  "https://www.intersport.fr/",
  "https://www.joann.com/",
  "https://www.kroger.com/",
  "https://www.lazada.co.id/",
  "https://www.lazada.co.th/",
  "https://www.lazada.com.my/",
  "https://www.lazada.com.ph/",
  "https://www.lazada.sg/",
  "https://www.lazada.vn/",
  "https://www.lowes.ca/",
  "https://www.lowes.com/",
  "https://www.mcmaster.com/",
  "https://www.mediamarkt.de/",
  "https://www.mediamarkt.es/",
  "https://www.medline.com/",
  "https://www.mscdirect.com/",
  "https://www.napaonline.com/",
  "https://www.nofrills.ca/",
  "https://www.peoplefinders.com/",
  "https://www.platt.com/",
  "https://www.publicdatausa.com/",
  "https://www.realcanadiansuperstore.ca/",
  "https://www.realestate.com.au/",
  "https://www.restaurantguru.com/",
  "https://www.searchpeoplefree.com/",
  "https://www.shopee.cl/",
  "https://www.shopee.co.id/",
  "https://www.shopee.co.th/",
  "https://www.shopee.com.br/",
  "https://www.shopee.com.co/",
  "https://www.shopee.com.mx/",
  "https://www.shopee.com.my/",
  "https://www.shopee.ph/",
  "https://www.shopee.sg/",
  "https://www.shopee.tw/",
  "https://www.shopee.vn/",
  "https://www.similarweb.com/",
  "https://www.skyscanner.co.kr/",
  "https://www.skyscanner.net/",
  "https://www.stopandshop.com/",
  "https://www.target.com/",
  "https://www.temu.com/",
  "https://www.ticketmaster.com/",
  "https://www.totalwine.com/",
  "https://www.tractorsupply.com/",
  "https://www.walmart.com.mx/",
  "https://www.wayfair.com/",
  "https://www.weismarkets.com/",
  "https://www.wizzair.com/",
  "https://www.worten.pt/",
  "https://www.octopart.com/",
  "https://www.lowes.com/",
  "https://www.homedepot.com/",
  "https://www.walmart.com/",
];

async function processBatch(
  urls: string[],
  config: Partial<DetectionConfig> = {},
  options: {
    concurrent?: number;
    outputFile?: string;
    progressCallback?: (processed: number, total: number, url: string) => void;
  } = {}
): Promise<DetectionResult[]> {
  const { concurrent = 2, outputFile, progressCallback } = options;
  const results: DetectionResult[] = [];

  console.log(`Starting batch processing of ${urls.length} URLs`);

  for (let i = 0; i < urls.length; i += concurrent) {
    const batch = urls.slice(i, i + concurrent);
    const batchPromises = batch.map(async (url) => {
      // Ensure config (DetectionConfig) is provided
      if (
        !config ||
        typeof config !== "object" ||
        config.mode === undefined ||
        config.mode === null
      ) {
        throw new Error(
          `A complete DetectionConfig with a defined 'mode' property must be provided to WebAnalyzer.analyze.`
        );
      }

      WebAnalyzer.init(["src/data/tech.json"], config);
      const result = await WebAnalyzer.analyze(url);
      progressCallback?.(i + batch.indexOf(url) + 1, urls.length, url);
      return { url, result };
    });

    const batchResults = await Promise.allSettled(batchPromises);
    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.result) {
        results.push(result.value.result);
      } else {
        console.error(
          `Failed to process ${batch[index]}:`,
          result.status === "rejected" ? result.reason : "No result"
        );
      }
    });
  }

  const summary = generateSummaryReport(results);
  console.log(`Batch processing complete!\n${summary}`);

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");
    console.log(`Results saved to ${outputFile}`);
  }

  return results;
}

function generateSummaryReport(results: DetectionResult[]): string {
  const totalUrls = results.length;
  const successfulUrls = results.length;
  const blockedUrls = results.filter(
    (r) => r.blockingIndicators?.likelyBlocked
  ).length;
  const avgTechnologies =
    results.reduce((sum, r) => sum + (r.stats?.total ?? 0), 0) /
    (successfulUrls || 1);
  const avgConfidence =
    results.reduce((sum, r) => sum + (r.stats?.averageConfidence ?? 0), 0) /
    (successfulUrls || 1);

  const techCounts: Record<string, number> = {};
  results.forEach((r) => {
    r.technologies.forEach((tech) => {
      techCounts[tech.name] = (techCounts[tech.name] || 0) + 1;
    });
  });

  const topTechs = Object.entries(techCounts)
    .sort(([, a], [, b]) => b - a)
    // .slice(0, 10)
    .map(([tech, count]) => `${tech}: ${count}`);

  return `
        SUMMARY
        ==========================
        Total URLs: ${totalUrls}
        Successful: ${successfulUrls} (${
    totalUrls > 0 ? ((successfulUrls / totalUrls) * 100).toFixed(1) : "0.0"
  }%)
        Blocked/Failed: ${totalUrls - successfulUrls} (${
    totalUrls > 0
      ? (((totalUrls - successfulUrls) / totalUrls) * 100).toFixed(1)
      : "0.0"
  }%)
        Likely Blocked: ${blockedUrls} (${
    successfulUrls > 0
      ? ((blockedUrls / successfulUrls) * 100).toFixed(1)
      : "0.0"
  }%)

        Average Technologies per Site: ${
          isFinite(avgTechnologies) ? avgTechnologies.toFixed(1) : "0.0"
        }
        Average Confidence: ${
          isFinite(avgConfidence) ? avgConfidence.toFixed(1) : "0.0"
        }%

        Det Technologies:
        ${topTechs.join("\n")}
`;
}

(async () => {
  const outputFile = "enhanced-brightdata-analysis.json";
  const config: Partial<DetectionConfig> = {
    mode: "NORMAL",
    includeRawData: false,
    blockingDetectionEnabled: true,
  };

  try {
    const results = await processBatch(urls, config, {
      concurrent: 2,
      outputFile,
      progressCallback: (processed, total, url) => {
        console.log(`Progress: ${processed}/${total} - ${url}`);
      },
    });

    console.log(`All ${results.length} URLs processed successfully!`);

    const blockedSites = results.filter(
      (r) => r.blockingIndicators?.likelyBlocked
    );
    if (blockedSites.length > 0) {
      fs.writeFileSync(
        "blocked-sites-analysis.json",
        JSON.stringify(blockedSites, null, 2),
        "utf-8"
      );
      console.log(
        `${blockedSites.length} blocked sites saved to blocked-sites-analysis.json`
      );
    }

    const notBlockedSites = results.filter(
      (r) => !r.blockingIndicators?.likelyBlocked
    );
    if (notBlockedSites.length > 0) {
      fs.writeFileSync(
        "not-blocked-sites-analysis.json",
        JSON.stringify(notBlockedSites, null, 2),
        "utf-8"
      );
      console.log(
        `${notBlockedSites.length} not-blocked sites saved to not-blocked-sites-analysis.json`
      );
    }
    const highConfidenceDetections = results.filter(
      (r) => r.stats.averageConfidence > 80 && r.stats.total > 5
    );
    if (highConfidenceDetections.length > 0) {
      fs.writeFileSync(
        "high-confidence-detections.json",
        JSON.stringify(highConfidenceDetections, null, 2),
        "utf-8"
      );
      console.log(
        `${highConfidenceDetections.length} high-confidence results saved to high-confidence-detections.json`
      );
    }
  } catch (error) {
    console.error("Fatal error during batch processing:", error);
    process.exit(1);
  }
})();
