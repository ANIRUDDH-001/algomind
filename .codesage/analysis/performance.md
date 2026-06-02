# Performance Audit

## Bottlenecks
- Voice Pipeline Latency: TTS generation via Polly and LLM stream chunking adds 500-1000ms latency.
- Code Execution: Remote API limits.
