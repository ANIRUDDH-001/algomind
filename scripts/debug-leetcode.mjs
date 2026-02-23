import fetch from 'node-fetch';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const username = 'ANIRUDDH-001'; // Example username

const LEETCODE_PROFILE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    profile { ranking }
    submitStats {
      acSubmissionNum { difficulty count }
    }
  }
  userContestRanking(username: $username) { rating }
  recentAcSubmissionList(username: $username, limit: 20) {
    title titleSlug timestamp statusDisplay lang
  }
}
`;

async function debugFetch() {
    console.log(`Attempting to fetch LeetCode profile for: ${username}`);
    try {
        const response = await fetch(LEETCODE_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://leetcode.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                query: LEETCODE_PROFILE_QUERY,
                variables: { username }
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`Response Body: ${text}`);

        if (response.ok || response.status === 400) {
            const json = JSON.parse(text);
            if (json.errors) {
                console.error('GraphQL Errors:', JSON.stringify(json.errors, null, 2));
            } else {
                console.log('Success! Data received.');
                console.log(JSON.stringify(json.data, null, 2).slice(0, 500));
            }
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

debugFetch();
