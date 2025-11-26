"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const HISTORY_KEY = "ria.history.v2";
const MAX_TURNS = 20; // user+assistant 合計（=10往復）

export default function Page() {
  const [history, setHistory] = useState<Turn[]>([
    { role: "assistant", content: "こんにちは。リアです。ご用件を教えてください。" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const lastAssistant = useMemo(
    () => [...history].reverse().find((t) => t.role === "assistant")?.content ?? "",
    [history]
  );

  // 初回ロード：localStorage から復元
  useEffect(() => {
    try {
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h));
    } catch { }
  }, []);

  // 変更を保存
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { }
  }, [history]);

  // 自動スクロール
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [history, loading]);

  function trimHistory(list: Turn[]): Turn[] {
    if (list.length <= MAX_TURNS) return list;
    return list.slice(list.length - MAX_TURNS);
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");

    const nextHistory = trimHistory([...history, { role: "user", content: msg }]);
    setHistory(nextHistory);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory, userMessage: msg }),
      });

      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      const reply = (data.reply as string) || "(応答なし)";
      await typeReply(reply);
    } catch {
      // API が未実装でも壊れないようフォールバック
      await typeReply("（サンプル応答）了解しました。続けてどうぞ。");
    } finally {
      setLoading(false);
    }
  }

  // タイプライター風に控えめなアニメ表示
  async function typeReply(text: string) {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    setHistory((h) => trimHistory([...h, { role: "assistant", content: "" }]));
    for (let i = 0; i < text.length; i++) {
      await sleep(12);
      const slice = text.slice(0, i + 1);
      setHistory((h) => {
        const newH = [...h];
        for (let j = newH.length - 1; j >= 0; j--) {
          if (newH[j].role === "assistant") {
            newH[j] = { ...newH[j], content: slice };
            break;
          }
        }
        return newH;
      });
    }
  }

  // Enter は改行のみ。Cmd/Ctrl+Enterで送信
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
    const submit = (isMac ? e.metaKey : e.ctrlKey) && e.key === "Enter";
    if (submit) {
      e.preventDefault();
      send();
    }
  }

  // ====== 音声まわり（最小実装：Web Speech + SpeechSynthesis） ======
  // 録音機能は削除されました
  // 読み上げ機能も削除されました

  // ====== 会話履歴クリア ======
  function clearHistory() {
    const ok = confirm("会話履歴をすべて消去します。よろしいですか？");
    if (!ok) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch { }
    setHistory([{ role: "assistant", content: "こんにちは。リアです。ご用件を教えてください。" }]);
    setInput("");
  }



  return (
    <main className="h-dvh max-h-dvh w-full flex flex-col sm:flex-row overflow-hidden text-slate-800 relative">
      {/* 背景（共通）：スマホはここでRiaを表示、PCは左カラムで表示するためここは背景色/画像のみでも良いが、
          既存の背景(Layout側)があるので、ここはRiaの配置制御が主 */}

      {/* === Mobile: 背景にRiaを表示 === */}
      <div className="sm:hidden fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <img
          src="/ria_.png"
          alt="Ria"
          className="opacity-80 object-contain w-full max-w-none translate-y-[10%]"
        />
      </div>

      {/* === Desktop: 左側カラム (Ria表示エリア) === */}
      <div className="hidden sm:flex w-1/2 h-full items-end justify-center relative z-0 pl-8 pb-8">
        <img
          src="/ria_.png"
          alt="Ria"
          className="
            object-contain
            max-h-[90vh]
            w-auto
            drop-shadow-xl
          "
        />
      </div>

      {/* === Right Side (Chat Area) === 
          Mobile: 全画面 / Desktop: 右半分
      */}
      <div className="flex-1 h-full flex flex-col relative z-10 w-full sm:w-1/2 sm:bg-white/10 sm:backdrop-blur-sm">

        {/* 上部ヘッダー */}
        <header className="shrink-0 z-20">
          <div className="h-12 sm:h-16 flex items-center justify-between px-4 sm:px-8 bg-black/10 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none">
            <span className="text-white sm:text-slate-700 text-base sm:text-xl font-bold tracking-wide drop-shadow-sm sm:drop-shadow-none">
              Ria
            </span>
            <button
              onClick={clearHistory}
              className="rounded-full px-3 py-1.5 text-xs sm:text-sm text-white bg-rose-500/80 hover:bg-rose-500 shadow-sm transition-transform active:scale-95"
              title="会話履歴をすべて削除"
            >
              履歴クリア
            </button>
          </div>
        </header>

        {/* メッセージ領域 */}
        <div className="flex-1 flex flex-col relative min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
            <div className="flex flex-col gap-4 pb-4 mx-auto max-w-2xl w-full">
              {history.map((t, i) => (
                <div key={i} className={`flex flex-col ${t.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <div
                      className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${t.role === "assistant"
                          ? "bg-sky-500 text-white"
                          : "bg-orange-400 text-white"
                        }`}
                    >
                      {t.role === "assistant" ? "Ria" : "You"}
                    </div>
                  </div>
                  <div
                    className={`fade-in max-w-[85%] rounded-2xl px-5 py-3 shadow-sm text-slate-800 leading-relaxed ${t.role === 'assistant'
                        ? 'bg-white/90 backdrop-blur rounded-tl-none border border-white/60'
                        : 'bg-sky-100/95 backdrop-blur rounded-tr-none border border-sky-200/60'
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{t.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse px-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span>Ria is typing...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 入力バー */}
        <div className="shrink-0 z-20 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-2xl">
            <div className="rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-lg p-2 flex items-end gap-2 transition-all focus-within:ring-2 ring-sky-300/50 focus-within:bg-white/80">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="メッセージを入力..."
                className="flex-1 bg-transparent border-none px-4 py-3 outline-none resize-none text-slate-800 placeholder-slate-500 min-h-[48px] max-h-[120px]"
                style={{ fieldSizing: "content" } as any}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="shrink-0 rounded-full w-12 h-12 flex items-center justify-center bg-sky-500 text-white shadow-md hover:bg-sky-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 translate-x-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-slate-500/80">Cmd/Ctrl + Enter で送信</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}