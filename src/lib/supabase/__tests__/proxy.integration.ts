/**
 * Supabase Proxy Integration Test
 * 
 * Instructions:
 * 1. Open your AlgoMind app in the browser.
 * 2. Open Developer Tools (F12 or Cmd+Option+I -> Console tab).
 * 3. Copy this entire script.
 * 4. Paste it into the console and press Enter.
 * 
 * This script will test both direct access (if available) and proxy access
 * to verify the proxy routing and auto-detection logic you just built.
 */

(async function runProxyTest() {
    console.log('🧪 Starting Supabase Proxy Integration Test...');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE';

    if (SUPABASE_URL.includes('your_') || ANON_KEY.includes('your_')) {
        console.error('❌ Please define SUPABASE_URL and ANON_KEY in the script or ensure env vars are set if running via bundler.');
        // For browser console paste, you might need to manually insert your URL and KEY above if process.env is undefined.
        // E.g., const SUPABASE_URL = 'https://xyz.supabase.co';
    }

    // --- 1. Force proxy mode off ---
    console.log('\n--- 1. Testing Direct Connection ---');
    sessionStorage.removeItem('use_supabase_proxy');
    sessionStorage.removeItem('supabase_probe_result');

    try {
        console.log(`Fetching direct health endpoint: ${SUPABASE_URL}/auth/v1/health`);
        const directStart = performance.now();
        const directRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
            method: 'GET'
        });
        const directTime = (performance.now() - directStart).toFixed(2);

        if (directRes.ok || directRes.status === 401) {
            console.log(`✅ Direct connection SUCCESS (${directTime}ms). Status: ${directRes.status}`);
        } else {
            console.log(`⚠️ Direct connection returned unexpected status: ${directRes.status}`);
        }
    } catch (err: any) {
        console.log('🔴 Direct connection FAILED (Simulation of Indian ISP block or Network Error):', err.message);
    }

    // --- 2. Force proxy mode on ---
    console.log('\n--- 2. Testing Proxy Connection ---');
    sessionStorage.setItem('use_supabase_proxy', 'true');
    const proxyUrl = window.location.origin + '/supabase-proxy';

    try {
        console.log(`Fetching proxy health endpoint: ${proxyUrl}/auth/v1/health`);
        const proxyStart = performance.now();
        const proxyRes = await fetch(`${proxyUrl}/auth/v1/health`, {
            method: 'GET'
        });
        const proxyTime = (performance.now() - proxyStart).toFixed(2);

        if (proxyRes.ok || proxyRes.status === 401) {
            console.log(`✅ Proxy connection SUCCESS (${proxyTime}ms). Status: ${proxyRes.status}`);
        } else {
            console.log(`❌ Proxy connection returned unexpected status: ${proxyRes.status}`);
            throw new Error('Proxy health check failed');
        }
    } catch (err: any) {
        console.error('❌ PROXY FAILED on health check:', err.message);
        return; // Abort if proxy is fundamentally broken
    }

    // --- 3. Test Real Proxy Query ---
    console.log('\n--- 3. Testing Real Proxy Auth Query ---');
    try {
        // We use a basic auth endpoint instead of profiles to ensure we don't need RLS bypassed just to test connectivity
        // Getting fake user or settings is a good test of query capability
        console.log(`Executing query against: ${proxyUrl}/auth/v1/settings`);

        const queryStart = performance.now();
        const queryRes = await fetch(`${proxyUrl}/auth/v1/settings`, {
            method: 'GET',
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`
            }
        });
        const queryTime = (performance.now() - queryStart).toFixed(2);

        if (queryRes.ok) {
            const data = await queryRes.json();
            console.log(`✅ Proxy query SUCCESS (${queryTime}ms). Received:`, typeof data === 'object' ? 'Valid JSON Object' : 'Unknown Data');
            console.log('\n🎉 PROXY WORKS END-TO-END 🎉');
        } else {
            console.log(`❌ Proxy query returned unexpected status: ${queryRes.status}`);
            const text = await queryRes.text();
            console.log('Response body:', text);
            console.log('\n💥 PROXY FAILED during real query 💥');
        }
    } catch (err: any) {
        console.error('\n💥 PROXY FAILED during real query 💥:', err.message);
    }

    console.log('\nNote: To restore your session state, the app will auto-detect on next reload, or run: sessionStorage.removeItem("use_supabase_proxy");');

})();
