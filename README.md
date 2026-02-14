# AlgoMind 🧠

> **The AI-Powered Technical Interview Coach that listens, analyzes, and teaches.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://algomind-drab.vercel.app/)

AlgoMind is a cutting-edge technical interview preparation platform that simulates real-world coding interviews using voice-first AI. Built with a sophisticated **Multi-Model Architecture (Gemini 1.5 + Groq)** and **RAG (Retrieval-Augmented Generation)**, it delivers 99.9% uptime, sub-second latency, and context-aware feedback.

Unlike standard coding platforms, AlgoMind evaluates candidates on **8 distinct cognitive dimensions**, providing a granular scientific analysis of their engineering potential.

---

## 🌟 Key Features (The "Wow" Factor)

### 🎤 Voice-First AI Interviewer
*   **Real-time Conversation**: Speak naturally with the AI. It interrupts, asks follow-up questions, and provides hints just like a human interviewer.
*   **Interruptions & Pacing**: The AI handles interruptions gracefully and manages the interview pace dynamically.
*   **Multi-Model Voice Pipeline**: Uses browser-native speech recognition for zero-latency input and high-quality TTS for natural output.

### 🧠 8-Dimensional Cognitive Assessment
We go beyond "passing test cases". Use our proprietary scoring engine to measure:
1.  **Problem Decomposition**: Ability to break down complex tasks.
2.  **Pattern Recognition**: Identifying correct data structures/algorithms.
3.  **Algorithmic Thinking**: Logical flow and edge case handling.
4.  **Code Quality**: Cleanliness, variable naming, and modularity.
5.  **Communication**: Clarity of thought and vocal explanation.
6.  **Efficiency**: Time and space complexity mastery.
7.  **Debugging**: Identifying and fixing logical errors.
8.  **Adaptability**: How well the candidate incorporates feedback.

### 🚀 High-Performance AI Architecture
*   **Hybrid Model Strategy**:
    *   **Google Gemini 1.5 Pro**: Handles complex reasoning, code analysis, and deep evaluation.
    *   **Groq (Llama 3/Mixtral)**: Powers instant conversational responses and rapid hints.
*   **RAG Pipeline**: Vector-search powered retrieval system (Supabase pgvector) ensures the AI "knows" the specific problem context, test cases, and optimal solutions without hallucinations.

### 📚 Comprehensive Practice Ecosystem
*   **Curated Problem Lists**: Blind 75, NeetCode 150, Grid 75, and company-specific tracks.
*   **Smart Filters**: Sort by difficulty, topic (DP, Graphs, Trees), and status.
*   **"Feeling Lucky"**: Random problem generator for spontaneous practice.

### 📊 Professional Insights & Reports
*   **Visual Radar Charts**: Instantly visualize strengths and weaknesses.
*   **Trend Analysis**: Track improvement over time across all 8 dimensions.
*   **PDF Export**: Generate professional assessment reports to share with recruiters.

---

## 🛠️ Tech Stack

### Frontend & Core
*   **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Actions)
*   **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Framer Motion](https://www.framer.com/motion/)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)

### Backend & Database
*   **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
*   **Vector Search**: pgvector (for RAG context retrieval)
*   **Auth**: Supabase Auth (GitHub/Google/Email)
*   **ORM**: Raw SQL + Supabase Client for maximum performance

### AI & Intelligence
*   **Reasoning & Complex Tasks**:
    *   [Groq](https://groq.com/): `llama-3.3-70b-versatile` (Primary), `llama-3.1-8b-instant` (Fast)
    *   [Google Gemini](https://ai.google.dev/): `gemini-2.5-flash` (High Quality), `gemini-2.0-flash` (Free Tier)
*   **Embeddings**: `gemini-embedding-001`
*   **Fallbacks**: Includes `gemma-3-27b-it` and `openai/gpt-oss-120b` for maximum reliability.
*   **Orchestration**: Custom "Antigravity Router" for failover and model selection

### DevOps & Tools
*   **Linting**: ESLint
*   **Formatting**: Prettier
*   **Deployment**: Vercel (Edge Functions ready)

---

## 🚀 Getting Started

Follow these steps to set up AlgoMind locally for evaluation.

### Prerequisites
*   Node.js 18+
*   npm or pnpm
*   Git

### Installation

1.  **Clone the repository**
    (Use your own repository URL if forking)
    ```bash
    git clone https://github.com/yourusername/algomind.git
    cd algomind
    ```

2.  **Install dependencies**
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Environment Setup**
    Create a `.env.local` file in the root directory:
    ```bash
    cp .env.example .env.local
    ```
    
    Fill in your API keys:
    ```env
    # AI Providers
    GEMINI_API_KEY=your_gemini_key
    GROQ_API_KEY=your_groq_key

    # Supabase (Database & Auth)
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the Development Server**
    ```bash
    npm run dev
    ```

5.  **Open the App**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests & Demo Mode

### Demo Mode
For hackathons and presentations, we have a built-in **Demo Mode** that populates the dashboard with realistic dummy data to showcase the visualization capabilities without needing to complete 10+ interviews.

1.  Go to **Settings** -> **Developer**.
2.  Toggle **"Enable Demo Mode"**.
3.  Refresh the Dashboard to see populated analytics.

---

## 🏆 Hackathon Context

This project addresses the **"Interview Gap"**—the disconnect between LeetCode-style grinding and the actual communicative assessment of a real interview.

**Why it wins:**
1.  **It works**: Fully functional voice loop with negligible latency.
2.  **It's useful**: Provides actionable data (8-dim score) candidates don't get elsewhere.
3.  **It's technically impressive**: complex orchestration of multiple LLMs, RAG, and real-time audio analysis in a seamless UI.

---

## 📄 License

MIT License © 2024 AlgoMind
