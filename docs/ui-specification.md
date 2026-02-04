# UI Design Specification - AlgoMind v2

To achieve a "modern and stylish" no-scroll experience, the next design should adhere to these structural and functional requirements.

## 1. Screen Layout (100vh / No-Scroll)
The entire application must fit within the user's viewport. No global scrollbar should be visible.

- **Main Container**: `display: flex` or `grid`, `height: 100vh`, `overflow: hidden`.
- **Background**: Deep slate/charcoal gradient (`#020617` to `#0f172a`) with subtle animated glows (radial gradients in the corners).

## 2. Component Distribution

### A. Problem Navigator & Details (25% Width)
- **Problem Info**: Title, Difficulty Badge, and Category.
- **Problem Description**: Markdown-rendered text.
- **Requirement**: Must have an internal scrollbar (`overflow-y-auto`) for long descriptions.
- **Visuals**: Glassmorphism effect (semi-transparent card with subtle border). 

### B. Voice Interaction Hub (Central Area - 45% Width)
- **The "Core"**: A large, central visualizer (like Siri/Alexa) that responds to voice intensity.
- **Action Button**: One primary Microphone button. High contrast (e.g., Emerald or Electric Blue).
- **Status HUD**: A small, high-tech status indicator (e.g., "THINKING...", "LISTENING...", "AI SPEAKING...").
- **Live Transcript**: A fixed-height box (max-height: 150px) at the bottom for real-time text feedback.
- **Requirement**: This section should feel open and "clean".

### C. Interview History / Conversation (30% Width)
- **Timeline**: A vertical list of chat bubbles.
- **Requirement**: Must have an internal scrollbar that auto-scrolls to the bottom on new turns.
- **Interaction**: Assistant messages on the left, User messages on the right (or distinctive colors).

## 3. Dynamic Elements
- **Inline Error Notifications**: Errors (like "Interact at least once") should appear as non-blocking toasts or banners at the top of the central hub, NOT as browser alerts.
- **Skill Badges**: Pop-up floating notifications (`fixed` position) when a skill is demonstrated.

## 4. Aesthetic Guidelines
- **Typography**: Sans-serif, modern (e.g., Inter, Outfit, or Geist).
- **Colors**:
    - Primary: Electric Blue (`#3b82f6`) or Teal (`#14b8a6`).
    - Error: Soft Red/Coral (`#f87171`).
    - Surface: Slate 900 (`#0f172a`) with low opacity.
- **Borders**: Thin, high-gloss borders (`border: 1px solid rgba(255,255,255,0.1)`).
- **Shadows**: Large, soft glows instead of hard drop shadows.
