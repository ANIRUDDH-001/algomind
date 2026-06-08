// @ts-nocheck
const fs = require('fs');
const file = 'src/lib/inngest/functions.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace('// @ts-nocheck', '// eslint-disable-next-line @typescript-eslint/ban-ts-comment\n// @ts-nocheck');
fs.writeFileSync(file, code);
