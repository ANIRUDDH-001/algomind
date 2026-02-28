const baseUrl = 'https://algomind-drab.vercel.app';

async function testEP(ep, method = 'GET', body = null) {
    try {
        const opts = { method, headers: {} };
        if (body) {
            opts.body = typeof body === 'string' ? body : JSON.stringify(body);
            opts.headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(baseUrl + ep, { ...opts, signal: AbortSignal.timeout(15000) });
        return { status: res.status };
    } catch (err) {
        return { error: err.message };
    }
}

async function run() {
    console.log('\n=== TEST BLOCK 3: DB RPC & API HEALTH ===');
    for (const ep of ['/api/health', '/api/health/connectivity', '/api/health/ai', '/api/flags']) {
        const res = await testEP(ep);
        const okStr = res.error ? 'FAIL' : 'OK';
        const statusStr = res.status || res.error;
        console.log(`${okStr} ${ep} -> ${statusStr}`);
    }

    console.log('\n=== TEST BLOCK 4: API SMOKE TESTS ===');
    console.log('Endpoint | Status | Auth | Result');
    for (const ep of ['/', '/login', '/api/health', '/api/flags']) {
        const res = await testEP(ep);
        const result = res.status === 200 ? 'OK' : 'FAIL';
        const statusStr = res.status || res.error;
        console.log(`${ep} | ${statusStr} | none | ${result}`);
    }

    for (const ep of ['/api/chat', '/api/admin/health', '/api/owner/users', '/api/employer/campaigns', '/api/voice/synthesize']) {
        const res = await testEP(ep, 'POST', {});
        const st = res.status;
        const ok = [400, 401, 403, 405].includes(st) ? 'OK_PROTECTED' : ('UNEXPECTED_' + st);
        const statusStr = st || res.error;
        console.log(`${ep} | ${statusStr} | none | ${ok}`);
    }
}
run();
