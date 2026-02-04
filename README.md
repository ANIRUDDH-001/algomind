# AlgoMind 🧠

> AI-Powered DSA Interview Practice Platform

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css)

## ✨ Features

- 🎤 **Voice-Based Interviews** - Practice with natural voice conversations powered by Gemini AI
- 🤖 **Multi-Model AI** - Intelligent fallback between Gemini and Groq for 99.9% uptime
- 📚 **RAG Pipeline** - DSA knowledge retrieval for accurate, contextual responses
- 🧠 **8-Dimensional Cognitive Assessment** - Scientific skill evaluation framework
- 📊 **Visual Dashboard** - Radar charts, skill trends, and progress tracking
- 📄 **PDF Reports** - Exportable assessment reports for your portfolio
- ✨ **Cinematic Onboarding** - Impressive first-time user experience

## 🎯 Cognitive Skills Tracked

| Skill | What It Measures |
|-------|-----------------|
| Problem Decomposition | Breaking complex problems into parts |
| Pattern Recognition | Identifying common data structures |
| Algorithmic Thinking | Solution design and approach |
| Complexity Analysis | Big-O understanding |
| Communication Clarity | Explaining thought process |
| Edge Case Handling | Considering boundary conditions |
| Debugging Skills | Finding and fixing issues |
| Code Quality | Clean, maintainable solutions |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/algomind.git
cd algomind

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🔑 Environment Variables

Create a `.env.local` file with:

```bash
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

## 📁 Project Structure

```
algomind/
├── src/
│   ├── app/              # Next.js pages
│   │   ├── dashboard/    # Progress dashboard
│   │   ├── interview/    # Voice interview
│   │   └── settings/     # App settings
│   ├── components/       # React components
│   │   ├── charts/       # Radar charts, trends
│   │   ├── dashboard/    # Dashboard cards
│   │   ├── interview/    # Interview UI
│   │   ├── onboarding/   # Intro animation
│   │   └── voice/        # Mic pulse, controls
│   ├── lib/              # Core logic
│   │   ├── ai/           # Multi-model client
│   │   ├── assessment/   # Cognitive analyzer
│   │   ├── demo/         # Demo mode
│   │   ├── rag/          # Vector store
│   │   └── voice/        # Speech APIs
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript types
├── data/                 # Knowledge base
└── public/               # Static assets
```

## 🎭 Demo Mode

For presentations and testing:

1. Visit `/settings`
2. Enable "Demo Mode"
3. Refresh to see 12 pre-loaded sessions with skill progression

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Animations**: Framer Motion
- **AI**: Google Gemini API + Groq API
- **Voice**: Web Speech API
- **PDF**: react-pdf/renderer

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide and demo script

## 🏆 Hackathon

Built for demonstrating AI-powered interview practice with cognitive skill assessment.

**Key Differentiators:**
- Real cognitive skill tracking (not just problem count)
- Voice-first interaction (like real interviews)
- Multi-model reliability (never fails during demos)
- Scientific 8-dimension assessment framework

## 📄 License

MIT License - feel free to use and modify for your projects.
