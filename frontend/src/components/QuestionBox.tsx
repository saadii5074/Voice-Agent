// ─────────────────────────────────────────────────────────────────────────────
//  QuestionBox.tsx — Q&A input placeholders for future AI integration
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { HelpCircle as MessageCircleQuestion, Send, Sparkles, Lock } from 'lucide-react';
import type { SessionStatus } from '../types';

interface Props {
  sessionStatus: SessionStatus;
  transcriptCount: number;
}

interface QAEntry {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

const PLACEHOLDER_ANSWERS: Record<string, string> = {
  default: 'AI Q&A will be available once a backend language model is connected.',
  noSession: 'Start a live session first to enable Q&A.',
  noTranscript: 'Waiting for transcript data before answering questions.',
};

export const QuestionBox: React.FC<Props> = ({ sessionStatus, transcriptCount }) => {
  const [questions, setQuestions] = useState<QAEntry[]>([]);
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');

  const isIdle = sessionStatus === 'idle' || sessionStatus === 'stopped' || sessionStatus === 'error';
  const hasTranscript = transcriptCount > 0;

  const getAnswer = (): string => {
    if (isIdle) return PLACEHOLDER_ANSWERS.noSession;
    if (!hasTranscript) return PLACEHOLDER_ANSWERS.noTranscript;
    return PLACEHOLDER_ANSWERS.default;
  };

  const submitQuestion = (question: string, clearFn: () => void) => {
    if (!question.trim()) return;
    const entry: QAEntry = {
      id: `${Date.now()}`,
      question: question.trim(),
      answer: getAnswer(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setQuestions((prev) => [entry, ...prev].slice(0, 6));
    clearFn();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Sparkles size={14} color="var(--primary)" />
        <span style={styles.headerTitle}>AI Q&A</span>
        <span style={styles.comingSoon}>Coming Soon</span>
      </div>

      <div style={styles.body}>
        {/* Status notice */}
        {!hasTranscript && (
          <div style={styles.notice}>
            <Lock size={11} color="var(--text-muted)" />
            <span style={styles.noticeText}>
              {isIdle
                ? 'Start a session to enable Q&A'
                : 'Waiting for transcript to enable Q&A'}
            </span>
          </div>
        )}

        {/* Input 1 */}
        <div style={styles.inputGroup}>
          <div style={styles.inputWrapper}>
            <MessageCircleQuestion size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              style={styles.input}
              placeholder="Ask about the session..."
              value={input1}
              onChange={(e) => setInput1(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuestion(input1, () => setInput1(''));
              }}
            />
            <button
              style={styles.sendBtn}
              onClick={() => submitQuestion(input1, () => setInput1(''))}
              disabled={!input1.trim()}
              title="Send"
            >
              <Send size={12} />
            </button>
          </div>
        </div>

        {/* Input 2 */}
        <div style={styles.inputGroup}>
          <div style={styles.inputWrapper}>
            <MessageCircleQuestion size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              style={styles.input}
              placeholder="Ask a follow-up question..."
              value={input2}
              onChange={(e) => setInput2(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuestion(input2, () => setInput2(''));
              }}
            />
            <button
              style={styles.sendBtn}
              onClick={() => submitQuestion(input2, () => setInput2(''))}
              disabled={!input2.trim()}
              title="Send"
            >
              <Send size={12} />
            </button>
          </div>
        </div>

        {/* Q&A history */}
        {questions.length > 0 && (
          <div style={styles.qaList}>
            {questions.map((qa) => (
              <div key={qa.id} style={styles.qaEntry}>
                <div style={styles.qaQuestion}>
                  <span style={styles.qaQLabel}>Q</span>
                  <span style={styles.qaQuestionText}>{qa.question}</span>
                  <span style={styles.qaTime}>{qa.timestamp}</span>
                </div>
                <div style={styles.qaAnswer}>
                  <span style={styles.qaALabel}>A</span>
                  <span style={styles.qaAnswerText}>{qa.answer}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Placeholder when no questions */}
        {questions.length === 0 && (
          <div style={styles.emptyQA}>
            <p style={styles.emptyText}>
              Ask questions about who said what, key topics, or speaker summaries.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
  },
  comingSoon: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: 'rgba(99,102,241,0.15)',
    color: 'var(--primary)',
    padding: '2px 7px',
    borderRadius: '4px',
    border: '1px solid rgba(99,102,241,0.3)',
  },
  body: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
  },
  noticeText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    transition: 'border-color var(--transition)',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontFamily: 'var(--font)',
    minWidth: 0,
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity var(--transition)',
    opacity: 1,
  },
  qaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  qaEntry: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    animation: 'slide-in-up 0.2s ease',
  },
  qaQuestion: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
  },
  qaQLabel: {
    fontSize: '10px',
    fontWeight: 800,
    color: 'var(--primary)',
    background: 'rgba(99,102,241,0.15)',
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qaQuestionText: {
    fontSize: '11px',
    color: 'var(--text-primary)',
    flex: 1,
  },
  qaTime: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  qaAnswer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
  },
  qaALabel: {
    fontSize: '10px',
    fontWeight: 800,
    color: 'var(--success)',
    background: 'rgba(34,197,94,0.12)',
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qaAnswerText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  emptyQA: {
    padding: '4px 2px',
  },
  emptyText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    margin: 0,
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
};

export default QuestionBox;
