const fs = require('fs');

try {
    const content = fs.readFileSync('eslint_report.json', 'utf8');
    const report = JSON.parse(content);

    const ruleCounts = {};
    const examples = {};
    const depsViolations = [];

    report.forEach(file => {
        file.messages.forEach(msg => {
            // General rule counting
            const key = `${msg.ruleId} (${msg.severity === 2 ? 'Error' : 'Warning'})`;
            ruleCounts[key] = (ruleCounts[key] || 0) + 1;

            if (!examples[key]) examples[key] = [];
            if (examples[key].length < 3) {
                examples[key].push(`${file.filePath}:${msg.line} - ${msg.message}`);
            }

            // Exhaustive deps specific
            if (msg.ruleId === 'react-hooks/exhaustive-deps') {
                depsViolations.push({
                    file: file.filePath,
                    line: msg.line,
                    message: msg.message
                });
            }
        });
    });

    console.log('--- Top Rules ---');
    Object.entries(ruleCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .forEach(([rule, count]) => {
            console.log(`${rule}: ${count}`);
            if (examples[rule]) {
                examples[rule].forEach(ex => console.log(`  ${ex}`));
            }
        });

    console.log('\n--- Exhaustive Deps Violations: ' + depsViolations.length + ' ---');

    // Group by file
    const byFile = {};
    depsViolations.forEach(v => {
        byFile[v.file] = (byFile[v.file] || 0) + 1;
    });

    Object.entries(byFile)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([file, count]) => {
            console.log(`${file}: ${count}`);
            depsViolations.filter(v => v.file === file).slice(0, 3).forEach(v => {
                console.log(`  Line ${v.line}: ${v.message}`);
            });
        });

} catch (e) {
    console.error('Error:', e.message);
}
