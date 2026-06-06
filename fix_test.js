const fs = require('fs');
let code = fs.readFileSync('src/app/learn/[slug]/__tests__/voice-fallback-state-machine.test.tsx', 'utf8');

// Replace the old mocks with useUnifiedVoice mock
const oldMocks = /vi\.mock\('@\/hooks\/useTTS'[\s\S]*vi\.mock\('@\/hooks\/useVAD'[^;]+;\n}\)\);/m;
const newMock = `vi.mock('@/hooks/useUnifiedVoice', () => ({
  useUnifiedVoice: () => ({
    state: mockSttListening ? 'listening' : 'idle',
    vadMode: mockVadMode,
    transcript: 'hello from mic',
    interimTranscript: '',
    start: startListeningMock,
    stop: stopListeningMock,
    resetTranscript: vi.fn(),
    speak: vi.fn(),
  }),
}));`;

code = code.replace(oldMocks, newMock);
fs.writeFileSync('src/app/learn/[slug]/__tests__/voice-fallback-state-machine.test.tsx', code);
