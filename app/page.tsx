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
  const [listening, setListening] = useState(false);
  const [speakingEnabled, setSpeakingEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);

  function ensureRecognition() {
    if (recognitionRef.current) return recognitionRef.current;
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    return rec;
  }

  async function toggleListening() {
    const rec = ensureRecognition();
    if (!rec) {
      alert("このブラウザは音声認識APIに対応していません。Chrome系をご利用ください。");
      return;
    }
    if (!listening) {
      rec.onresult = (e: any) => {
        let finalText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
        }
        if (finalText.trim()) {
          setInput(finalText);
          send();
        }
      };
      rec.onend = () => {
        setListening(false);
      };
      try { rec.start(); } catch { }
      setListening(true);
    } else {
      try { rec.stop(); } catch { }
      setListening(false);
    }
  }

  // ====== 会話履歴クリア ======
  function clearHistory() {
    const ok = confirm("会話履歴をすべて消去します。よろしいですか？");
    if (!ok) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch { }
    setHistory([{ role: "assistant", content: "こんにちは。リアです。ご用件を教えてください。" }]);
    setInput("");
  }

  // ====== アシスタントの返答を自動読み上げ（最小TTS） ======
  useEffect(() => {
    if (!speakingEnabled) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    const last = [...history].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(last.content);
    u.lang = "ja-JP";
    u.rate = 1.0;
    u.pitch = 1.05;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
  }, [history, speakingEnabled]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-start p-0 sm:p-8 text-slate-800 relative">
      {/* 上部ヘッダー（エミリー先生風の半透明バー） */}
      <header className="fixed top-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-screen-2xl">
          <div className="h-12 sm:h-14 bg-black/25 backdrop-blur-md flex items-center justify-center relative px-3">
            <span className="text-white text-base sm:text-lg font-semibold tracking-wide">Ria</span>
            <div className="absolute right-2 flex items-center gap-2">
              <button
                onClick={toggleListening}
                className="rounded-full px-3 py-1.5 text-xs sm:text-sm text-white/90 bg-sky-500/70 hover:bg-sky-500 active:scale-[0.99]"
              >
                <span>{listening ? "録音停止" : "録音開始"}</span>
              </button>
              <button
                onClick={() => setSpeakingEnabled((v) => !v)}
                className="rounded-full px-3 py-1.5 text-xs sm:text-sm text-white/90 bg-emerald-500/70 hover:bg-emerald-500 active:scale-[0.99]"
              >
                <span>{speakingEnabled ? "読み上げON" : "読み上げOFF"}</span>
              </button>
              <button
                onClick={clearHistory}
                className="rounded-full px-3 py-1.5 text-xs sm:text-sm text-white/90 bg-rose-500/70 hover:bg-rose-500 active:scale-[0.99]"
                title="会話履歴をすべて削除"
              >
                履歴クリア
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* ヘッダー分のスペーサー（重なり防止） */}
      <div className="h-12 sm:h-14" />

      {/* 中央のリア画像（/public/ria_.png） */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <img
          src="/ria_.png"
          alt="Ria"
          className="w-[800px] max-w-[90vw] opacity-80 object-contain translate-y-[10%]"
        />
      </div>

      {/* メッセージ領域 */}
      <div className="flex-1 w-full max-w-3xl z-10 flex flex-col relative">
        {/* 履歴表示 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-0 scroll-smooth">
          <div className="flex flex-col gap-4 pb-4 pt-2">
            {history.map((t, i) => (
              <div key={i} className={`flex flex-col ${t.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <div
                    className={`text-xs font-medium text-white px-2.5 py-[2px] rounded-full shadow-sm ${t.role === "assistant" ? "bg-sky-400" : "bg-orange-400"
                      }`}
                  >
                    {t.role === "assistant" ? "リア" : "あなた"}
                  </div>
                </div>
                <div
                  className={`fade-in max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-slate-800 ${t.role === 'assistant'
                      ? 'bg-white/80 backdrop-blur-md rounded-tl-none border border-white/50'
                      : 'bg-sky-100/90 backdrop-blur-md rounded-tr-none border border-sky-200/50'
                    }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{t.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-slate-600 text-sm animate-pulse px-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 入力バー（中央下・やや小さめの丸み） */}
      <div className="sticky bottom-0 w-full">
        <div className="mx-auto w-full max-w-xl px-3 pb-3">
          <div className="rounded-full border border-white/30 bg-white/45 backdrop-blur-md shadow-lg p-2 text-slate-800">
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="メッセージを入力（Cmd/Ctrl + Enter で送信）"
                className="flex-1 rounded-full bg-white/35 border border-white/30 px-4 py-3 outline-none focus:ring-2 ring-sky-300/60 resize-none text-slate-800 placeholder-gray-500"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="shrink-0 rounded-full px-5 py-2 bg-sky-500 text-white shadow hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}