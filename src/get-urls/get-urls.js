const fs = require('fs');
const path = require('path');

async function scrapeBuiltWithTable(url) {
    let browser;
    try {
        const puppeteer = require('puppeteer');
        const cheerio = require('cheerio');
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);
        const websiteTdTags = $('td.pl-0.text-primary');
        const websiteNames = [];
        if (websiteTdTags.length > 0) {
            websiteTdTags.each((index, element) => {
                const websiteName = $(element).text().trim();
                if (websiteName) {
                    websiteNames.push(websiteName);
                }
            });
        } else {
            console.log('No <td> tags with class "pl-0 text-primary" found. The page structure might have changed or content is not visible.');
            console.log('First few lines of HTML content to debug (truncated):');
            console.log(htmlContent.substring(0, 1000)); // Print first 1000 chars for debugging
        }
        // Write results to CSV file named after the URL
        if (websiteNames.length > 0) {
            const urlObj = new URL(url);
            let filename = urlObj.pathname.replace(/\/+/, '').replace(/\//g, '_');
            if (!filename) filename = 'output';
            const csvFile = path.join(__dirname, `${filename}.csv`);
            const csvContent = websiteNames.map(name => `"${name.replace(/"/g, '""')}"`).join('\n');
            fs.writeFileSync(csvFile, csvContent, 'utf8');
            console.log(`Results written to ${csvFile}`);
        }
        return websiteNames;
    } catch (error) {
        console.error('An error occurred:', error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function scrapeMetaTrailTable(url, entryName) {
    let browser;
    try {
        const puppeteer = require('puppeteer');
        const cheerio = require('cheerio');
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
        // Wait for 10 seconds before grabbing the HTML
        // await new Promise(resolve => setTimeout(resolve, 20000));
        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);
        // Select all <a> tags inside <div class="font-medium text-gray-900">
        const websiteLinks = $('div.font-medium.text-gray-900 a.text-metatrail-purple');
        const websiteUrls = [];
        if (websiteLinks.length > 0) {
            websiteLinks.each((index, element) => {
                const href = $(element).attr('href');
                if (href && href.startsWith('/search/')) {
                    // Extract domain from href
                    const domain = href.replace('/search/', '').trim();
                    if (domain) {
                        websiteUrls.push(domain);
                    }
                }
            });
        } else {
            console.log('No matching <a> tags found. The page structure might have changed or content is not visible.');
            console.log('First few lines of HTML content to debug (truncated):');
            console.log(htmlContent.substring(0, 1000));
        }
        // Write results to CSV file named websitelist_<entryName>.csv
        if (websiteUrls.length > 0) {
            const safeName = entryName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const csvFile = path.join(__dirname, `websitelist_${safeName}.csv`);
            const csvContent = websiteUrls.map(name => `"${name.replace(/"/g, '""')}"`).join('\n');
            fs.writeFileSync(csvFile, csvContent, 'utf8');
            console.log(`Results written to ${csvFile}`);
        }
        return websiteUrls;
    } catch (error) {
        console.error('An error occurred:', error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function main() {
    const entries = fs.readFileSync(path.join(__dirname, '16.txt'), 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    for (const entry of entries) {
        // const url1 = `https://trends.builtwith.com/websitelist/${entry}`;
        // await scrapeBuiltWithTable(url1);
        const url2 = `https://app.metatrail.io/technology/${entry}`;
        await scrapeMetaTrailTable(url2);
    }
}

main();