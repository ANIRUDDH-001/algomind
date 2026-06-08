# Functionality Audit

## Unique Selling Proposition (USP)
AlgoMind is distinct from standard algorithmic practice platforms (like LeetCode) because it actively simulates the *human* element of a technical interview. It uses voice-activity detection and LLM-driven assessments to evaluate a candidate's ability to communicate, clarify ambiguity, and explain complexity.

## Key Features

- ✅ **Interactive Split-Pane Code Editor**: Real-time compilation and execution of multiple languages using the Piston API.
- ✅ **Voice-First AI Interviewer**: Client-side VAD combined with AWS Polly enables a low-latency, interruptible voice interview experience.
- ✅ **Multi-dimensional Assessment**: Generates highly structured feedback matching the `assessments` schema (Algorithmic Thinking, Communication Clarity, Edge Case Awareness, etc.).
- ✅ **Employer Campaign Dashboard**: Employers can generate unique invite links (`assessment_campaigns`), track candidate cohorts, and view AI-generated hire decisions based on raw performance data.
- ✅ **Spaced Repetition Learning (FSRS)**: Tracks `concept_states` in the DB and uses FSRS algorithms (`src/lib/spaced-repetition/fsrs.ts`) to adapt problem difficulty and schedule reviews based on candidate performance.
- ✅ **Robust Rate Limiting**: Upstash Redis manages IP limits, User limits, and Session limits to prevent LLM abuse.

## Known Limitations / Missing Features
- ❌ **Piston Rate Limits**: Relying on a public code execution endpoint is a bottleneck for high-concurrency production use.
- ❌ **Duplicated Loading Skeletons**: Employer and Dashboard loading components share visual design but duplicate React structures.
