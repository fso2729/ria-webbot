"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const HISTORY_KEY = "ria.history.v1";
const MAX_TURNS = 20; // user+assistant 合計（=10往復）

export default function Page() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
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
    scrollToBottom();
  }, [history, loading]);

  function scrollToBottom() {
    // キーボードが出ている時も確実に最下部へ
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

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
      const data = await res.json();
      const reply = (data.reply as string) || "(no reply)";
      await typeReply(reply);
    } catch {
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content:
            "……ごめんなさい、通信が不安定みたいです。少し待ってから、もう一度試してもらえますか？",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // タイプライター風アニメーション（静か・控えめ）
  async function typeReply(text: string) {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    setHistory((h) => trimHistory([...h, { role: "assistant", content: "" }]));
    for (let i = 0; i < text.length; i++) {
      await sleep(16); // 速さ調整はここ（小さい=速い）
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

  // Enter は改行のみ。Cmd/Ctrl + Enter で送信
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const submit = (isMac ? e.metaKey : e.ctrlKey) && e.key === "Enter";
    if (submit) {
      e.preventDefault();
      send();
    }
  }

  // iOSのキーボードで隠れないように、フォーカス時に下までスクロール
  function handleFocus() {
    setTimeout(scrollToBottom, 100);
  }

  function clearChat() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
    setTimeout(scrollToBottom, 0);
  }

  async function copyLast() {
    if (!lastAssistant) return;
    try {
      await navigator.clipboard.writeText(lastAssistant);
    } catch {}
  }

  return (
    <main
      ref={rootRef}
      className="min-h-dvh bg-gradient-to-b from-sky-50 to-white text-slate-800 flex flex-col overscroll-contain"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)", // iOS セーフエリア
      }}
    >
      {/* ヘッダー */}
      <header className="px-4 pt-6 pb-3 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">リア</h1>
        <button
          onClick={clearChat}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 active:scale-[0.99] transition"
          title="履歴をクリア"
        >
          クリア
        </button>
      </header>

      {/* メッセージスクロール領域 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 pb-24" // pb-24: 下のコンポーザーぶん余白
      >
        <div className="mx-auto max-w-3xl">
          <div className="space-y-4">
            {history.map((t, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div
                  className={`mt-1 shrink-0 h-8 w-8 rounded-full grid place-items-center text-white ${
                    t.role === "assistant" ? "bg-sky-500" : "bg-slate-400"
                  }`}
                >
                  {t.role === "assistant" ? "R" : "You"}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2 leading-relaxed whitespace-pre-wrap ${
                    t.role === "assistant" ? "bg-white/90 border" : "bg-slate-100"
                  }`}
                >
                  {t.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-slate-400 text-sm">リアが考えています……</div>
            )}
          </div>
        </div>
      </div>

      {/* 入力コンポーザー（画面下に固定） */}
      <div
        ref={composerRef}
        className="sticky bottom-0 w-full border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-2">
          <div className="flex flex-col gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              rows={3}
              className="w-full rounded-xl border px-3 py-2 sm:py-2.5 outline-none focus:ring-2 focus:ring-sky-200 resize-y"
              placeholder="Cmd/Ctrl + Enterで送信。Enterは改行です／リアに話しかける…"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="flex-1 sm:flex-none sm:w-auto rounded-xl bg-sky-500 px-4 py-3 sm:py-2 text-white hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50"
              >
                送信
              </button>
              <button
                onClick={copyLast}
                disabled={!lastAssistant}
                className="rounded-xl border px-4 py-3 sm:py-2 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.99]"
                title="最後の返答をコピー"
              >
                最後の返答をコピー
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}