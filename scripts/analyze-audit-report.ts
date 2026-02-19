import fs from 'fs';
import path from 'path';

const reportPath = path.resolve(process.cwd(), 'inferior_problems_report.json');
const rawData = fs.readFileSync(reportPath, 'utf-8');
const problems: Problem[] = JSON.parse(rawData);

interface Problem {
    id: string | number;
    title: string;
    issues: string[];
}

const critical = problems.filter((p: Problem) =>
    p.issues.length >= 3 ||
    p.issues.includes("Generic/Textbook Title") ||
    (p.issues.includes("Short Description") && p.issues.includes("Missing Constraints"))
);

console.log(`Total Flagged: ${problems.length}`);
console.log(`Critical Candidates (Replacement Recommended): ${critical.length}`);

console.log("\n--- Top Critical Candidates (Sample) ---");
critical.slice(0, 20).forEach((p) => {
    console.log(`[${p.id}] ${p.title}`);
    console.log(`  Issues: ${p.issues.join(', ')}`);
});

const criticalIds = critical.map((p) => p.id);
const summaryPath = path.resolve(process.cwd(), 'critical_inferior_problems.json');
fs.writeFileSync(summaryPath, JSON.stringify(criticalIds, null, 2));
console.log(`\nFull list of ${critical.length} critical IDs saved to: ${summaryPath}`);
