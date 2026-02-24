import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 200 },
        { duration: '1m', target: 400 },
        { duration: '30s', target: 0 },
    ],
};

const BASE_URL = __ENV.BASE_URL;

export default function () {

    const res = http.get(`${BASE_URL}/api/health`, {
        timeout: '10s',
    });

    check(res, {
        'health check succeeds': (r) => r.status === 200,
        'DB is connected': (r) => {
            try {
                return JSON.parse(r.body).database === 'connected';
            } catch {
                return false;
            }
        },
    });

    sleep(0.5);
}