const fs = require('fs');
const path = require('path');

const swPath = path.join(process.cwd(), 'public', 'sw.js');
try {
    let swContent = fs.readFileSync(swPath, 'utf8');

    const version = `algomind-${Date.now()}`;
    // Replace the existing cache name format
    swContent = swContent.replace(/const CACHE_NAME = 'algomind-[^']+';/, `const CACHE_NAME = '${version}';`);

    fs.writeFileSync(swPath, swContent);
    console.log(`✅ Updated Service Worker cache name to: ${version}`);
} catch (err) {
    console.error(`❌ Failed to update Service Worker version: ${err.message}`);
}
