import * as fs from 'fs';

const reportRaw = fs.readFileSync('eslint_report.json', 'utf16le');
const reportStr = reportRaw.charCodeAt(0) === 0xFEFF ? reportRaw.slice(1) : reportRaw;
const report = JSON.parse(reportStr);

let fixCount = 0;

for (const file of report) {
    const anyMsgs = file.messages.filter(m => m.ruleId === '@typescript-eslint/no-explicit-any');
    if (anyMsgs.length === 0) continue;

    const content = fs.readFileSync(file.filePath, 'utf8');
    const lines = content.split('\n');

    // Sort descending by line AND column
    anyMsgs.sort((a, b) => b.line !== a.line ? b.line - a.line : b.column - a.column);

    for (const msg of anyMsgs) {
        const lineIdx = msg.line - 1;
        const colIdx = msg.column - 1;
        const line = lines[lineIdx];

        // Target specifically the word "any" at the specified column
        const targetWord = 'any';
        // Check if the word "any" starts at colIdx
        if (line.substring(colIdx, colIdx + targetWord.length) === targetWord) {
            lines[lineIdx] = line.substring(0, colIdx) + 'unknown' + line.substring(colIdx + targetWord.length);
            fixCount++;
        } else {
            // Fallback search around column
            const start = Math.max(0, colIdx - 5);
            const actualCol = line.indexOf('any', start);
            if (actualCol !== -1) {
                // check word boundaries
                const before = actualCol > 0 ? line[actualCol - 1] : ' ';
                const after = line[actualCol + 3] || ' ';
                if (/[^a-zA-Z0-9_$]/.test(before) && /[^a-zA-Z0-9_$]/.test(after)) {
                    lines[lineIdx] = line.substring(0, actualCol) + 'unknown' + line.substring(actualCol + 3);
                    fixCount++;
                }
            }
        }
    }

    fs.writeFileSync(file.filePath, lines.join('\n'), 'utf8');
}

console.log(`Fixed ${fixCount} any types out of ${report.reduce((sum, f) => sum + f.messages.filter(m => m.ruleId === '@typescript-eslint/no-explicit-any').length, 0)}`);
