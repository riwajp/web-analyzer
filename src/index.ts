import WebAnalyzer from "./webanalyzer";
import fs from "fs";
import { performance } from "perf_hooks";
import type { TechnologiesMap, EnhancedDetectionResult, DetectionConfig } from "./types";

const DEFAULT_CONFIG: DetectionConfig = {
  mode: 'NORMAL',
  maxExternalScripts: 10,
  scriptTimeout: 5000,
  enableFuzzyMatching: true,
  enableEncodedMatching: true,
  includeRawData: false,
  blockingDetectionEnabled: true
};

function ensureInitialized() {
  if (!WebAnalyzer.initialized) {
    WebAnalyzer.init(["src/data/tech.json"]);
  }
}

export async function detectTechnology(
  url: string, 
  config: Partial<DetectionConfig> = {}
): Promise<EnhancedDetectionResult> {
  ensureInitialized();
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Set detection mode
  WebAnalyzer.setDetectionMode(finalConfig.mode);
  
  console.log(`Detecting technologies for: ${url} (Mode: ${finalConfig.mode})`);

  const timings: Record<string, number> = {};

  try {
    // Fetch URL
    timings.fetchStart = performance.now();
    const url_data = await WebAnalyzer.fetchURL(url);
    timings.afterFetch = performance.now();

    // Parse source code
    const site_data = await WebAnalyzer.parseSourceCode(url_data.source_code, url);
    timings.afterParse = performance.now();

    // Detect technologies with enhanced confidence scoring
    const detected_technologies = WebAnalyzer.detectPatterns(site_data, url_data);
    timings.afterDetect = performance.now();

    // Analyze blocking indicators
    const blocking_indicators = finalConfig.blockingDetectionEnabled 
      ? WebAnalyzer.analyzeBlocking(site_data, url_data)
      : {
          likely_blocked: false,
          blocking_score: 0,
          indicators: {
            status_code_suspicious: false,
            minimal_content: false,
            challenge_detected: false,
            captcha_detected: false,
            access_denied_text: false,
            suspicious_redirects: false,
            bot_detection_js: false,
            minimal_dom_elements: false,
            unusual_response_time: false
          },
          suspicious_phrases: [],
          challenge_type: undefined
        };

    // Analyze page metrics
    const page_analysis = WebAnalyzer.analyzePageMetrics(site_data, url_data, {
      fetch: timings.afterFetch - timings.fetchStart,
      parse: timings.afterParse - timings.afterFetch,
      total: timings.afterDetect - timings.fetchStart
    });

    // Get detection statistics
    const stats = WebAnalyzer.getDetectionStats(detected_technologies);

    timings.afterAnalysis = performance.now();

    // Prepare raw data if requested
    const raw_data = finalConfig.includeRawData ? {
      headers: Object.fromEntries(url_data.headers.entries()),
      cookies: url_data.cookies ? [url_data.cookies] : [],
      suspicious_elements: site_data.suspicious_elements,
      meta_tags: site_data.meta
    } : undefined;

    const result: EnhancedDetectionResult = {
      url,
      final_url: url_data.final_url,
      status_code: url_data.status_code,
      technologies: detected_technologies,
      blocking_indicators,
      page_analysis,
      stats,
      timings: {
        fetch: +(timings.afterFetch - timings.fetchStart).toFixed(2),
        parse: +(timings.afterParse - timings.afterFetch).toFixed(2),
        detect: +(timings.afterDetect - timings.afterParse).toFixed(2),
        total: +(timings.afterAnalysis - timings.fetchStart).toFixed(2),
      },
      raw_data
    };

    console.log(`Analysis complete for ${url}`);
    console.log(`Technologies found: ${stats.total} (Avg confidence: ${stats.averageConfidence}%)`);
    console.log(`Blocking score: ${blocking_indicators.blocking_score}/100`);
    console.log(`Page size: ${page_analysis.page_size_human}, DOM complexity: ${page_analysis.dom_complexity}`);

    return result;
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    
    // Return a minimal result structure for failed requests
    return {
      url,
      final_url: url,
      status_code: 0,
      technologies: [],
      blocking_indicators: {
        likely_blocked: false,
        blocking_score: 0,
        indicators: {
          status_code_suspicious: false,
          minimal_content: false,
          challenge_detected: false,
          captcha_detected: false,
          access_denied_text: false,
          suspicious_redirects: false,
          bot_detection_js: false,
          minimal_dom_elements: false,
          unusual_response_time: false
        },
        suspicious_phrases: [],
        challenge_type: undefined
      },
      page_analysis: {
        page_size_bytes: 0,
        page_size_human: '0 Bytes',
        dom_element_count: 0,
        dom_complexity: 'LOW',
        content_type: 'unknown',
        title: '',
        description: '',
        language: 'unknown',
        viewport: 'not set',
        charset: 'unknown',
        has_forms: false,
        has_javascript: false,
        external_resources: 0,
        internal_resources: 0,
        performance_metrics: {
          fetch_time: 0,
          parse_time: 0,
          total_time: 0
        }
      },
      stats: {
        total: 0,
        byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        averageConfidence: 0,
        topDetection: null
      },
      timings: { fetch: 0, parse: 0, detect: 0, total: 0 }
    };
  }
}

