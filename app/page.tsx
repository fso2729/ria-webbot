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
    } catch {}
  }, []);

  // 変更を保存
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
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
      try { rec.start(); } catch {}
      setListening(true);
    } else {
      try { rec.stop(); } catch {}
      setListening(false);
    }
  }

  // ====== 会話履歴クリア ======
  function clearHistory() {
    const ok = confirm("会話履歴をすべて消去します。よろしいですか？");
    if (!ok) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
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
    <main className="min-h-dvh flex flex-col items-center justify-start p-6 sm:p-8 text-slate-800 relative">
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
      <img
        src="/ria_.png"
        alt="Ria"
        aria-hidden
        className="pointer-events-none select-none absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 w-[620px] max-w-[45vw] opacity-100 z-0"
      />

      {/* メッセージ領域（カード枠なしで背景に直接積む） */}
      <div className="mt-6 w-full max-w-4xl px-2 sm:px-3 flex flex-col items-center sm:items-start pl-[0] ml-0 sm:ml-[-110%] relative">
        {/* 読みやすさ向上のための左サイド淡いグラデ（背景と同化） */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-full sm:w-[600px] sm:max-w-[56%] z-0 rounded-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(4px)",
          }}
        />
        {/* チャット専用カラム（右側に安全地帯を確保するため固定幅） */}
        <div className="relative z-10 w-full max-w-[600px] sm:w-[590px] sm:max-w-[56%]">
          {/* 履歴表示 */}
          <div ref={scrollRef} className="max-h-[75vh] min-h-[40vh] overflow-y-auto pb-14 pt-10 sm:pt-28">
            <div className="flex flex-col gap-3">
              {history.map((t, i) => (
                <div key={i} className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1 ml-0.5 -mt-0.5">
                    <div
                      className={`text-xs font-medium text-white px-2.5 py-[2px] rounded-full shadow-sm ${
                        t.role === "assistant" ? "bg-sky-400" : "bg-orange-400"
                      }`}
                    >
                      {t.role === "assistant" ? "リア" : "あなた"}
                    </div>
                  </div>
                  <div
                    className="fade-in max-w-full rounded-3xl px-4 py-2 bg-white/50 backdrop-blur-lg border border-white/40 shadow-md text-slate-800"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed sm:leading-7">{t.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-slate-600 text-sm animate-pulse">リアが考えています…</div>
              )}
            </div>
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