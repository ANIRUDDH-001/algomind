import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "15s", target: 10 },
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
    ],
};

const CF_URL = __ENV.CF_URL || "https://algomind-supabase.aniruddhvijay2k7.workers.dev";

export default function () {
    const res = http.get(`${CF_URL}/cf-health`);
    check(res, {
        "cf worker reachable": (r) => r.status === 200,
        "under 300ms": (r) => r.timings.duration < 300,
    });
    sleep(0.5);
}
