# AlgoMind Deployment Guide

## Pre-Deployment Checklist

- [ ] All environment variables set in Vercel/Netlify
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] All API keys valid and working
- [ ] Demo mode loads sample data
- [ ] Error boundaries catch errors

## Environment Variables Required

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Optional
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
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

1. Push code to GitHub/GitLab
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

## Post-Deployment Verification

- [ ] Homepage loads at your-domain.vercel.app
- [ ] Onboarding animation plays for new visitors
- [ ] Settings page accessible at /settings
- [ ] Dashboard shows data
- [ ] Interview mode works with voice
- [ ] PDF export downloads correctly
- [ ] API health check returns 200

## Demo Preparation (Hackathon)

### Enable Demo Mode
1. Visit `/settings`
2. Click "Enable Demo Mode"
3. Page reloads with sample data
4. Purple banner indicates demo mode is active

### 3-Minute Demo Script

**Minute 1: Introduction & First Impression**
- Show onboarding animation (5 seconds, impressive visuals)
- Explain the problem: "DSA interview prep is hard, generic practice doesn't help"
- Our solution: AI-powered voice interviews with cognitive assessment

**Minute 2: Live Demo**
- Navigate to interview page
- Start voice interview (show microphone pulse states)
- Speak a brief solution approach
- AI responds with hints (RAG-powered)
- Complete the interview quickly
- Show real-time assessment generation

**Minute 3: Dashboard & Impact**
- Navigate to dashboard
- Show radar chart (current vs previous session)
- Highlight skill progression over 12 demo sessions
- Show personalized recommendations
- Export PDF report
- Closing: "Track real cognitive skills, not just problem count"

### Key Features to Highlight

1. **Multi-Model Fallback** - Never fails, uses Gemini + Groq
2. **RAG Pipeline** - DSA knowledge retrieval for accurate responses
3. **Voice Mode** - Natural conversation, not typing
4. **8 Cognitive Skills** - Scientific assessment framework
5. **Progress Tracking** - Visual dashboard with trends
6. **PDF Export** - Professional reports

## Troubleshooting

### API Key Issues
- Verify keys are set in Vercel environment variables
- Check API quotas haven't been exceeded
- Test keys locally before deploying

### Build Failures
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Voice Not Working
- Ensure HTTPS (required for Web Speech API)
- Check browser permissions for microphone
- Text input fallback available

## Performance Tips

- Use demo mode for presentations (no API calls for initial data)
- Clear browser cache before demo
- Test on stable internet connection
- Have backup screenshots ready
