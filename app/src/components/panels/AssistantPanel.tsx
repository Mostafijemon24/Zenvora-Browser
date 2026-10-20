import { useEffect, useRef, useState } from 'react';
import { useBrowser } from '../../state/browser';

const QUICK: [string, string][] = [
  ['Summarize', 'Summarize this page'],
  ['Compare tabs', 'Compare the shared pages'],
  ['Explain code', 'Explain the code on this page'],
  ['Translate', 'Translate the selection'],
];

export function AssistantPanel() {
  const b = useBrowser();
  const { chat, thinking } = b.assistant;
  const [input, setInput] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const n = b.sharedTabs.length;

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [chat.length, thinking]);

  const send = async (text: string) => {
    if (text.trim() && !thinking) setInput('');
    await b.ask(text);
  };

  return (
    <div className="ai">
      <div className="ai-share">
        <div className="caps">Pages shared with Assistant</div>
        <div className="chips">
          {b.shareable.map((t) => {
            const on = b.isShared(t);
            return (
              <button
                key={t.id}
                type="button"
                className={on ? 'share-chip on' : 'share-chip'}
                title={t.title}
                aria-pressed={on}
                onClick={() => b.toggleShare(t)}
              >
                <span>{t.title}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ai-chat" ref={log} aria-live="polite">
        {chat.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'msg user' : m.error ? 'msg error' : 'msg'}>
            {m.text}
          </div>
        ))}
        {thinking && (
          <div className="thinking">
            Reading {n} {n === 1 ? 'page' : 'pages'} …{' '}
          </div>
        )}
      </div>
      <div className="ai-quick">
        {QUICK.map(([label, prompt]) => (
          <button key={label} type="button" onClick={() => send(prompt)}>
            {label}
          </button>
        ))}
      </div>
      <div className="ai-input-wrap">
        <div className="ai-input">
          <input
            aria-label="Ask about shared pages"
            value={input}
            placeholder="Ask about shared pages…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
          />
          <button type="button" onClick={() => send(input)}>
            Send
          </button>
        </div>
        <div className="note">
          {b.aiConnected ? (
            <>Provider: {b.assistantService.providerLabel}, through your assistant server. </>
          ) : (
            <>Not connected: add your assistant server in Settings → AI & automation. </>
          )}
          Only the shared pages' visible text is sent — never passwords, cookies or form fields.
        </div>
      </div>
    </div>
  );
}
