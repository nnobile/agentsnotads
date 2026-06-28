"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./liveramp.module.css";

type Mode = "product" | "competitive" | "scenario";
type Difficulty = "Beginner" | "Intermediate" | "Expert";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  articleCount: number;
  documentCount: number;
}

export default function LiveRampClient({ articleCount, documentCount }: Props) {
  const [activeTab, setActiveTab] = useState<Mode>("product");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate");
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [liveArticleCount, setLiveArticleCount] = useState(articleCount);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentMessage]);

  function resetSession() {
    setMessages([]);
    setCurrentMessage("");
    setSessionSummary(null);
    setSessionStarted(false);
    setInput("");
  }

  function handleTabChange(tab: Mode) {
    setActiveTab(tab);
    resetSession();
  }

  const streamChat = useCallback(
    async (msgs: Message[]) => {
      setStreaming(true);
      setCurrentMessage("");

      try {
        const res = await fetch("/api/admin/liveramp/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: activeTab,
            difficulty,
            topic: topic || undefined,
            messages: msgs,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setCurrentMessage(fullText);
        }

        const summaryMatch = fullText.match(
          /<session_summary>([\s\S]*?)<\/session_summary>/
        );
        const chatText = fullText
          .replace(/<session_summary>[\s\S]*?<\/session_summary>/, "")
          .trim();

        if (summaryMatch) {
          setSessionSummary(summaryMatch[1].trim());
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: chatText || fullText,
        };
        setMessages([...msgs, assistantMsg]);
        setCurrentMessage("");
      } catch {
        setMessages([
          ...msgs,
          {
            role: "assistant",
            content: "Error connecting to API. Please try again.",
          },
        ]);
        setCurrentMessage("");
      } finally {
        setStreaming(false);
      }
    },
    [activeTab, difficulty, topic]
  );

  async function startSession() {
    const kickoff: Message = { role: "user", content: "Begin." };
    setSessionStarted(true);
    setMessages([kickoff]);
    setSessionSummary(null);
    await streamChat([kickoff]);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInput("");
    await streamChat(updatedMsgs);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/admin/liveramp/refresh", { method: "POST" });
      const data = await res.json();
      setLastRefresh(new Date().toLocaleTimeString());
      if (data.error) {
        setRefreshResult(`Error: ${data.error}`);
      } else {
        const n = data.indexed ?? 0;
        setLiveArticleCount((prev) => prev + n);
        const errNote = data.errors?.length ? ` ${data.errors.length} error(s).` : "";
        setRefreshResult(`Indexed ${n} new item${n !== 1 ? "s" : ""}.${errNote}`);
      }
    } catch {
      setRefreshResult("Network error.");
    } finally {
      setRefreshing(false);
    }
  }

  const TAB_LABELS: Record<Mode, string> = {
    product: "Product Quiz",
    competitive: "Competitive",
    scenario: "Scenario",
  };

  const CHAT_HEADER_LABEL: Record<Mode, string> = {
    product: `Product Quiz — ${difficulty}${topic ? ` · ${topic}` : ""}`,
    competitive: "Competitive & Strategic",
    scenario: "Mock BD Scenario",
  };

  return (
    <div>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        {(["product", "competitive", "scenario"] as Mode[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => handleTabChange(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Chat card */}
      <div className={styles.chatCard}>
        {!sessionStarted ? (
          <SetupPanel
            mode={activeTab}
            difficulty={difficulty}
            topic={topic}
            onDifficultyChange={setDifficulty}
            onTopicChange={setTopic}
            onStart={startSession}
          />
        ) : (
          <>
            <div className={styles.chatHeader}>
              <span className={styles.chatHeaderLabel}>
                {CHAT_HEADER_LABEL[activeTab]}
              </span>
              <button className={styles.newSessionBtn} onClick={resetSession}>
                New Session
              </button>
            </div>

            <div className={styles.messages}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`${styles.message} ${
                    msg.role === "user"
                      ? styles.messageUser
                      : styles.messageAssistant
                  }`}
                >
                  <div className={styles.messageBubble}>{msg.content}</div>
                </div>
              ))}

              {streaming && currentMessage && (
                <div className={`${styles.message} ${styles.messageAssistant}`}>
                  <div className={styles.messageBubble}>{currentMessage}</div>
                </div>
              )}

              {streaming && !currentMessage && (
                <div className={`${styles.message} ${styles.messageAssistant}`}>
                  <div className={`${styles.messageBubble} ${styles.thinking}`}>
                    Thinking…
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className={styles.inputBar}>
              <textarea
                className={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
                rows={2}
                disabled={streaming}
              />
              <button
                className={styles.sendBtn}
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* Session summary card */}
      {sessionSummary && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Session Summary</div>
          <div className={styles.summaryContent}>{sessionSummary}</div>
        </div>
      )}

      {/* Knowledge base panel */}
      <div className={styles.kbPanel}>
        <button
          className={styles.kbToggle}
          onClick={() => setKbOpen((o) => !o)}
        >
          Knowledge Base {kbOpen ? "▲" : "▼"}
        </button>

        {kbOpen && (
          <div className={styles.kbContent}>
            <div className={styles.kbStats}>
              <span>{liveArticleCount} indexed articles</span>
              <span className={styles.kbDivider}>·</span>
              <span>{documentCount} uploaded documents</span>
              {lastRefresh && (
                <>
                  <span className={styles.kbDivider}>·</span>
                  <span>Last refreshed at {lastRefresh}</span>
                </>
              )}
            </div>

            <div className={styles.kbActions}>
              <button
                className={styles.refreshBtn}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh Content"}
              </button>
              {refreshResult && (
                <span className={styles.refreshResult}>{refreshResult}</span>
              )}
            </div>

            <div className={styles.uploadPlaceholder}>
              <label className={styles.uploadLabel}>
                Upload Document (PDF, TXT, DOCX)
              </label>
              <input
                type="file"
                accept=".pdf,.txt,.docx"
                className={styles.uploadInput}
                disabled
              />
              <span className={styles.uploadNote}>
                Upload endpoint coming in next session.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupPanel({
  mode,
  difficulty,
  topic,
  onDifficultyChange,
  onTopicChange,
  onStart,
}: {
  mode: Mode;
  difficulty: Difficulty;
  topic: string;
  onDifficultyChange: (d: Difficulty) => void;
  onTopicChange: (t: string) => void;
  onStart: () => void;
}) {
  const TITLES: Record<Mode, string> = {
    product: "Product Knowledge Quiz",
    competitive: "Competitive & Strategic",
    scenario: "Mock BD Scenario",
  };

  const DESCS: Record<Mode, string> = {
    product:
      "Test your LiveRamp product knowledge. Claude will ask one question at a time, evaluate your answers, and track weak areas across 10 questions.",
    competitive:
      "Sharpen your competitive positioning. Practice LiveRamp vs. Snowflake, Google PAIR, Amazon Marketing Cloud, and Epsilon CORE ID — plus the Gravity Theory of Data Trade.",
    scenario:
      "Practice real BD conversations. Claude will present realistic partner scenarios and coach you on your responses, flagging what a senior BD person would have said.",
  };

  return (
    <div className={styles.setupPanel}>
      <div className={styles.setupTitle}>{TITLES[mode]}</div>
      <div className={styles.setupDesc}>{DESCS[mode]}</div>

      {mode === "product" && (
        <>
          <div className={styles.setupRow}>
            <label className={styles.setupLabel}>Difficulty</label>
            <div className={styles.difficultyBtns}>
              {(["Beginner", "Intermediate", "Expert"] as Difficulty[]).map(
                (d) => (
                  <button
                    key={d}
                    className={`${styles.diffBtn} ${
                      difficulty === d ? styles.diffBtnActive : ""
                    }`}
                    onClick={() => onDifficultyChange(d)}
                  >
                    {d}
                  </button>
                )
              )}
            </div>
          </div>

          <div className={styles.setupRow}>
            <label className={styles.setupLabel}>Topic (optional)</label>
            <input
              className={styles.topicInput}
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="e.g. RampID, Safe Haven, Data Marketplace…"
            />
          </div>
        </>
      )}

      <button className={styles.startBtn} onClick={onStart}>
        Start Session →
      </button>
    </div>
  );
}
