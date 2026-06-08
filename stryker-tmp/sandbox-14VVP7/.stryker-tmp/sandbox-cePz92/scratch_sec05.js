// @ts-nocheck
// 
const fs = require('fs');
const path = require('path');

const logPath = path.join('d:', 'algomind', '.codesage', 'dead_code_log.md');
const summaryDir = path.join('d:', 'algomind', '.codesage', 'sections');
const summaryPath = path.join(summaryDir, 'SEC-05_summary.json');

// Ensure directory exists
if (!fs.existsSync(summaryDir)) {
    fs.mkdirSync(summaryDir, { recursive: true });
}

// 1. Append to dead_code_log.md
const deadCodeEntry = `\n## SEC-05: Core Libs: Interview & Voice\n- \`src/lib/voice/interruption-manager.ts\`: \`handleUserSpeechStart()\` is a deprecated legacy wrapper around \`handleUserSpeechStartWithConfidence\`.\n`;
try {
    fs.appendFileSync(logPath, deadCodeEntry, 'utf8');
} catch (e) {
    console.error("Failed to append to dead_code_log.md", e);
}

// 2. Generate SEC-05_summary.json
const summaryData = {
    "section": "SEC-05: Core Libs: Interview & Voice",
    "status": "completed",
    "audited_files": [
        "src/lib/interview/interruption-context.ts",
        "src/lib/interview/interview-config.ts",
        "src/lib/interview/interviewer-prompt.ts",
        "src/lib/interview/mode-assessment-config.ts",
        "src/lib/interview/prompts.ts",
        "src/lib/interview/silent-observer.ts",
        "src/lib/interview/state-machine.ts",
        "src/lib/interview/transcript-enricher.ts",
        "src/lib/interview/turn-classifier.ts",
        "src/lib/interview/__tests__/mode-assessment-config.test.ts",
        "src/lib/interview/__tests__/prompt-snapshots.test.ts",
        "src/lib/interview/__tests__/silent-observer.test.ts",
        "src/lib/interview/__tests__/state-machine.test.ts",
        "src/lib/interview/__tests__/transcript-enricher.test.ts",
        "src/lib/interview/__tests__/turn-classifier.test.ts",
        "src/lib/voice/interruption-manager.ts",
        "src/lib/voice/text-chunker.ts",
        "src/lib/voice/tts-engine.ts",
        "src/lib/voice/tts-preprocessor.ts",
        "src/lib/voice/types.ts",
        "src/lib/voice/vad-manager.ts",
        "src/lib/voice/vad-utils.ts",
        "src/lib/voice/vocabulary-ai.ts",
        "src/lib/voice/vocabulary.ts",
        "src/lib/voice/voice-utils.ts",
        "src/lib/voice/whisper-stt.ts",
        "src/lib/voice/__tests__/interruption-manager.test.ts",
        "src/lib/voice/__tests__/tts-preprocessor.test.ts",
        "src/lib/voice/__tests__/vad-manager.test.ts",
        "src/lib/aws/index.ts",
        "src/lib/aws/polly.ts",
        "src/lib/aws/s3.ts",
        "src/lib/aws/usage-logger.ts"
    ],
    "skipped_files": [
        "src/lib/interview/__tests__/__snapshots__/prompt-snapshots.test.ts.snap"
    ],
    "key_findings": [
        "Injected @codesage headers across 33 files in src/lib/interview/, src/lib/voice/, and src/lib/aws/.",
        "Identified handleUserSpeechStart() in interruption-manager.ts as deprecated dead code.",
        "Skipped snapshot files to prevent breaking tests."
    ]
};

try {
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2), 'utf8');
    console.log("Successfully wrote SEC-05_summary.json");
} catch (e) {
    console.error("Failed to write summary json", e);
}
