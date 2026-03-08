# AlgoMind Deployment Guide

## Pre-Deployment Checklist

- [ ] All environment variables set in Vercel dashboard
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] All 880 tests pass: `npm run test`
- [ ] ESLint clean: `npm run lint`
- [ ] All API keys valid (Gemini, Groq, Supabase, optionally AWS + Upstash)
- [ ] Demo mode loads sample data
- [ ] Error boundaries catch errors

## Environment Variables Required

Create a `.env.local` file locally, or set these in your deployment platform (Vercel/Netlify).

```bash
# ============================================
# AI API Keys (Required)
# ============================================
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# ============================================
# Supabase (Required for Database & Auth)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# ============================================
# Caching (Recommended)
# ============================================
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# ============================================
# AWS (Optional — for Polly TTS & Bedrock fallback)
# ============================================
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BEDROCK_REGION=us-east-1

# ============================================
# Application Settings
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Vercel Deployment

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option 2: Git Integration

1.  Push code to GitHub/GitLab.
2.  Connect repository to Vercel.
3.  **Critical:** Add all environment variables (especially Supabase keys) in the Vercel dashboard.
4.  Deploy automatically on push.

## Post-Deployment Verification

- [ ] Homepage loads at `your-domain.vercel.app`
- [ ] Onboarding animation plays for new visitors
- [ ] Settings page accessible at `/settings`
- [ ] Dashboard shows data
- [ ] Interview mode works with voice (requires HTTPS)
- [ ] PDF export downloads correctly
- [ ] API health check returns 200
- [ ] Run benchmark suite to verify sub-second latencies: `node scripts/benchmark-voice-pipeline.mjs`

## Demo Preparation (Hackathon)

### Enable Demo Mode
1.  Visit `/settings`.
2.  Click "Enable Demo Mode".
3.  Page reloads with sample data.
4.  Purple banner indicates demo mode is active.

### 3-Minute Demo Script

**Minute 1: Introduction & First Impression**
-   Show onboarding animation (5 seconds, impressive visuals).
-   Explain the problem: "DSA interview prep is hard, generic practice doesn't help."
-   Our solution: AI-powered voice interviews with cognitive assessment.

**Minute 2: Live Demo**
-   Navigate to interview page.
-   Start voice interview (show microphone pulse states).
-   Speak a brief solution approach.
-   AI responds with hints (RAG-powered).
-   Complete the interview quickly.
-   Show real-time assessment generation.

**Minute 3: Dashboard & Impact**
-   Navigate to dashboard.
-   Show radar chart (current vs previous session).
-   Highlight skill progression over 12 demo sessions.
-   Show personalized recommendations.
-   Export PDF report.
-   Closing: "Track real cognitive skills, not just problem count."

### Key Features to Highlight

1.  **DB-Driven Multi-Model Routing** — 12+ AI models with 4-tier fallback, never fails
2.  **Voice-First AI** — Silero VAD + Groq Whisper + AWS Polly, <1s latency
3.  **8-Dimensional Cognitive Scoring** — CognitiveAnalyzer with evidence extraction
4.  **FSRS-5 Spaced Repetition** — Evidence-based review scheduling per problem and skill
5.  **Owner Panel** — 10 tunable voice parameters with live VAD reconfiguration
6.  **Session Cache + JWT Optimization** — Smart middleware reduces auth overhead by ~90%
7.  **880 Tests** — Full Vitest suite with per-module coverage thresholds
8.  **PDF Export** — Professional assessment reports with radar charts

## Troubleshooting

### API Key Issues
-   Verify keys are set in Vercel environment variables.
-   Check API quotas haven't been exceeded.
-   Test keys locally before deploying.

### Build Failures
```bash
# Clear cache and rebuild
Remove-Item -Recurse -Force .next, node_modules   # Windows
# rm -rf .next node_modules                        # macOS/Linux
npm install
npm run build
```

### Voice Not Working
-   Ensure HTTPS (required for Web Speech API).
-   Check browser permissions for microphone.
-   Text input fallback available.

## Performance Tips

-   Use demo mode for presentations (no API calls for initial data).
-   Clear browser cache before demo.
-   Test on stable internet connection.
-   Have backup screenshots ready.
