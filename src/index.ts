import WebAnalyzer from "./webanalyzer";
import fs from "fs";
import { performance } from "perf_hooks";
import type { TechnologiesMap, DetectionResult } from "./types";

function ensureInitialized() {
  if (!WebAnalyzer.initialized) {
    WebAnalyzer.init(["src/data/tech.json"]);
  }
}

export async function detectTechnology(url: string): Promise<DetectionResult> {
  ensureInitialized();
  console.log(`Detecting technologies for: ${url}`);

  const timings: Record<string, number> = {};

  try {
    timings.fetchStart = performance.now();
    const url_data = await WebAnalyzer.fetchURL(url);
    timings.afterFetch = performance.now();

    const site_data = await WebAnalyzer.parseSourceCode(url_data.source_code, url);
    timings.afterParse = performance.now();

    const detected_technologies = WebAnalyzer.detectPatterns(
      site_data,
      url_data
    );

    // Map EnhancedDetectedTechnology[] to DetectedTechnology[] for legacy compatibility
    const legacy_detected_technologies = detected_technologies.map(tech => ({
      name: tech.name,
      detectedUsing: Array.isArray(tech.detectedUsing) ? tech.detectedUsing.join(", ") : tech.detectedUsing || null
    }));

    timings.afterDetect = performance.now();

    const result: DetectionResult = {
      url,
      technologies: legacy_detected_technologies,
      timings: {
        fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
        parse: +(timings.afterParse - timings.afterFetch).toFixed(2),
        detect: +(timings.afterDetect - timings.afterParse).toFixed(2),
        total: +(timings.afterDetect - timings.fetchStart).toFixed(2),
      },
    };

    console.log("Detected for:", url);

    return result;
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return {} as DetectionResult;  
  }
}

const urls = [
  "https://www.fiverr.com/",
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
  "https://www.worten.pt/"
];

const outputFile = "brightData-premium-domains.json";

(async () => {
  const allResults: DetectionResult[] = [];
  for (const url of urls) {
    try {
      const result = await detectTechnology(url);
      if (!result) {
        console.log(`No result for URL: ${url}`);
        continue;
      }
      allResults.push(result);
    } catch (error) {
      console.log(`Error processing URL:${url}`, error);
      throw error;
    }
  }

  // Write all results as a JSON array
  fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2), "utf-8");
  console.log(`All results saved to ${outputFile}`);
})();
