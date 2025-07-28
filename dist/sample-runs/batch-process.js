"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const webanalyzer_1 = require("../lib/webanalyzer");
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
function processBatch(urls_1) {
    return __awaiter(this, arguments, void 0, function* (urls, config = {}, options = {}) {
        const { concurrent = 2, outputFile, progressCallback } = options;
        const results = [];
        console.log(`Starting batch processing of ${urls.length} URLs`);
        for (let i = 0; i < urls.length; i += concurrent) {
            const batch = urls.slice(i, i + concurrent);
            const batchPromises = batch.map((url) => __awaiter(this, void 0, void 0, function* () {
                // Ensure config (DetectionConfig) is provided
                if (!config ||
                    typeof config !== "object" ||
                    config.mode === undefined ||
                    config.mode === null) {
                    throw new Error(`A complete DetectionConfig with a defined 'mode' property must be provided to WebAnalyzer.analyze.`);
                }
                webanalyzer_1.WebAnalyzer.init(["src/data/tech.json"], config);
                const result = yield webanalyzer_1.WebAnalyzer.analyze(url);
                progressCallback === null || progressCallback === void 0 ? void 0 : progressCallback(i + batch.indexOf(url) + 1, urls.length, url);
                return { url, result };
            }));
            const batchResults = yield Promise.allSettled(batchPromises);
            batchResults.forEach((result, index) => {
                if (result.status === "fulfilled" && result.value.result) {
                    results.push(result.value.result);
                }
                else {
                    console.error(`Failed to process ${batch[index]}:`, result.status === "rejected" ? result.reason : "No result");
                }
            });
        }
        const summary = generateSummaryReport(results);
        console.log(`Batch processing complete!\n${summary}`);
        if (outputFile) {
            fs_1.default.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");
            console.log(`Results saved to ${outputFile}`);
        }
        return results;
    });
}
function generateSummaryReport(results) {
    const totalUrls = results.length;
    const successfulUrls = results.length;
    const blockedUrls = results.filter((r) => { var _a; return (_a = r.blockingIndicators) === null || _a === void 0 ? void 0 : _a.likelyBlocked; }).length;
    const avgTechnologies = results.reduce((sum, r) => { var _a, _b; return sum + ((_b = (_a = r.stats) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0); }, 0) /
        (successfulUrls || 1);
    const avgConfidence = results.reduce((sum, r) => { var _a, _b; return sum + ((_b = (_a = r.stats) === null || _a === void 0 ? void 0 : _a.averageConfidence) !== null && _b !== void 0 ? _b : 0); }, 0) /
        (successfulUrls || 1);
    const techCounts = {};
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
        Successful: ${successfulUrls} (${totalUrls > 0 ? ((successfulUrls / totalUrls) * 100).toFixed(1) : "0.0"}%)
        Blocked/Failed: ${totalUrls - successfulUrls} (${totalUrls > 0
        ? (((totalUrls - successfulUrls) / totalUrls) * 100).toFixed(1)
        : "0.0"}%)
        Likely Blocked: ${blockedUrls} (${successfulUrls > 0
        ? ((blockedUrls / successfulUrls) * 100).toFixed(1)
        : "0.0"}%)

        Average Technologies per Site: ${isFinite(avgTechnologies) ? avgTechnologies.toFixed(1) : "0.0"}
        Average Confidence: ${isFinite(avgConfidence) ? avgConfidence.toFixed(1) : "0.0"}%

        Det Technologies:
        ${topTechs.join("\n")}
`;
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    const outputFile = "src/sample-runs/results/results.json";
    const config = {
        mode: "NORMAL",
        includeRawData: false,
        blockingDetectionEnabled: true,
        fetchTimeout: 3000,
    };
    try {
        const results = yield processBatch(urls, config, {
            concurrent: 2,
            outputFile,
            progressCallback: (processed, total, url) => {
                console.log(`Progress: ${processed}/${total} - ${url}`);
            },
        });
        console.log(`All ${results.length} URLs processed successfully!`);
        const blockedSites = results.filter((r) => { var _a; return (_a = r.blockingIndicators) === null || _a === void 0 ? void 0 : _a.likelyBlocked; });
        if (blockedSites.length > 0) {
            fs_1.default.writeFileSync("src/sample-runs/results/blocked-sites.json", JSON.stringify(blockedSites, null, 2), "utf-8");
            console.log(`${blockedSites.length} blocked sites saved to blocked-sites.json`);
        }
        const notBlockedSites = results.filter((r) => { var _a; return !((_a = r.blockingIndicators) === null || _a === void 0 ? void 0 : _a.likelyBlocked); });
        if (notBlockedSites.length > 0) {
            fs_1.default.writeFileSync("src/sample-runs/results/not-blocked-sites.json", JSON.stringify(notBlockedSites, null, 2), "utf-8");
            console.log(`${notBlockedSites.length} not-blocked sites saved to not-blocked-sites.json`);
        }
        const highConfidenceDetections = results.filter((r) => r.stats.averageConfidence > 80 && r.stats.total > 5);
        if (highConfidenceDetections.length > 0) {
            fs_1.default.writeFileSync("src/sample-runs/results/high-confidence-detections.json", JSON.stringify(highConfidenceDetections, null, 2), "utf-8");
            console.log(`${highConfidenceDetections.length} high-confidence results saved to high-confidence-detections.json`);
        }
    }
    catch (error) {
        console.error("Fatal error during batch processing:", error);
        process.exit(1);
    }
}))();
