const fs = require('fs');
let c = fs.readFileSync('src/lib/ai/__tests__/response-cache.test.ts', 'utf8');
c = c.replace(/cache\.(get|set)\(/g, 'await cache.$1(');
c = c.replace(/test\('([^']+)', \(\) => \{/g, "test('$1', async () => {");
fs.writeFileSync('src/lib/ai/__tests__/response-cache.test.ts', c);
console.log("Test updated");
