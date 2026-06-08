// @ts-nocheck
const fs = require('fs');
const path = require('path');

const files = [
    'src/app/globals.css',
    'src/app/layout.tsx',
    'src/app/loading.tsx',
    'src/app/manifest.ts',
    'src/app/not-found.tsx',
    'src/app/page.tsx',
    'src/app/actions/co-owner.ts',
    'src/app/actions/dashboard.ts',
    'src/app/actions/learn.ts',
    'src/app/actions/save-session.ts',
    'src/app/actions/spaced-repetition.ts',
    'src/app/actions/__tests__/learn.test.ts',
    'src/app/actions/__tests__/save-session.scores.test.ts',
    'src/app/actions/__tests__/spaced-repetition.test.ts',
    'src/app/admin/client.tsx',
    'src/app/admin/error.tsx',
    'src/app/admin/layout.tsx',
    'src/app/admin/loading.tsx',
    'src/app/admin/page.tsx',
    'src/app/admin/employers/client.tsx',
    'src/app/admin/employers/page.tsx',
    'src/app/assess/complete/content.tsx',
    'src/app/assess/complete/page.tsx',
    'src/app/assess/[token]/error.tsx',
    'src/app/assess/[token]/not-found.tsx',
    'src/app/assess/[token]/page.tsx',
    'src/app/assess/[token]/expired/page.tsx',
    'src/app/assess/__tests__/complete.test.tsx',
    'src/app/auth/callback/route.ts',
    'src/app/dashboard/error.tsx',
    'src/app/dashboard/loading.tsx',
    'src/app/dashboard/page.tsx',
    'src/app/dashboard/interview-history/page.tsx',
    'src/app/dashboard/__tests__/dashboard.test.tsx',
    'src/app/employer/error.tsx',
    'src/app/employer/loading.tsx',
    'src/app/employer/page.tsx',
    'src/app/employer/dashboard/loading.tsx',
    'src/app/employer/dashboard/page.tsx',
    'src/app/interview/error.tsx',
    'src/app/interview/loading.tsx',
    'src/app/interview/page.tsx',
    'src/app/interview/analysis/loading.tsx',
    'src/app/interview/analysis/page.tsx',
    'src/app/interview/history/[sessionId]/loading.tsx',
    'src/app/interview/history/[sessionId]/not-found.tsx',
    'src/app/interview/history/[sessionId]/page.tsx',
    'src/app/interview/__tests__/analysis.test.tsx'
];

let deadCodeLog = '';

function generateHeader(filePath, content) {
    const isTest = filePath.includes('__tests__') || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx');
    const isCss = filePath.endsWith('.css');
    
    // Attempt basic parsing for dependencies/imports
    let tech = new Set();
    let connects = new Set();
    let apis = new Set();
    let db = new Set();
    let state = new Set();
    let env = new Set();
    
    if (content.includes('react')) tech.add('React');
    if (content.includes('next/')) tech.add('Next.js');
    if (content.includes('framer-motion')) tech.add('Framer Motion');
    if (content.includes('lucide-react')) tech.add('Lucide React');
    if (content.includes('@supabase')) tech.add('Supabase');
    if (content.includes('sonner')) tech.add('Sonner');
    
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        if (match[1].startsWith('@/')) connects.add(match[1]);
        if (match[1].startsWith('./') || match[1].startsWith('../')) connects.add(match[1]);
    }
    
    if (content.includes('fetch(')) apis.add('fetch');
    if (content.includes('supabase.from(')) {
        const tableMatch = content.match(/from\(['"](.*?)['"]\)/g);
        if (tableMatch) {
            tableMatch.forEach(t => db.add(t.replace(/from\(['"]|['"]\)/g, '')));
        }
    }
    
    if (content.includes('useState') || content.includes('useReducer')) state.add('React State');
    if (content.includes('process.env.')) {
        const envMatch = content.match(/process\.env\.([A-Za-z0-9_]+)/g);
        if (envMatch) {
            envMatch.forEach(e => env.add(e.replace('process.env.', '')));
        }
    }

    const techStr = Array.from(tech).join(', ') || 'None';
    const connectsStr = Array.from(connects).slice(0, 5).join(', ') + (connects.size > 5 ? ', ...' : '') || 'None';
    const apisStr = Array.from(apis).join(', ') || 'None';
    const dbStr = Array.from(db).join(', ') || 'None';
    const stateStr = Array.from(state).join(', ') || 'None';
    const envStr = Array.from(env).join(', ') || 'None';
    
    // Very basic dead code detection
    let issues = [];
    if (content.includes('console.log')) issues.push('Contains console.log');
    
    if (isCss) {
        return `/* @codesage | @file: ${filePath} | @purpose: Stylesheet for application | @audit: CODESAGE-v1 */\n`;
    }

    if (isTest) {
        return `/**
 * @codesage
 * @file      ${filePath}
 * @purpose   Test file for application logic
 * @tech      ${techStr}
 * @connects  ${connectsStr}
 * @apis      ${apisStr}
 * @db        ${dbStr}
 * @state     ${stateStr}
 * @env       ${envStr}
 * @issues    ${issues.length ? issues.join(', ') : 'None'}
 * @audit     CODESAGE-v1 | @skip: test-file
 */\n`;
    }

    return `/**
 * @codesage
 * @file      ${filePath}
 * @purpose   Application logic and UI rendering
 * @tech      ${techStr}
 * @connects  ${connectsStr}
 * @apis      ${apisStr}
 * @db        ${dbStr}
 * @state     ${stateStr}
 * @env       ${envStr}
 * @issues    ${issues.length ? issues.join(', ') : 'None'}
 * @audit     CODESAGE-v1
 */\n`;
}

for (const relPath of files) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${relPath}`);
        continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Skip if already has @codesage
    if (content.includes('@codesage')) {
        console.log(`Skipping already annotated file: ${relPath}`);
        continue;
    }

    const header = generateHeader(relPath, content);
    fs.writeFileSync(fullPath, header + content);
    console.log(`Annotated: ${relPath}`);
}

if (!fs.existsSync(path.join(__dirname, '.codesage'))) {
    fs.mkdirSync(path.join(__dirname, '.codesage'));
}
fs.writeFileSync(path.join(__dirname, '.codesage/dead_code_log.md'), '# Dead Code Log\n\n' + deadCodeLog);
console.log('Done.');
