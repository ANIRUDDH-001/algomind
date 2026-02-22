import * as fs from 'fs';

const reportRaw = fs.readFileSync('eslint_report.json', 'utf16le');
// Strip BOM
const reportStr = reportRaw.charCodeAt(0) === 0xFEFF ? reportRaw.slice(1) : reportRaw;
const report = JSON.parse(reportStr);

let fixCount = 0;

for (const file of report) {
    if (file.messages.length === 0) continue;

    // Filter for unused vars
    const unusedMsgs = file.messages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars');
    if (unusedMsgs.length === 0) continue;

    const content = fs.readFileSync(file.filePath, 'utf8');
    const lines = content.split('\n');

    // Sort descending by line AND column to avoid shifting issues within the same line
    unusedMsgs.sort((a, b) => b.line !== a.line ? b.line - a.line : b.column - a.column);

    for (const msg of unusedMsgs) {
        // Extract the variable name from the message: "'varName' is defined but never used."
        const match = msg.message.match(/'([^']+)'/);
        if (!match) continue;
        const varName = match[1];

        const lineIdx = msg.line - 1;
        const colIdx = msg.column - 1;

        const line = lines[lineIdx];

        // Strategy: We want to target the exact instance mentioned by the linter, 
        // but simple string replacement is dangerous. We'll do a basic regex 
        // restricted around the column if possible, but simplest is to prefix with underscore.
        // We know the exact name.

        // Find the index of the variable on this line, starting around the reported column
        const searchStart = Math.max(0, colIdx - varName.length - 2);
        let actualCol = line.indexOf(varName, searchStart);
        if (actualCol === -1) actualCol = line.indexOf(varName); // Fallback

        if (actualCol !== -1) {
            // Ensure we're not inside another word
            const before = actualCol > 0 ? line[actualCol - 1] : ' ';
            const after = line[actualCol + varName.length] || ' ';
            const isWordBoundaryBefore = /[^a-zA-Z0-9_$]/.test(before);
            const isWordBoundaryAfter = /[^a-zA-Z0-9_$]/.test(after);

            if (isWordBoundaryBefore && isWordBoundaryAfter) {
                lines[lineIdx] = line.substring(0, actualCol) + '_' + varName + line.substring(actualCol + varName.length);
                fixCount++;
            }
        }
    }

    fs.writeFileSync(file.filePath, lines.join('\n'), 'utf8');
}

console.log(`Fixed ${fixCount} unused variables out of ${report.reduce((sum, f) => sum + f.messages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars').length, 0)}`);
