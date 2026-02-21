# REQUIREMENTS.MD

## 1. Project Overview

**Project Name:** AlgoMind  
**Tagline:** The AI-Powered Technical Interview Coach that listens, analyzes, and teaches.  
**Problem Statement:** Engineering graduates in India, especially from Tier 2/3 cities, often possess strong theoretical knowledge but lack the communicative and problem-solving soft skills required to clear top-tier technical interviews. Existing platforms (LeetCode, etc.) focus solely on code correctness, ignoring the crucial conversational aspect of interviews.  
**Target Audience:**  
*   **Computer Science Students:** Particularly from Tier 2/3 colleges in India who lack access to peer mock interviews.  
*   **Job Seekers:** Developers looking to upskill for product-based companies.  
*   **Bootcamp Graduates:** Individuals transitioning into tech who need interview practice.  
**Impact:** Potential to impact over **1.5 million** engineering graduates annually in India, democratizing access to high-quality interview preparation and improving employability rates in the software sector.

## 2. Problem Analysis

**Current Challenges:**  
*   **Communication Gap:** Candidates struggle to articulate their thought process in English while coding.  
*   **Lack of Feedback:** Traditional platforms only check if code passes test cases, not if the approach was optimal or well-explained.  
*   **High Cost:** Human mock interviews (e.g., Pramp, Interviewing.io) are expensive and hard to schedule.  
*   **Anxiety:** High-pressure interview environments cause performance anxiety.

**Gap Analysis:**  
*   *Existing:* LeetCode (Code only), Pramp (Human dependency, cost), ChatGPT (Text-only, no real-time voice flow).  
*   *Missing:* A voice-first, real-time AI simulation that mimics a human interviewer's interruptions, hints, and dynamic pacing.

**Why AI?:**  
*   AI provides scalable, 24/7 availability at a fraction of the cost of human coaches.  
*   LLMs (Gemini 2.5/Llama 3) can understand context, code, and speech nuances simultaneously.

**Indian Context:**  
*   **Employability Crisis:** Reports suggest a significant percentage of Indian engineers are unemployable due to soft skills gaps. AlgoMind directly addresses this.  
*   **Access:** Brings top-tier mentorship qualities to students who cannot afford expensive coaching centers.

## 3. Functional Requirements

### Core Features (Must-have):
*   **Feature 1: Voice-First Interview Simulation**  
    *   *Functionality:* Real-time, low-latency voice interaction where the AI speaks, listens, and interrupts naturally.  
    *   *Input:* User voice audio.  
    *   *Output:* AI voice response + textual transcription.
*   **Feature 2: Multi-Dimensional Evaluation (8 Scoring Parameters)**  
    *   *Functionality:* Scoring candidates on 8 distinct parameters, not just pass/fail.
    *   **The 8 Scoring Parameters:**
        1.  **Communication Clarity** (0-10): Articulation, grammar, filler words.
        2.  **Problem Decomposition** (0-10): Breaking down the problem into steps.
        3.  **Algorithmic Thinking** (0-10): Choosing the right data structures.
        4.  **Code Quality** (0-10): Readability, naming conventions.
        5.  **Efficiency** (0-10): Time/space complexity mastery.
        6.  **Edge Case Handling** (0-10): Testing boundary conditions.
        7.  **Debugging Approach** (0-10): How they identify and fix logical errors.
        8.  **Adaptability** (0-10): How well candidate incorporates feedback/hints.
    *   *Scoring Methodology:* Rubric-based evaluation using Gemini 2.5 Flash.
*   **Feature 3: Code Execution & Analysis**  
    *   *Functionality:* Integrated code editor that runs code and analyzes time/space complexity.

### Secondary Features (Nice-to-have):
*   **Feature 1:** "Hinglish" language support for explanations.  
*   **Feature 2:** Resume-based personalization of questions.  
*   **Feature 3:** Offline mode for reviewing past interview reports.

