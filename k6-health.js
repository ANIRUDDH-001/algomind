import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const latency = new Trend("latency");

export const options = {
    stages: [
        { duration: "15s", target: 5 },
        { duration: "30s", target: 20 },
        { duration: "30s", target: 50 },
        { duration: "30s", target: 100 },
        { duration: "15s", target: 0 },
    ],
    thresholds: {
        "http_req_duration": ["p(95)<500"],
        "errors": ["rate<0.01"],
    },
};

const BASE_URL = __ENV.BASE_URL || "https://algomind-drab.vercel.app";

export default function () {
    const res = http.get(`${BASE_URL}/api/health`);
    const ok = check(res, {
        "status 200": (r) => r.status === 200,
        "under 500ms": (r) => r.timings.duration < 500,
    });
    errorRate.add(!ok);
    latency.add(res.timings.duration);
    sleep(1);
}