// Enhanced batch processing with better error handling and reporting
export async function processBatch(
  urls: string[], 
  config: Partial<DetectionConfig> = {},
  options: {
    concurrent?: number;
    outputFile?: string;
    progressCallback?: (processed: number, total: number, url: string) => void;
  } = {}
): Promise<EnhancedDetectionResult[]> {
  const { concurrent = 3, outputFile, progressCallback } = options;
  const results: EnhancedDetectionResult[] = [];
  
  console.log(`Starting batch processing of ${urls.length} URLs`);
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}`);
  
  // Process URLs in batches to avoid overwhelming the system
  for (let i = 0; i < urls.length; i += concurrent) {
    const batch = urls.slice(i, i + concurrent);
    const batchPromises = batch.map(async (url) => {
      const result = await detectTechnology(url, config);
      progressCallback?.(i + batch.indexOf(url) + 1, urls.length, url);
      return result;
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Failed to process ${batch[index]}:`, result.reason);
        // Add a failed result
        results.push({
          url: batch[index],
          final_url: batch[index],
          status_code: 0,
          technologies: [],
          blocking_indicators: {
            likely_blocked: false,
            blocking_score: 0,
            indicators: {
              status_code_suspicious: false,
              minimal_content: false,
              challenge_detected: false,
              captcha_detected: false,
              access_denied_text: false,
              suspicious_redirects: false,
              bot_detection_js: false,
              minimal_dom_elements: false,
              unusual_response_time: false
            },
            suspicious_phrases: [],
            challenge_type: undefined
          },
          page_analysis: {
            dom_element_count: 0,
            page_size_bytes: 0,
            page_size_human: '0 Bytes',
            dom_complexity: 'LOW',
            content_type: 'unknown',
            title: '',
            description: '',
            language: 'unknown',
            viewport: 'not set',
            charset: 'unknown',
            has_forms: false,
            has_javascript: false,
            external_resources: 0,
            internal_resources: 0,
            performance_metrics: {
              fetch_time: 0,
              parse_time: 0,
              total_time: 0
            }
          },
          stats: {
            total: 0,
            byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
            averageConfidence: 0,
            topDetection: null
          },
          timings: { fetch: 0, parse: 0, detect: 0, total: 0 }
        });
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

function generateSummaryReport(results: EnhancedDetectionResult[]): string {
  const totalUrls = results.length;
  const successfulUrls = results.filter(r => r.status_code > 0).length;
  const blockedUrls = results.filter(r => r.blocking_indicators.likely_blocked).length;
  const avgTechnologies = results.reduce((sum, r) => sum + r.stats.total, 0) / totalUrls;
  const avgConfidence = results.reduce((sum, r) => sum + r.stats.averageConfidence, 0) / totalUrls;
  
  // Most common technologies
  const techCounts: Record<string, number> = {};
  results.forEach(r => {
    r.technologies.forEach(tech => {
      techCounts[tech.name] = (techCounts[tech.name] || 0) + 1;
    });
  });
  
  const topTechs = Object.entries(techCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tech, count]) => `${tech}: ${count}`);

  return `
SUMMARY
==========================
Total URLs: ${totalUrls}
Successful: ${successfulUrls} (${(successfulUrls/totalUrls*100).toFixed(1)}%)
Blocked/Failed: ${totalUrls - successfulUrls} (${((totalUrls-successfulUrls)/totalUrls*100).toFixed(1)}%)
Likely Blocked: ${blockedUrls} (${(blockedUrls/totalUrls*100).toFixed(1)}%)

Average Technologies per Site: ${avgTechnologies.toFixed(1)}
Average Confidence: ${avgConfidence.toFixed(1)}%

Top 10 Technologies:
${topTechs.join('\n')}
`;
}