### User Stories:
1.  As a **Tier-3 college student**, I want to **practice explaining my code out loud**, so that **I can overcome my hesitation during actual interviews.**
2.  As a **job seeker**, I want **instant feedback on my communication style**, so that **I can improve my clarity and confidence.**
3.  As a **developer**, I want to **solve problems in a realistic IDE**, so that **I am comfortable with the interface used in real interviews.**
4.  As a **user with slow internet**, I want **the interface to load quickly**, so that **I can practice without lag.**
5.  As a **learner**, I want **hints when I am stuck instead of the full answer**, so that **I can build my problem-solving muscle.**

### Priority Matrix for User Stories:

**High Priority (MVP):**
*   US #1: Voice practice (Core feature)
*   US #2: Instant feedback (Core value prop)
*   US #3: Realistic IDE (Core UX)

**Medium Priority (Phase 1.5):**
*   US #4: Slow internet optimization
*   US #5: Hint system

**Low Priority (Phase 2):**
*   Resume-based questions
*   Hinglish support

## 4. Non-Functional Requirements

*   **Performance:** Sub-second (<1000ms) voice-to-voice latency for natural conversation.  
*   **Scalability:** Assessment architecture capable of handling 10,000+ concurrent users via serverless inference.  
*   **Availability:** 99.9% uptime using edge-ready deployment (Vercel).  
*   **Security:**  
    *   OAuth for secure authentication.  
    *   No retention of user voice data beyond the session (privacy-first).  
*   **Accessibility:**  
    *   High-contrast UI for visibility.  
    *   Optimized for mobile browsers (many students use phones as primary devices).  
*   **Usability:** Minimalist "Zen Mode" interface to reduce cognitive load.

## 5. Technical Requirements

*   **Input Data:**  
    *   User Audio (Microphone).  
    *   Code (Text editor).  
*   **Output Format:**  
    *   Synthesized Speech (Audio).  
    *   JSON Assessment Report (Skills, Scores, Feedback).  
*   **Integration:**  
    *   LLM APIs (Google Gemini 2.5, Groq).  
    *   Supabase (PostgreSQL) + Local JSON Vector Store (Hybrid RAG).  
*   **Device Compatibility:** Responsive Web App (Desktop, Tablet, Mobile).  
*   **Connectivity:** Requires active internet connection (optimized for 4G).

## 6. Localization Requirements

*   **Languages Supported:**  
    *   English (Neutral/Indian Accent support).  
    *   *Planned Phase 2:* Hindi, Hinglish (Code concepts often explained in mixed English/Hindi in India), Tamil, Telugu.  
*   **Cultural Considerations:**  
    *   Interview scenarios adapted to Indian tech company recruiting patterns (Service-based vs Product-based).  
*   **Content Adaptation:**  
    *   Using simplified English descriptors to accommodate non-native speakers.

## 7. Success Metrics

### KPIs:
*   **User Adoption Rate:** Sign-ups vs. Active Interviews.  
*   **Completion Rate:** % of users finishing a full 30-minute interview session.  
*   **Skill Improvement:** Average score increase in "Communication" metric over 5 sessions.  
*   **Latency:** Average voice-to-voice response time.

### Acceptance Criteria:
*   System successfully conducts a 15-minute voice interview without crashing.  
*   Assessment report is generated within 30 seconds of completion.  
*   Audio is transcribed with >90% accuracy for Indian accents.

## 8. Constraints & Assumptions

*   **Budget:** Utilizing Free Tier/Low-cost models (Gemini 2.0 Flash, Llama 3 on Groq) to keep per-interview cost near zero.  
*   **Time:** Hackathon timeline (Prototype ready in 48 hours).  
*   **Resources:** 2-person dev team.  
*   **Assumptions:**  
    *   Users have access to a microphone-enabled device.  
    *   Users have a basic understanding of coding syntax.

## 9. Testing Strategy

### Unit Tests:
*   **Voice Transcription:** Verify accuracy >90% for Indian English accents using sample test set.
*   **Code Execution:** Test execution sandbox with infinite loops and malicious input.
*   **AI Client Logic:** specific unit tests to ensure `UnifiedAIClient` correctly selects models and `IntelligentRateLimiter` handles quota fallbacks.

### Integration Tests:
*   **End-to-End Voice Loop:** automated test to measure latency from "User Stop Speaking" event to "AI Audio Start" event is <1.5s.
*   **Database:** Verify full cycle of Interview creation -> Chat logging -> Score saving.

