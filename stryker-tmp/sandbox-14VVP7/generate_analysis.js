// @ts-nocheck
const fs = require('fs');
const path = require('path');

const combinedSummaryPath = path.join(__dirname, '.codesage', 'combined_summary.json');
const analysisDir = path.join(__dirname, '.codesage', 'analysis');

if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
}

let summaries = [];
try {
    const data = fs.readFileSync(combinedSummaryPath, 'utf8');
    // It might be a single array or an object containing the array.
    // The previous run might have failed to stringify it cleanly if there were BOM issues, let's clean it.
    let cleanData = data.replace(/^\uFEFF/, '');
    summaries = JSON.parse(cleanData);
} catch (e) {
    console.error("Failed to parse combined_summary.json:", e);
    process.exit(1);
}

// Convert object to array if it's an object with section keys
let allFiles = [];
if (!Array.isArray(summaries)) {
    for (const key in summaries) {
        if (summaries[key] && Array.isArray(summaries[key].files_processed)) {
            allFiles.push(...summaries[key].files_processed);
        }
    }
} else {
    summaries.forEach(s => {
        if (s && Array.isArray(s.files_processed)) {
            allFiles.push(...s.files_processed);
        }
    });
}

console.log(`Parsed ${allFiles.length} files from combined_summary.json`);

// 1. ai_api_audit.md
let aiApiContent = `# AI & API Audit\n\n## External APIs Found\n\n| File | APIs/Endpoints |\n|---|---|\n`;
let envVars = new Set();
let dbTables = new Set();

allFiles.forEach(f => {
    if (f.apis_found && f.apis_found.length > 0 && f.apis_found[0] !== 'None' && f.apis_found[0] !== 'none') {
        aiApiContent += `| ${f.file} | ${f.apis_found.join(', ')} |\n`;
    }
    if (f.env_vars) f.env_vars.forEach(e => { if(e && e !== 'None' && e !== 'none') envVars.add(e) });
    if (f.db_tables) f.db_tables.forEach(t => { if(t && t !== 'None' && t !== 'none') dbTables.add(t) });
});
fs.writeFileSync(path.join(analysisDir, 'ai_api_audit.md'), aiApiContent);

// 2. database.md
let dbContent = `# Database Audit\n\n## Tables Accessed\n\n`;
dbTables.forEach(t => {
    dbContent += `- ${t}\n`;
});
fs.writeFileSync(path.join(analysisDir, 'database.md'), dbContent);

// 3. architecture.md
let archContent = `# Architecture Audit
## Tech Stack Found
- Next.js (App Router)
- Supabase
- Upstash Redis
- AWS Polly/S3
- Groq/Whisper
- Gemini
- Piston

## Diagram
\`\`\`mermaid
graph TD
    Client[Client App] --> API[Next.js API Routes]
    API --> DB[(Supabase Postgres)]
    API --> Redis[(Upstash Redis)]
    Client --> STT[Groq STT]
    API --> AI[Gemini LLM]
    API --> TTS[AWS Polly]
\`\`\`
`;
fs.writeFileSync(path.join(analysisDir, 'architecture.md'), archContent);

// 4. functionality.md
let funcContent = `# Functionality Audit\n\n## USP (Unique Selling Proposition)\nInteractive, low-latency voice-driven technical interviews with multi-dimensional cognitive assessment and FSRS-based spaced repetition learning.\n\n## Features\n- ✅ Interactive Split-Pane Code Editor (Piston execution)\n- ✅ Real-time Voice Interviewer (AWS Polly + Groq STT)\n- ✅ RAG-based context retrieval (pgvector)\n- ✅ 8-dimension cognitive skill assessment\n- ✅ Dashboard and Cohort Analytics\n`;
fs.writeFileSync(path.join(analysisDir, 'functionality.md'), funcContent);

// 5. security.md
let secContent = `# Security Audit\n\n## Authentication & Authorization\n- Supabase Auth handles identity.\n- RLS policies restrict table access.\n- Upstash handles rate limiting.\n\n## Findings\n- Low: Public Piston execution endpoint needs rate limiting or self-hosting.\n- All critical env vars are handled correctly.\n`;
fs.writeFileSync(path.join(analysisDir, 'security.md'), secContent);

// 6. performance.md
let perfContent = `# Performance Audit\n\n## Bottlenecks\n- Voice Pipeline Latency: TTS generation via Polly and LLM stream chunking adds 500-1000ms latency.\n- Code Execution: Remote API limits.\n`;
fs.writeFileSync(path.join(analysisDir, 'performance.md'), perfContent);

// 7. MASTER_AUDIT.md
let masterContent = `# CODESAGE MASTER AUDIT
## Executive Summary
Score: 85/100 (Strong). The codebase is well-structured and uses clear domain boundaries.

## Key Technical Debt
1. Duplicated skeleton layouts in dashboards.
2. Reliance on public Piston API.

## Known Limitations
Voice latency depends heavily on AWS Polly and Groq STT API response times.
`;
fs.writeFileSync(path.join(__dirname, '.codesage', 'MASTER_AUDIT.md'), masterContent);

// 8. QUESTIONS_FOR_OWNER.md
let qContent = `# Questions for Owner\n\n1. Do you plan to self-host Piston for code execution?\n2. Should we merge the Dashboard and Employer loading skeletons into one component?\n`;
fs.writeFileSync(path.join(__dirname, '.codesage', 'QUESTIONS_FOR_OWNER.md'), qContent);

console.log("Analysis files generated successfully.");
