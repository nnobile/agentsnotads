"use client";

import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import styles from "./liveramp.module.css";

// Zone 2 tab modes (tutor lives in Zone 1 and is not a tab)
type Mode = "product" | "competitive" | "scenario" | "study_guide";
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
  return `${Math.floor(hours / 24)}d ago`;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        )
      )}
    </>
  );
}

function StudyGuideContent({ text }: { text: string }) {
  const elements: ReactNode[] = [];
  const lines = text.split("\n");
  let listBuffer: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul${listKey++}`} className={styles.sgList}>
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={i} className={styles.sgH2}>
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={i} className={styles.sgH3}>
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.match(/^[-*] /)) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className={styles.sgP}>
          {renderInline(line)}
        </p>
      );
    }
  });

  flushList();
  return <div className={styles.sgDocument}>{elements}</div>;
}

export default function LiveRampClient({ articleCount, documentCount }: Props) {
  // ---- Zone 2: Study & Practice (quiz/scenario tabs) ----
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

  // ---- Zone 1: Tutor ----
  const [tutorMessages, setTutorMessages] = useState<Message[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorStreaming, setTutorStreaming] = useState(false);
  const [tutorCurrentMessage, setTutorCurrentMessage] = useState("");

  // ---- Study Guide ----
  const [studyGuide, setStudyGuide] = useState("");
  const [studyGuideStreaming, setStudyGuideStreaming] = useState(false);

  // ---- Knowledge Base ----
  const [kbOpen, setKbOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [liveArticleCount, setLiveArticleCount] = useState(articleCount);
  const [liveDocumentCount, setLiveDocumentCount] = useState(documentCount);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // ---- Refs ----
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tutorEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const tutorSessionIdRef = useRef<string | null>(null);

  // ---- Auto-scroll ----
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentMessage]);

  useEffect(() => {
    tutorEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tutorMessages, tutorCurrentMessage]);

  // ---- Load tutor session on mount (silent restore) ----
  useEffect(() => {
    async function loadTutorSession() {
      try {
        const res = await fetch("/api/admin/liveramp/session/tutor");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.id) {
          tutorSessionIdRef.current = data.id;
          setTutorMessages((data.messages ?? []) as Message[]);
        }
      } catch {
        // Silently ignore
      }
    }
    loadTutorSession();
  }, []);

  // ---- Load study guide from localStorage on mount ----
  useEffect(() => {
    try {
      const cached = localStorage.getItem("liveramp_study_guide");
      if (cached) setStudyGuide(cached);
    } catch {
      // localStorage not available
    }
  }, []);

  // ---- Fetch quiz session on tab change ----
  useEffect(() => {
    // Study Guide uses localStorage, not DB sessions
    if (activeTab === "study_guide") return;

    let cancelled = false;

    async function fetchSession() {
      try {
        const res = await fetch(`/api/admin/liveramp/session/${activeTab}`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setResumeBanner(
          data?.id
            ? {
                id: data.id,
                messages: (data.messages ?? []) as Message[],
                updatedAt: data.updated_at,
                difficulty: (data.difficulty as Difficulty) ?? "Intermediate",
                topic: data.topic ?? "",
              }
            : null
        );
      } catch {
        if (!cancelled) setResumeBanner(null);
      }
    }

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // ---- Quiz session helpers ----
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

  // ---- Quiz streaming ----
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

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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

        if (summaryMatch) setSessionSummary(summaryMatch[1].trim());

        const assistantMsg: Message = {
          role: "assistant",
          content: chatText || fullText,
        };
        const nextMessages = [...msgs, assistantMsg];
        setMessages(nextMessages);
        setCurrentMessage("");

        // Persist session (non-fatal)
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
          // Non-fatal
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

  // ---- Tutor streaming ----
  async function streamTutor(msgs: Message[]) {
    setTutorStreaming(true);
    setTutorCurrentMessage("");

    try {
      const res = await fetch("/api/admin/liveramp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tutor", messages: msgs }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setTutorCurrentMessage(fullText);
      }

      const assistantMsg: Message = { role: "assistant", content: fullText };
      const nextMessages = [...msgs, assistantMsg];
      setTutorMessages(nextMessages);
      setTutorCurrentMessage("");

      // Persist session (non-fatal)
      try {
        const saveBody: { mode: string; messages: Message[]; id?: string } = {
          mode: "tutor",
          messages: nextMessages,
        };
        if (tutorSessionIdRef.current) saveBody.id = tutorSessionIdRef.current;

        const saveRes = await fetch("/api/admin/liveramp/session/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (saveRes.ok) {
          const saveData = await saveRes.json();
          if (saveData.id) tutorSessionIdRef.current = saveData.id;
        }
      } catch {
        // Non-fatal
      }
    } catch {
      setTutorMessages([
        ...msgs,
        {
          role: "assistant",
          content: "Error connecting to API. Please try again.",
        },
      ]);
      setTutorCurrentMessage("");
    } finally {
      setTutorStreaming(false);
    }
  }

  async function sendTutorMessage() {
    const text = tutorInput.trim();
    if (!text || tutorStreaming) return;
    const userMsg: Message = { role: "user", content: text };
    const updatedMsgs = [...tutorMessages, userMsg];
    setTutorMessages(updatedMsgs);
    setTutorInput("");
    await streamTutor(updatedMsgs);
  }

  function handleTutorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTutorMessage();
    }
  }

  function clearTutor() {
    setTutorMessages([]);
    setTutorCurrentMessage("");
    tutorSessionIdRef.current = null;
  }

  // ---- Study Guide generation ----
  async function generateStudyGuide() {
    setStudyGuideStreaming(true);
    setStudyGuide(""); // clear so loading state shows

    try {
      const res = await fetch("/api/admin/liveramp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "study_guide",
          messages: [{ role: "user", content: "Generate the study guide." }],
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setStudyGuide(fullText);
      }

      try {
        localStorage.setItem("liveramp_study_guide", fullText);
      } catch {
        // localStorage not available
      }
    } catch {
      setStudyGuide("Error generating study guide. Please try again.");
    } finally {
      setStudyGuideStreaming(false);
    }
  }

  // ---- Knowledge Base ----
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
        setUploadStatus({
          success: false,
          message: data.error ?? "Upload failed.",
        });
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
      setUploadStatus({
        success: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/admin/liveramp/refresh", {
        method: "POST",
      });
      const data = await res.json();
      setLastRefresh(new Date().toLocaleTimeString());
      if (data.error) {
        setRefreshResult(`Error: ${data.error}`);
      } else {
        const n = data.indexed ?? 0;
        setLiveArticleCount((prev) => prev + n);
        const errNote = data.errors?.length
          ? ` ${data.errors.length} error(s).`
          : "";
        setRefreshResult(
          `Indexed ${n} new item${n !== 1 ? "s" : ""}.${errNote}`
        );
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
    study_guide: "Study Guide",
  };

  const CHAT_HEADER_LABEL: Record<Mode, string> = {
    product: `Product Quiz — ${difficulty}${topic ? ` · ${topic}` : ""}`,
    competitive: "Competitive & Strategic",
    scenario: "Mock BD Scenario",
    study_guide: "Study Guide",
  };

  return (
    <div>
      {/* ---- Zone 1: Tutor ---- */}
      <div className={styles.zone1}>
        <div className={styles.zone1Header}>
          <div className={styles.zone1TitleGroup}>
            <span className={styles.zone1Title}>LiveRamp Tutor</span>
            <span className={styles.zone1Subtitle}>
              Ask anything — your always-on LiveRamp expert.
            </span>
          </div>
          {tutorMessages.length > 0 && (
            <button className={styles.zone1ClearBtn} onClick={clearTutor}>
              Clear conversation
            </button>
          )}
        </div>

        <div className={styles.zone1Messages}>
          {tutorMessages.length === 0 && !tutorStreaming && (
            <div className={styles.zone1Empty}>
              Ask a question to get started…
            </div>
          )}

          {tutorMessages.map((msg, i) => (
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

          {tutorStreaming && tutorCurrentMessage && (
            <div className={`${styles.message} ${styles.messageAssistant}`}>
              <div className={styles.messageBubble}>{tutorCurrentMessage}</div>
            </div>
          )}

          {tutorStreaming && !tutorCurrentMessage && (
            <div className={`${styles.message} ${styles.messageAssistant}`}>
              <div className={`${styles.messageBubble} ${styles.thinking}`}>
                Thinking…
              </div>
            </div>
          )}

          <div ref={tutorEndRef} />
        </div>

        <div className={styles.zone1InputBar}>
          <textarea
            className={styles.input}
            value={tutorInput}
            onChange={(e) => setTutorInput(e.target.value)}
            onKeyDown={handleTutorKeyDown}
            placeholder="Ask anything about LiveRamp… (Enter to send)"
            rows={2}
            disabled={tutorStreaming}
          />
          <button
            className={styles.sendBtn}
            onClick={sendTutorMessage}
            disabled={tutorStreaming || !tutorInput.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* ---- Zone 2: Study & Practice ---- */}

      {/* Tab bar */}
      <div className={styles.tabBar}>
        {(
          ["product", "competitive", "scenario", "study_guide"] as Mode[]
        ).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${
              activeTab === tab ? styles.tabActive : ""
            }`}
            onClick={() => handleTabChange(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Resume banner (quiz modes only) */}
      {resumeBanner && !sessionStarted && activeTab !== "study_guide" && (
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

      {/* Chat card / Study Guide */}
      <div className={styles.chatCard}>
        {activeTab === "study_guide" ? (
          studyGuideStreaming && !studyGuide ? (
            <div className={styles.sgGenerating}>Generating study guide…</div>
          ) : !studyGuide && !studyGuideStreaming ? (
            <div className={styles.sgEmpty}>
              <div className={styles.sgEmptyTitle}>Generate Study Guide</div>
              <div className={styles.sgEmptyDesc}>
                Creates a structured reference doc from your knowledge base
              </div>
              <button
                className={styles.sgGenerateBtn}
                onClick={generateStudyGuide}
                disabled={studyGuideStreaming}
              >
                Generate Study Guide
              </button>
            </div>
          ) : (
            <>
              <div className={styles.sgDocHeader}>
                {studyGuideStreaming ? (
                  <span className={styles.sgStreamingNote}>Generating…</span>
                ) : (
                  <button
                    className={styles.sgRegenerateBtn}
                    onClick={generateStudyGuide}
                  >
                    Regenerate
                  </button>
                )}
              </div>
              <StudyGuideContent text={studyGuide} />
            </>
          )
        ) : !sessionStarted ? (
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
                <div
                  className={`${styles.message} ${styles.messageAssistant}`}
                >
                  <div className={styles.messageBubble}>{currentMessage}</div>
                </div>
              )}

              {streaming && !currentMessage && (
                <div
                  className={`${styles.message} ${styles.messageAssistant}`}
                >
                  <div
                    className={`${styles.messageBubble} ${styles.thinking}`}
                  >
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

      {/* Session summary card (quiz modes only) */}
      {sessionSummary && activeTab !== "study_guide" && (
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
                  <span className={styles.uploadFileName}>
                    {uploadFile.name}
                  </span>
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
    study_guide: "",
  };

  const DESCS: Record<Mode, string> = {
    product:
      "Test your LiveRamp product knowledge. Claude will ask one question at a time, evaluate your answers, and track weak areas across 10 questions.",
    competitive:
      "Sharpen your competitive positioning. Practice LiveRamp vs. Snowflake, Google PAIR, Amazon Marketing Cloud, and Epsilon CORE ID — plus the Gravity Theory of Data Trade.",
    scenario:
      "Practice real BD conversations. Claude will present realistic partner scenarios and coach you on your responses, flagging what a senior BD person would have said.",
    study_guide: "",
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
