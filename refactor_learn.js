const fs = require('fs');

const file = 'src/app/learn/[slug]/LearnSessionPageClient.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// 1. Add imports
const lucideLine = lines.findIndex(l => l.includes("from 'lucide-react'"));
if (lucideLine > -1) {
  lines[lucideLine - 1] = lines[lucideLine - 1].replace('MicOff', 'MicOff, MessageSquare');
}

const voiceImport = lines.findIndex(l => l.includes("import { useUnifiedVoice }"));
if (voiceImport > -1) {
  lines.splice(voiceImport + 1, 0, 
    "import { useMediaQuery } from '@/hooks/use-media-query';",
    "import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';",
    "import { cn } from '@/lib/utils';"
  );
}

// 2. Add hooks
const mountedState = lines.findIndex(l => l.includes("const [codeExpanded"));
if (mountedState > -1) {
  lines.splice(mountedState + 1, 0,
    "",
    "  const isDesktop = useMediaQuery('(min-width: 1024px)');",
    "  const [mobileTab, setMobileTab] = useState<'problem' | 'chat'>('chat');",
    "  const { handlers: swipeHandlers } = useSwipeNavigation({",
    "      tabs: ['problem', 'chat'],",
    "      activeTab: mobileTab,",
    "      onTabChange: (tab) => setMobileTab(tab as 'problem' | 'chat'),",
    "  });"
  );
}

// 3. Extract the sections
const mainStart = lines.findIndex(l => l.includes('<main className="w-full flex-1'));
const mainEnd = lines.findIndex(l => l.trim() === '</main>');

if (mainStart > -1 && mainEnd > -1) {
  // Find problem section
  const probStart = lines.findIndex((l, i) => i > mainStart && l.includes('<section className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 relative">'));
  const probEnd = lines.findIndex((l, i) => i > probStart && l.trim() === '</section>');
  
  // Find chat section
  const chatStart = lines.findIndex((l, i) => i > mainStart && l.includes('<section className="h-full flex flex-col justify-between bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">'));
  const chatEnd = lines.findIndex((l, i) => i > chatStart && l.trim() === '</section>');

  const probCode = lines.slice(probStart, probEnd + 1).join('\n');
  const chatCode = lines.slice(chatStart, chatEnd + 1).join('\n');

  // Replace <main> block
  const newMain = `      <main className={cn("w-full flex-1 flex flex-col relative z-10 overflow-hidden", isDesktop ? "p-4 h-full" : "h-full")}>
        {isDesktop ? (
          <ResizablePanelGroup direction="horizontal" className="h-full w-full gap-4">
              <ResizablePanel defaultSize={33} minSize={20}>
                  {renderProblemArea()}
              </ResizablePanel>
              <ResizableHandle className="bg-transparent w-2" />
              <ResizablePanel defaultSize={67} minSize={40}>
                  {renderChatArea()}
              </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div 
            className="flex-1 w-full h-full relative" 
            {...swipeHandlers} 
            style={{ touchAction: 'pan-y' }}
          >
            <div className="absolute inset-0 flex flex-col overflow-hidden pb-14">
              {mobileTab === 'problem' && (
                <div className="flex-1 w-full h-full overflow-y-auto p-4 animate-in fade-in slide-in-from-left-4">
                  {renderProblemArea()}
                </div>
              )}
              {mobileTab === 'chat' && (
                <div className="flex-1 w-full h-full p-2 animate-in fade-in slide-in-from-right-4">
                  {renderChatArea()}
                </div>
              )}
            </div>
            
            <div
              role="tablist"
              className="absolute bottom-0 left-0 right-0 z-50 flex border-t"
              style={{
                background: 'var(--surface-1, #09090d)',
                borderColor: 'var(--surface-edge, #27272a)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)'
              }}
            >
              {[
                { id: 'problem', label: 'Problem', icon: BookOpen },
                { id: 'chat', label: 'Chat', icon: MessageSquare },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMobileTab(id as 'problem' | 'chat')}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all text-[10px] font-bold uppercase tracking-wider",
                    mobileTab === id ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className={cn("w-5 h-5 transition-all", mobileTab === id ? "text-indigo-400" : "text-zinc-500")} />
                  <span>{label}</span>
                  {mobileTab === id && <div className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>`;

  lines.splice(mainStart, mainEnd - mainStart + 1, newMain);

  // Add the render functions right before `if (!mounted) return null;`
  const renderIndex = lines.findIndex(l => l.includes('if (!mounted) return null;'));
  if (renderIndex > -1) {
    const renderFns = `  const renderProblemArea = () => (\n${probCode}\n  );\n\n  const renderChatArea = () => (\n${chatCode}\n  );\n`;
    lines.splice(renderIndex, 0, renderFns);
  }
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Done refactoring!');
