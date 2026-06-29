"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./liveramp.module.css";

type Mode = "product" | "competitive" | "scenario";
type Difficulty = "Beginner" | "Intermediate" | "Expert";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResumeBanner {
  id: string;
  messages: Message[];
  updatedAt: string;
  difficulty: Difficulty;
  topic: string;
}

interface Props {
  articleCount: number;
  documentCount: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  const [resumeBanner, setResumeBanner] = useState<ResumeBanner | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [liveArticleCount, setLiveArticleCount] = useState(articleCount);
  const [liveDocumentCount, setLiveDocumentCount] = useState(documentCount);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  // Stored in a ref so streamChat's useCallback doesn't need it as a dep
  const sessionIdRef = useRef<string | null>(null);

  // Scroll to bottom whenever messages or the in-progress stream changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentMessage]);

  // On tab change, look for a recent session to offer resume
  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      try {
        const res = await fetch(`/api/admin/liveramp/session/${activeTab}`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.id) {
          setResumeBanner({
            id: data.id,
            messages: (data.messages ?? []) as Message[],
            updatedAt: data.updated_at,
            difficulty: (data.difficulty as Difficulty) ?? "Intermediate",
            topic: data.topic ?? "",
          });
        } else {
          setResumeBanner(null);
        }
      } catch {
        if (!cancelled) setResumeBanner(null);
      }
    }

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  function resetSession() {
    setMessages([]);
    setCurrentMessage("");
    setSessionSummary(null);
    setSessionStarted(false);
    setInput("");
    setResumeBanner(null);
    sessionIdRef.current = null;
  }

  function handleTabChange(tab: Mode) {
    setActiveTab(tab);
    resetSession();
  }

  function handleResume() {
    if (!resumeBanner) return;
    sessionIdRef.current = resumeBanner.id;
    setMessages(resumeBanner.messages);
    setDifficulty(resumeBanner.difficulty);
    setTopic(resumeBanner.topic);
    setSessionStarted(true);
    setResumeBanner(null);
  }

  function handleStartFresh() {
    setResumeBanner(null);
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
        const nextMessages = [...msgs, assistantMsg];
        setMessages(nextMessages);
        setCurrentMessage("");

        // Persist session — non-fatal if this fails
        try {
          const saveBody: {
            mode: Mode;
            difficulty: Difficulty;
            topic: string;
            messages: Message[];
            id?: string;
          } = { mode: activeTab, difficulty, topic, messages: nextMessages };
          if (sessionIdRef.current) saveBody.id = sessionIdRef.current;

          const saveRes = await fetch("/api/admin/liveramp/session/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saveBody),
          });
          if (saveRes.ok) {
            const saveData = await saveRes.json();
            if (saveData.id) sessionIdRef.current = saveData.id;
          }
        } catch {
          // Session save failure is non-fatal
        }
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
    setResumeBanner(null);
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadStatus(null);
  }

  async function handleUpload() {
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      const res = await fetch("/api/admin/liveramp/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUploadStatus({ success: false, message: data.error ?? "Upload failed." });
      } else {
        const note = data.note ? ` ${data.note}` : "";
        setUploadStatus({
          success: true,
          message: `Uploaded "${data.filename}".${note}`,
        });
        setLiveDocumentCount((prev) => prev + 1);
        setUploadFile(null);
        setFileInputKey((k) => k + 1);
      }
    } catch {
      setUploadStatus({ success: false, message: "Network error. Please try again." });
    } finally {
      setUploading(false);
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

      {/* Resume banner */}
      {resumeBanner && !sessionStarted && (
        <div className={styles.resumeBanner}>
          <span className={styles.resumeBannerText}>
            You have an unfinished {TAB_LABELS[activeTab]} session from{" "}
            {timeAgo(resumeBanner.updatedAt)}. Resume or start fresh?
          </span>
          <div className={styles.resumeBannerActions}>
            <button className={styles.resumeBtn} onClick={handleResume}>
              Resume
            </button>
            <button className={styles.startFreshBtn} onClick={handleStartFresh}>
              Start Fresh
            </button>
          </div>
        </div>
      )}

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
              <span>{liveDocumentCount} uploaded documents</span>
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

            <div className={styles.uploadSection}>
              <label className={styles.uploadLabel}>
                Upload Document (PDF, TXT, DOCX)
              </label>
              <input
                key={fileInputKey}
                type="file"
                accept=".pdf,.txt,.docx"
                className={styles.uploadInput}
                onChange={handleFileSelect}
              />
              {uploadFile && (
                <div className={styles.uploadFileRow}>
                  <span className={styles.uploadFileName}>{uploadFile.name}</span>
                  <button
                    className={styles.uploadBtn}
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>
              )}
              {uploadStatus && (
                <span
                  className={`${styles.uploadStatus} ${
                    uploadStatus.success
                      ? styles.uploadStatusSuccess
                      : styles.uploadStatusError
                  }`}
                >
                  {uploadStatus.message}
                </span>
              )}
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
