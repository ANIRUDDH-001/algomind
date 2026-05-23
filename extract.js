const fs = require('fs');

const code = fs.readFileSync('src/components/interview/InterviewSession.tsx', 'utf-8');

function extractBetween(str, startMarker, endMarker) {
    const startIndex = str.indexOf(startMarker);
    if (startIndex === -1) return null;
    const endIdx = str.indexOf(endMarker, startIndex);
    if (endIdx === -1) return null;
    return str.substring(startIndex, endIdx + endMarker.length);
}

const desktopStr = extractBetween(code, 'const renderDesktopLayout = () => {', '    };\n\n    const renderInteractionArea');
fs.writeFileSync('DesktopLayout_extracted.txt', desktopStr || 'NOT FOUND');

const mobileStr = extractBetween(code, 'const renderMobileLayout = () => {', '    };\n\n    return (');
fs.writeFileSync('MobileLayout_extracted.txt', mobileStr || 'NOT FOUND');

console.log("Done extracting");
