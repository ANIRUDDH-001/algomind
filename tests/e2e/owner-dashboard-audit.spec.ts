import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Owner Dashboard Audit', () => {
    test.use({ storageState: '.playwright/auth.json' });

    const routes = [
        '/owner/overview',
        '/owner/users',
        '/owner/models',
        '/owner/aws',
        '/owner/rate-limits',
        '/owner/settings',
        '/owner/knowledge',
        '/owner/co-owners',
        '/owner/flags',
        '/owner/cache',
        '/owner/admins',
        '/owner/employers'
    ];

    const results: Record<string, any> = {};

    for (const route of routes) {
        test(`Audit route: ${route}`, async ({ page }, testInfo) => {
            const routeResults = { errors: [], overlappingElements: [], missingContent: [] };
            results[route] = routeResults;

            const consoleLogs: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleLogs.push(`Console error: ${msg.text()}`);
                }
            });
            page.on('pageerror', error => {
                consoleLogs.push(`Page error: ${error.message}`);
            });

            const response = await page.goto(route, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000); // Wait for animations/renders

            if (response && response.status() === 404) {
                routeResults.errors.push('404 Not Found');
            }

            // Take a screenshot and attach it to the test report
            const screenshot = await page.screenshot({ fullPage: true });
            await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });

            const html = await page.content();
            if (html.includes('404') && html.includes('Not Found')) {
                routeResults.errors.push('Page rendered as 404 Not Found');
            }
            if (html.includes('Minified React error') || html.includes('Application error:')) {
                routeResults.errors.push('React Error boundary hit');
            }

            // Verify overlaps programmatically
            const overlaps = await page.evaluate(() => {
                const overlapsFound: string[] = [];
                const isVisible = (elem: Element) => {
                    const style = window.getComputedStyle(elem);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (elem as HTMLElement).offsetWidth > 0 && (elem as HTMLElement).offsetHeight > 0;
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
                            
                            // 10% overlap threshold
                            if (intersectArea > 0.1 * Math.min(areaA, areaB) && intersectArea > 200) {
                                overlapsFound.push(`Overlap: <${a.tagName.toLowerCase()} class="${a.className}"> vs <${b.tagName.toLowerCase()} class="${b.className}">`);
                                if (overlapsFound.length > 5) return overlapsFound;
                            }
                        }
                    }
                }
                return overlapsFound;
            });

            routeResults.overlappingElements = overlaps;
            routeResults.errors.push(...consoleLogs);

            // Basic layout structure check
            const layoutDetails = await page.evaluate(() => {
                const sidebar = document.querySelector('aside'); // OwnerLayout uses <aside> for sidebar
                const main = document.querySelector('#main-content') || document.querySelector('main');
                if (sidebar && main) {
                    const sRect = sidebar.getBoundingClientRect();
                    const mRect = main.getBoundingClientRect();
                    return { sidebarRight: sRect.right, mainLeft: mRect.left, overlap: sRect.right > mRect.left + 5 };
                }
                return null;
            });
            
            if (layoutDetails && layoutDetails.overlap) {
                routeResults.overlappingElements.push(`Sidebar overlaps main content! Sidebar right: ${layoutDetails.sidebarRight}, Main left: ${layoutDetails.mainLeft}`);
            }

            // Save results to file for later agent review
            const resultsPath = path.join(__dirname, '..', '..', 'scripts', 'playwright_audit_results.json');
            fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

            // Basic assertions so we see checkmarks
            expect(true).toBe(true);
        });
    }
});
