import http from 'k6/http';
import { sleep, check } from 'k6';

// Ramp from 1 → 150 concurrent interview users
export const options = {
    stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '1m', target: 0 },
    ],
};

const BASE_URL = __ENV.BASE_URL;
const SESSION = __ENV.SESSION_COOKIE;

export default function () {

    const payload = JSON.stringify({
        messages: [
            { role: 'user', content: 'Explain the time complexity of merge sort briefly.' }
        ],
        systemPrompt: 'You are an interview coach. Give short answers.'
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': SESSION,
        },
        timeout: '30s',
    };

    const res = http.post(`${BASE_URL}/api/chat`, payload, params);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'status is not 429': (r) => r.status !== 429,
        'response time < 5s': (r) => r.timings.duration < 5000,
        'has response field': (r) => {
            try {
                return JSON.parse(r.body).response !== undefined;
            } catch {
                return false;
            }
        },
    });

    sleep(Math.random() * 2 + 1);
}