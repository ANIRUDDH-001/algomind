const fs = require('fs');

function formatMs(ms) {
    if (ms === undefined) return 'N/A';
    return ms.toFixed(1) + 'ms';
}

function parseFile(filename, name) {
    if (!fs.existsSync(filename)) {
        console.log(`\n### ${name}\nFailed to load results (${filename} not found).`);
        return;
    }
    const data = JSON.parse(fs.readFileSync(filename, 'utf-8'));
    const metrics = data.metrics;

    // HTTP Request Duration
    const reqDur = metrics.http_req_duration?.values || {};
    const avg = formatMs(reqDur.avg);
    const p90 = formatMs(reqDur['p(90)']);
    const p95 = formatMs(reqDur['p(95)']);
    const max = formatMs(reqDur.max);

    // Errors (might not exist if 0 errors occurred)
    const errors = metrics.errors || metrics.http_req_failed;
    let errorRate = '0.00%';
    let errorCount = 0;

    if (errors && errors.values) {
        if (errors.values.rate !== undefined) {
            errorRate = (errors.values.rate * 100).toFixed(2) + '%';
        }
        if (errors.values.passes !== undefined) {
            errorCount = errors.values.passes;
        }
    }

    // Throughput
    const reqs = metrics.http_reqs?.values?.count || 0;
    const reqRate = metrics.http_reqs?.values?.rate ? metrics.http_reqs.values.rate.toFixed(1) : 'N/A';

    console.log(`\n### ${name}`);
    console.log(`- **Total Requests:** ${reqs} (${reqRate} req/s)`);
    console.log(`- **Error Rate:** ${errorRate} (${errorCount} errors)`);
    console.log(`- **Latency Duration:**`);
    console.log(`  - Average: ${avg}`);
    console.log(`  - p(90): ${p90}`);
    console.log(`  - p(95): ${p95}`);
    console.log(`  - Max: ${max}`);
}

console.log('\n## Block 7: k6 Load Tests\n');
parseFile('health-summary.json', '7a. Health Endpoint (Next.js Edge)');
parseFile('cf-summary.json', '7b. CF Worker Throughput');

