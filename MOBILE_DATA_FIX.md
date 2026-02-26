# Solution: Bypassing Mobile Data Blocks for Supabase

Since your mobile carrier is blocking the `*.supabase.co` domain, the most reliable **free** solution is to set up a reverse proxy using **Cloudflare Workers**. This routes your database requests through Cloudflare's infrastructure, which is rarely blocked.

## 1. Setup Cloudflare Worker (Free Tier)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
2. Click **Create Application** > **Create Worker**.
3. Name it something like `algomind-db-proxy`.
4. Replace the worker code with the following:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Replace with your actual Supabase URL (e.g., wfdgsmhuglmrxcmwcylz.supabase.co)
    const SUPABASE_URL = "wfdgsmhuglmrxcmwcylz.supabase.co"; 
    
    // Change the hostname to Supabase
    url.hostname = SUPABASE_URL;

    // Create a new request based on the original but with the new URL
    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Fetch from Supabase and return the response
    return fetch(newRequest);
  },
};
```

5. Click **Deploy**.
6. You will get a URL like `https://algomind-db-proxy.your-subdomain.workers.dev`.

## 2. Update your Algomind App

Change your `NEXT_PUBLIC_SUPABASE_URL` in your Vercel/environment variables to your new Worker URL:

```bash
# Before:
# NEXT_PUBLIC_SUPABASE_URL=https://wfdgsmhuglmrxcmwcylz.supabase.co

# After:
NEXT_PUBLIC_SUPABASE_URL=https://algomind-db-proxy.your-subdomain.workers.dev
```

## Why this works:
1. **Domain Obfuscation**: Your mobile carrier sees traffic going to `cloudflare.com` or `workers.dev`, which they don't block.
2. **Cloudflare Free Tier**: Includes 100,000 requests per day for free, which is more than enough for current usage.
3. **No Latency Impact**: Cloudflare's edge network is extremely fast, especially in India.

> [!TIP]
> This is a much better solution than using a VPN, as it only affects your app's traffic and is entirely transparent to the user.
