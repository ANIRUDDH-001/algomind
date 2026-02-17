/**
 * verify-vad-setup.ts
 *
 * Quick smoke-test to verify that the VAD integration is wired up correctly.
 * Run with: npx tsx scripts/verify-vad-setup.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const green = (s: string) => `\x1b[32m✓ ${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m✗ ${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
    if (condition) {
        console.log(green(label));
        passed++;
    } else {
        console.log(red(label + (detail ? `  — ${detail}` : '')));
        failed++;
    }
}

// ---------------------------------------------------------------------------
// 1. Dependencies
// ---------------------------------------------------------------------------
console.log('\n── Dependencies ──────────────────────────────────────');

try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    check(
        '@ricky0123/vad-web in dependencies',
        !!pkg.dependencies?.['@ricky0123/vad-web']
    );
    check(
        'onnxruntime-web in dependencies',
        !!pkg.dependencies?.['onnxruntime-web']
    );
} catch {
    check('package.json readable', false, 'could not read package.json');
}

try {
    require.resolve('@ricky0123/vad-web');
    check('@ricky0123/vad-web installed (resolvable)', true);
} catch {
    check('@ricky0123/vad-web installed (resolvable)', false, 'run npm install');
}

try {
    require.resolve('onnxruntime-web');
    check('onnxruntime-web installed (resolvable)', true);
} catch {
    check('onnxruntime-web installed (resolvable)', false, 'run npm install');
}

// ---------------------------------------------------------------------------
// 2. Public assets
// ---------------------------------------------------------------------------
console.log('\n── Public Assets (public/vad/) ───────────────────────');

const requiredAssets = [
    'silero_vad_legacy.onnx',
    'silero_vad_v5.onnx',
    'vad.worklet.bundle.min.js',
    'ort.min.js',
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
];

const vadDir = path.join(ROOT, 'public', 'vad');
for (const asset of requiredAssets) {
    const exists = fs.existsSync(path.join(vadDir, asset));
    check(`public/vad/${asset}`, exists);
}

// ---------------------------------------------------------------------------
// 3. Source files
// ---------------------------------------------------------------------------
console.log('\n── Source Files ──────────────────────────────────────');

const sourceFiles = [
    'src/lib/voice/types.ts',
    'src/lib/voice/vad-manager.ts',
];

for (const file of sourceFiles) {
    const exists = fs.existsSync(path.join(ROOT, file));
    check(file, exists);
}

// ---------------------------------------------------------------------------
// 4. Type definitions file exports expected symbols
// ---------------------------------------------------------------------------
console.log('\n── Type Exports ─────────────────────────────────────');

const typesContent = (() => {
    try {
        return fs.readFileSync(path.join(ROOT, 'src/lib/voice/types.ts'), 'utf-8');
    } catch {
        return '';
    }
})();

const expectedExports = [
    'VADState',
    'VADConfig',
    'SpeechStartCallback',
    'SpeechEndCallback',
    'VADManagerInterface',
];

for (const sym of expectedExports) {
    check(`types.ts exports "${sym}"`, typesContent.includes(sym));
}

// ---------------------------------------------------------------------------
// 5. VAD manager exports expected symbols
// ---------------------------------------------------------------------------
console.log('\n── Manager Exports ──────────────────────────────────');

const managerContent = (() => {
    try {
        return fs.readFileSync(path.join(ROOT, 'src/lib/voice/vad-manager.ts'), 'utf-8');
    } catch {
        return '';
    }
})();

const managerSymbols = [
    'getVADManager',
    'resetVADManager',
    'init',
    'start',
    'stop',
    'onSpeechStart',
    'onSpeechEnd',
    'destroy',
];

for (const sym of managerSymbols) {
    check(`vad-manager.ts contains "${sym}"`, managerContent.includes(sym));
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log(red('Some checks failed. See above for details.'));
    process.exit(1);
} else {
    console.log(green('All checks passed! VAD setup looks good.'));
}
