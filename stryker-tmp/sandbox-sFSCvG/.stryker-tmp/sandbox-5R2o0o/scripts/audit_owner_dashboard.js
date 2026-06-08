// @ts-nocheck
// 
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const routes = [
    '/owner',
    '/owner/overview',
    '/owner/users',
    '/owner/models',
    '/owner/aws',
    '/owner/rate-limits',
    '/owner/settings',
    '/owner/knowledge',
    '/owner/analytics',
    '/owner/co-owners',
    '/owner/ai-status',
    '/owner/algomind-2o'
];

async function run() {
    const browser = await chromium.launch({ headless: true });
    let contextOptions = { baseURL: 'http://localhost:3000' };
    const authPath = path.resolve(__dirname, '../.playwright/auth.json');
    if (fs.existsSync(authPath)) {
        contextOptions.storageState = authPath;
    } else {
        console.log("No auth.json found at", authPath);
    }
    
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const results = {};

    for (const route of routes) {
        console.log(`Auditing ${route}...`);
        results[route] = { errors: [], overlappingElements: [], missingContent: [] };
        
        // Remove old listeners to avoid duplicates
        page.removeAllListeners('console');
        page.removeAllListeners('pageerror');

        page.on('console', msg => {
            if (msg.type() === 'error') {
                results[route].errors.push(`Console error: ${msg.text()}`);
            }
        });
        
        page.on('pageerror', error => {
            results[route].errors.push(`Page error: ${error.message}`);
        });

        await page.goto(route, { waitUntil: 'networkidle' }).catch(e => {
            results[route].errors.push(`Navigation failed: ${e.message}`);
        });
        
        // Let it settle
        await page.waitForTimeout(2000);
        
        // Take screenshot
        const safeName = route.replace(/\//g, '_') || 'root';
        await page.screenshot({ path: path.join(__dirname, `../playwright-report/owner_audit${safeName}.png`) });

        const html = await page.content();
        if (html.includes('404') && html.includes('Not Found')) {
            results[route].errors.push('404 Not Found');
        }
        
        // Check overlaps
        const overlaps = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const overlapsFound = [];
            const isVisible = (elem) => {
                const style = window.getComputedStyle(elem);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && elem.offsetWidth > 0 && elem.offsetHeight > 0;
            };
            
            const containers = Array.from(document.querySelectorAll('div, section, main, header, nav, button, p, h1, h2, h3'));
            for (let i = 0; i < containers.length; i++) {
                for (let j = i + 1; j < containers.length; j++) {
                    const a = containers[i];
                    const b = containers[j];
                    if (!isVisible(a) || !isVisible(b)) continue;
                    
                    if (a.contains(b) || b.contains(a)) continue;
                    
                    const rectA = a.getBoundingClientRect();
                    const rectB = b.getBoundingClientRect();
                    
                    if (rectA.width > window.innerWidth * 0.9 || rectB.width > window.innerWidth * 0.9) continue;
                    if (rectA.height > window.innerHeight * 0.9 || rectB.height > window.innerHeight * 0.9) continue;
                    
                    const intersectX = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
                    const intersectY = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
                    
                    if (intersectX > 0 && intersectY > 0) {
                        const areaA = rectA.width * rectA.height;
                        const areaB = rectB.width * rectB.height;
                        const intersectArea = intersectX * intersectY;
                        
                        if (intersectArea > 0.1 * Math.min(areaA, areaB) && intersectArea > 200) {
                            overlapsFound.push({
                                elem1: a.className || a.tagName,
                                elem2: b.className || b.tagName,
                                text1: (a.innerText || '').substring(0, 30).replace(/\n/g, ' '),
                                text2: (b.innerText || '').substring(0, 30).replace(/\n/g, ' ')
                            });
                            if (overlapsFound.length > 5) return overlapsFound;
                        }
                    }
                }
            }
            return overlapsFound;
        });

        results[route].overlappingElements = overlaps;
        
        const reactError = await page.evaluate(() => {
            return document.body.innerText.includes('Minified React error') || document.body.innerText.includes('Application error:');
        });
        if (reactError) {
            results[route].errors.push('React Error overlay detected');
        }
        
        const layoutDetails = await page.evaluate(() => {
            const sidebar = document.querySelector('nav') || document.querySelector('[class*="sidebar"]');
            const main = document.querySelector('main');
            if (sidebar && main) {
                const sRect = sidebar.getBoundingClientRect();
                const mRect = main.getBoundingClientRect();
                return { sidebarRight: sRect.right, mainLeft: mRect.left, overlap: sRect.right > mRect.left + 5 };
            }
            return null;
        });
        
        if (layoutDetails && layoutDetails.overlap) {
            results[route].overlappingElements.push(`Sidebar overlaps main content! Sidebar right: ${layoutDetails.sidebarRight}, Main left: ${layoutDetails.mainLeft}`);
        }
    }

    fs.writeFileSync(path.join(__dirname, 'audit_results.json'), JSON.stringify(results, null, 2));
    await browser.close();
    console.log('Audit complete.');
}

run().catch(console.error);
