# AlgoMind

AlgoMind is a technical interview practice app for software engineering candidates. It runs coding interviews over text or voice, saves interview sessions, and turns assessments into topics to revisit.

## What you can do

- Practice in a guided interview with a problem statement, a code editor, and conversational follow-ups.
- Speak answers when voice is enabled. The browser detects speech turns, and the app can use Groq Whisper for transcription and Amazon Polly for spoken responses.
- Review completed sessions, assessment feedback, and concept recommendations. Review scheduling uses FSRS.
- Run code against a configured Piston service. The application sends execution requests through its server API.

## Architecture

| Component | Responsibility |
| --- | --- |
| Next.js and React | Interview UI, dashboards, and API routes |
| Supabase | Authentication, sessions, assessments, and learning data |
| Gemini and Groq | Interview responses and assessment model routing |
| Inngest | Background assessment and related jobs |
| Upstash Redis | Optional rate limiting and caching |
| Piston | Code execution when configured |

See the [system overview](docs/01-system-architecture.md), [database reference](docs/02-database-schema.md), [API reference](docs/03-api-reference.md), [voice UI notes](docs/04-frontend-ui-ux.md), and [authentication design](docs/05-security-and-auth.md). Runtime behavior is defined by the current code and configuration.

## Local setup

Use Node.js 20 or newer. Set up a development Supabase project with the schema and functions described in the database reference. This checkout includes Supabase function sources but has no complete migration set for provisioning an empty database.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local` for the copy step. Open [localhost:3000](http://localhost:3000), sign in to the development project, and start an interview. For background jobs, start the Inngest development server in another terminal with `npx inngest-cli dev` and connect it to `/api/inngest`.

| Configuration | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Development project and its client key |
| `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_SECRET`, `ASSESSMENT_JWT_SECRET` | Server-only database access and request signing |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | Model access and transcription where configured |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Feature-gated Polly and related AWS integrations |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional rate limiting and cache |
| `PISTON_URL` | Full execution endpoint of a configured Piston service |

See [the environment template](.env.example) for feature-specific settings. Keep database service keys, signing secrets, and provider credentials on the server.

## Development checks

```bash
npm test -- --maxWorkers=4
npm run lint
npm run type-check
npm run build
```

The default Playwright suite requires a configured test account. The [separate voice suite](playwright.voice.config.ts) mocks its backend calls and can be run with `npx playwright test --config playwright.voice.config.ts` after installing Chromium. Run it with a local app instance.

## Deployment and limitations

The [hosted app](https://algomind-drab.vercel.app/) uses the Vercel configuration in [vercel.json](vercel.json). Voice behavior depends on browser support, feature flags, and provider access. Code execution, background assessment, and schema checks require the corresponding services. Automated interview feedback is intended for practice.
