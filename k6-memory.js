import http from 'k6/http';
import { sleep, check } from 'k6';

const BASE_URL = __ENV.BASE_URL;
const SESSION = __ENV.SESSION_COOKIE;

export default function () {

    const res = http.post(`${BASE_URL}/api/chat`, JSON.stringify({
        messages: [{ role: 'user', content: 'ping' }],
        systemPrompt: 'Memory test.'
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': SESSION,
        },
        timeout: '10s',
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    sleep(0.1);
}