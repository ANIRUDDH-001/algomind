import http from 'k6/http';
import { check } from 'k6';

export const options = {
    scenarios: {
        spike: {
            executor: 'constant-vus',
            vus: 200,
            duration: '30s',
        },
    },
};

const BASE_URL = __ENV.BASE_URL;
const SESSION = __ENV.SESSION_COOKIE;

export default function () {

    const res = http.post(`${BASE_URL}/api/chat`, JSON.stringify({
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'You are a test.'
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': SESSION,
        },
        timeout: '10s',
    });

    check(res, {
        'Got 200 or 429 (not 500)': (r) => r.status === 200 || r.status === 429,
        'Not 500 error': (r) => r.status !== 500,
    });
}