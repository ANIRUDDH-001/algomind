import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "15s", target: 5 },
        { duration: "30s", target: 25 },
        { duration: "30s", target: 50 },
        { duration: "15s", target: 0 },
    ],
    thresholds: {
        "http_req_duration": ["p(95)<2000"],
        "http_req_failed": ["rate<0.05"],
    },
};

const CF_URL = __ENV.CF_URL || "https://algomind-supabase.aniruddhvijay2k7.workers.dev";
const ANON_KEY = __ENV.ANON_KEY;

export default function () {
    const res = http.get(`${CF_URL}/rest/v1/global_feature_flags?select=key,is_enabled`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
        },
    });
    check(res, {
        "db reachable": (r) => r.status === 200,
        "got data": (r) => r.body.length > 5,
    });
    sleep(1);
}
