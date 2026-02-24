import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '10s', target: 0 },
    ],
};

const CAMPAIGN_TOKEN = __ENV.CAMPAIGN_TOKEN;
const BASE_URL = __ENV.BASE_URL;

let sessionTokens = {};

export default function () {
    const vu = __VU;

    if (!sessionTokens[vu]) {

        const startRes = http.post(`${BASE_URL}/api/assess/start`, JSON.stringify({
            campaignToken: CAMPAIGN_TOKEN,
            candidateName: `Test Candidate ${vu}`,
            candidateEmail: `test${vu}@loadtest.com`,
        }), {
            headers: { 'Content-Type': 'application/json' },
            timeout: '15s',
        });

        check(startRes, {
            'Assessment started': (r) => r.status === 200,
            'Got session token': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    if (body.sessionToken) {
                        sessionTokens[vu] = body.sessionToken;
                        return true;
                    }
                } catch {}
                return false;
            },
        });

        sleep(1);
        return;
    }

    const chatRes = http.post(`${BASE_URL}/api/assess/chat`, JSON.stringify({
        sessionToken: sessionTokens[vu],
        message: 'I would use a hash map to store the frequencies.',
    }), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '30s',
    });

    check(chatRes, {
        'Chat response 200': (r) => r.status === 200,
        'Not rate limited': (r) => r.status !== 429,
        'Response time < 10s': (r) => r.timings.duration < 10000,
    });

    sleep(Math.random() * 10 + 5);
}