// URL list for batch processing
const urls = [
  "https://www.cvs.com/",
  // "https://www.footlocker.com/",
  // "https://www.tripadvisor.com/",
  // "https://www.cdiscount.com/",
  // "https://www.salesforce.com/",
  // "https://www.intuit.com/",
  // "https://www.advanceautoparts.com/",
  // "https://www.affitto.it/",
  // "https://www.agoda.cn/",
  // "https://www.albertsons.com/",
  // "https://www.allpeople.com/",
  // "https://www.autozone.com/",
  // "https://www.bestbuy.com/",
  // "https://www.bestwestern.com/",
  // "https://www.billiger.de/",
  // "https://www.bottlerover.com/",
  // "https://www.carousell.com/",
  // "https://www.carousell.com.hk/",
  // "https://www.carousell.com.my/",
  // "https://www.carousell.ph/",
  // "https://www.carousell.sg/",
  // "https://www.carsales.com.au/",
  // "https://www.chewy.com/",
  // "https://www.costco.com/",
  // "https://www.cvs.com/",
  // "https://www.despegar.com.mx/",
  // "https://www.dickssportinggoods.com/",
  // "https://www.dynos.es/",
  // "https://www.emaxme.com/",
  // "https://www.familytreenow.com/",
  // "https://www.feuvert.fr/",
  // "https://www.flooranddecor.com/",
  // "https://www.foodlion.com/",
  // "https://www.footlocker.co.uk/",
  // "https://www.giantfoodstores.com/",
  // "https://www.gopuff.com/",
  // "https://www.gplay.bg/",
  // "https://www.hermes.com/",
  // "https://www.hyatt.com/",
  // "https://www.idealo.de/",
  // "https://www.immobilienscout24.de/",
  // "https://www.ingatlan.com/",
  // "https://www.instacart.com/",
  // "https://www.intersport.fr/",
  // "https://www.joann.com/",
  // "https://www.kroger.com/",
  // "https://www.lazada.co.id/",
  // "https://www.lazada.co.th/",
  // "https://www.lazada.com.my/",
  // "https://www.lazada.com.ph/",
  // "https://www.lazada.sg/",
  // "https://www.lazada.vn/",
  // "https://www.lowes.ca/",
  // "https://www.lowes.com/",
  // "https://www.mcmaster.com/",
  // "https://www.mediamarkt.de/",
  // "https://www.mediamarkt.es/",
  // "https://www.medline.com/",
  // "https://www.mscdirect.com/",
  // "https://www.napaonline.com/",
  // "https://www.nofrills.ca/",
  // "https://www.peoplefinders.com/",
  // "https://www.platt.com/",
  // "https://www.publicdatausa.com/",
  // "https://www.realcanadiansuperstore.ca/",
  // "https://www.realestate.com.au/",
  // "https://www.restaurantguru.com/",
  // "https://www.searchpeoplefree.com/",
  // "https://www.shopee.cl/",
  // "https://www.shopee.co.id/",
  // "https://www.shopee.co.th/",
  // "https://www.shopee.com.br/",
  // "https://www.shopee.com.co/",
  // "https://www.shopee.com.mx/",
  // "https://www.shopee.com.my/",
  // "https://www.shopee.ph/",
  // "https://www.shopee.sg/",
  // "https://www.shopee.tw/",
  // "https://www.shopee.vn/",
  // "https://www.similarweb.com/",
  // "https://www.skyscanner.co.kr/",
  // "https://www.skyscanner.net/",
  // "https://www.stopandshop.com/",
  // "https://www.target.com/",
  // "https://www.temu.com/",
  // "https://www.ticketmaster.com/",
  // "https://www.totalwine.com/",
  // "https://www.tractorsupply.com/",
  // "https://www.walmart.com.mx/",
  // "https://www.wayfair.com/",
  // "https://www.weismarkets.com/",
  // "https://www.wizzair.com/",
  // "https://www.worten.pt/"
];

// Main execution
(async () => {
  const outputFile = "-analysis.json";
  
  // Configuration for the analysis
  const config: Partial<DetectionConfig> = {
    mode: 'NORMAL',
    includeRawData: false,
    blockingDetectionEnabled: true,
    maxExternalScripts: 5,
    scriptTimeout: 3000
  };
  
  try {
    const results = await processBatch(urls, config, {
      concurrent: 2, // Reduced concurrency to be more respectful
      outputFile,
      progressCallback: (processed, total, url) => {
        console.log(`Progress: ${processed}/${total} - ${url}`);
      }
    });
    
    console.log(`All ${results.length} URLs processed successfully!`);
    
    // Generate additional analysis files
    const blockedSites = results.filter(r => r.blocking_indicators.likely_blocked);
    if (blockedSites.length > 0) {
      fs.writeFileSync(
        "blocked-sites-analysis.json", 
        JSON.stringify(blockedSites, null, 2), 
        "utf-8"
      );
      console.log(` ${blockedSites.length} blocked sites saved to blocked-sites-analysis.json`);
    }
    
    // Save high-confidence detections
    const highConfidenceDetections = results.filter(r => 
      r.stats.averageConfidence > 80 && r.stats.total > 5
    );
    if (highConfidenceDetections.length > 0) {
      fs.writeFileSync(
        "high-confidence-detections.json", 
        JSON.stringify(highConfidenceDetections, null, 2), 
        "utf-8"
      );
      console.log(` ${highConfidenceDetections.length} high-confidence results saved to high-confidence-detections.json`);
    }
    
  } catch (error) {
    console.error("Fatal error during batch processing:", error);
    process.exit(1);
  }
})();