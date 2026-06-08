/**
 * @codesage
 * @file      patch.js
 * @purpose   One-off script to patch LearnSessionPageClient.tsx to support responsive split grids
 * @tech      Node.js (fs)
 * @connects  Modifies src/app/learn/[slug]/LearnSessionPageClient.tsx
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/learn/[slug]/LearnSessionPageClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  `ChevronDown, ChevronUp, Lightbulb, AlertCircle, Loader2, Volume2, MicOff
} from 'lucide-react';`,
  `ChevronDown, ChevronUp, Lightbulb, AlertCircle, Loader2, Volume2, MicOff, MessageSquare
} from 'lucide-react';`
);

content = content.replace(
  `import { useUnifiedVoice } from '@/hooks/useUnifiedVoice';`,
  `import { useUnifiedVoice } from '@/hooks/useUnifiedVoice';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { cn } from '@/lib/utils';`
);

// 2. Add Hooks
content = content.replace(
  `const [codeExpanded, setCodeExpanded] = useState(true);`,
  `const [codeExpanded, setCodeExpanded] = useState(true);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileTab, setMobileTab] = useState<'problem' | 'chat'>('chat');
  
  const { handlers: swipeHandlers } = useSwipeNavigation({
      tabs: ['problem', 'chat'],
      activeTab: mobileTab,
      onTabChange: (tab) => setMobileTab(tab as 'problem' | 'chat'),
  });`
);

// 3. Main Sandbox split grid
// We need to extract the sections and wrap them
const problemAreaStart = content.indexOf('<section className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 relative">');
const problemAreaEndStr = `</section>\n              </ResizablePanel>`;
const problemAreaEnd = content.indexOf(problemAreaEndStr) + `</section>`.length;

const problemAreaCode = content.substring(problemAreaStart, problemAreaEnd);

const chatAreaStart = content.indexOf('<section className="h-full flex flex-col justify-between bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">');
const chatAreaEndStr = `</section>\n              </ResizablePanel>`;
const chatAreaEnd = content.indexOf(chatAreaEndStr) + `</section>`.length;

const chatAreaCode = content.substring(chatAreaStart, chatAreaEnd);

const newMainBlock = `      <main className="w-full flex-1 flex flex-col p-4 relative z-10 overflow-hidden h-full">
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
                <div className="flex-1 w-full h-full animate-in fade-in slide-in-from-left-4">
                  {renderProblemArea()}
                </div>
              )}
              {mobileTab === 'chat' && (
                <div className="flex-1 w-full h-full animate-in fade-in slide-in-from-right-4">
                  {renderChatArea()}
                </div>
              )}
            </div>
            
            <div
              role="tablist"
              className="absolute bottom-0 left-0 right-0 z-50 flex border-t"
              style={{
                background: '#09090d',
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

const renderFunctions = `  const renderProblemArea = () => (
    ${problemAreaCode.replace(/\n/g, '\n    ')}
  );

  const renderChatArea = () => (
    ${chatAreaCode.replace(/\n/g, '\n    ')}
  );

  if (!mounted) return null;`;

content = content.replace(`if (!mounted) return null;`, renderFunctions);

const mainStartStr = `      {/* Main Sandbox split grid */}\n      <main className="w-full flex-1 flex flex-col p-4 relative z-10 overflow-hidden h-full">`;
const mainEndStr = `</main>`;
const mainStart = content.indexOf(mainStartStr);
const mainEnd = content.indexOf(mainEndStr) + mainEndStr.length;

if (mainStart > -1 && mainEnd > -1) {
  content = content.substring(0, mainStart) + newMainBlock + content.substring(mainEnd);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully patched LearnSessionPageClient.tsx');
} else {
  console.log('Failed to find main block');
}