### User Acceptance Tests (UAT):
*   **Beta Testers:** 5+ participants from target demographic (students) complete a full interview session.
*   **Network Conditions:** Verify usability on 4G mobile hotspot connection (simulating typical student access).

## 9.5. Walkthrough Demo Scenario (For Judges)

**Problem Selected:** "Two Sum" (Easy difficulty)

**Complete User Flow (15 minutes):**

**Phase 1: Warmup (2 min)**
1.  User logs in → Dashboard shows "Start Your First Interview".
2.  AI: "Hi! I'm your interview coach. Before we start, tell me—have you solved array problems before?"
3.  User: "Yes, I've done some on LeetCode."
4.  AI: "Great! Let's dive into a classic. Ready?"

**Phase 2: Problem Introduction (3 min)**
5.  AI presents: **"Two Sum"** problem on screen.
6.  User reads problem: "Given an array of integers, return indices of two numbers that add up to target."
7.  AI: "Take a moment to think. What's your initial approach?"
8.  User (thinking aloud): "Umm... I think I can use a brute force approach with nested loops?"
9.  AI: "Good start! Walk me through it."

**Phase 3: Implementation (6 min)**
10. User codes in Monaco Editor:
    ```python
    def two_sum(nums, target):
        for i in range(len(nums)):
            for j in range(i+1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
    ```
11. AI (interrupts naturally): "This works, but what's the time complexity here?"
12. User: "O(n²) because of the nested loops."
13. AI: "Exactly. Can we do better? Think about what you're repeatedly looking up."
14. User: "Hmm... I'm stuck on how to optimize this."
15. AI (hint): "What data structure gives you O(1) lookup time?"
16. User: "Oh! A hash map!"
17. User refactors code:
    ```python
    def two_sum(nums, target):
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
    ```

**Phase 4: Testing & Edge Cases (3 min)**
18. AI: "Nice! Now, what if the array is empty?"
19. User: "I should handle that..." (adds check).
20. AI: "What if there's no solution?"
21. User: "The problem says there's exactly one, but in real scenarios I'd return None."

**Phase 5: Wrap-up (1 min)**
22. AI: "Excellent work! Let me generate your assessment..."
23. **Report Generated** with:
    *   Radar Chart showing 8 dimensions.
    *   Communication Clarity: 8/10.
    *   Algorithmic Thinking: 9/10.
    *   Adaptability: 10/10 (took hint well).
24. Detailed feedback: "Your optimization from O(n²) to O(n) showed strong problem-solving. Work on reducing filler words ('umm') for clearer communication."

**Expected Metrics:**
*   **Duration:** 15 minutes
*   **Voice-to-Voice Latency:** <1s average
*   **Transcript Length:** ~1,200 words
*   **Report Generation:** <30 seconds

**Success Indicators for Judges:**
✅ Natural conversation flow with interruptions  
✅ All 8 scores generated with justifications  
✅ Code executed successfully with test cases  
✅ Mobile-responsive (works on phone browser)

## 10. Hackathon Timeline & Milestones

**Day 1 (24 hours):**
*   **Hour 0-4:** Setup (Next.js, Supabase, Auth integration).
*   **Hour 4-12:** Core Voice Loop implementation (STT -> Server -> TTS).
*   **Hour 12-18:** Code Editor integration (Monaco).
*   **Hour 18-24:** UI Polish & Responsive design.

**Day 2 (24 hours):**
*   **Hour 24-30:** Antigravity Router logic & Model integration.
*   **Hour 30-36:** Scoring System & Report generation.
*   **Hour 36-42:** Testing, Bug fixes, and "Zen Mode" refinement.
*   **Hour 42-48:** Demo Video recording & Submission prep.

### MVP Scope:
✅ 1 fully functional problem ("Two Sum").
✅ Robust Voice conversation loop.
✅ Scoring on 3/8 key parameters (MVP limits).
✅ Mobile-responsive design.

### Out of Scope:
❌ Resume upload parsing.
❌ Multi-language UI (Hinglish support only in voice).
❌ Peer-to-Peer interviews.
