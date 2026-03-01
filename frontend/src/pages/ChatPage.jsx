import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Database, Plus, Trash2, ChevronRight, Settings, X, Eye, EyeOff, Pencil, Check } from 'lucide-react'
import { useStore } from '../store'
import ChatMessage from '../components/ui/ChatMessage'

const EXAMPLES = [
  "Top 10 customers by total spending",
  "Monthly revenue for last 6 months",
  "Products low on stock (< 10 units)",
  "Average order value by customer tier",
  "Most reviewed products",
  "Customers who haven't ordered in 90 days",
]

export default function ChatPage() {
  const {
    sessions, activeSessionId, fetchSessions, createSession, deleteSession,
    renameSession, setActiveSession, histories, fetchHistory, ask, loading, groqApiKey, setGroqApiKey,
  } = useStore()

  const [question, setQuestion] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [connStr, setConnStr] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const history = activeSessionId ? (histories[activeSessionId] || []) : []

  useEffect(() => {
    fetchSessions().then(async (sess) => {
      if (sess.length === 0) {
        const s = await createSession('demo')
        fetchHistory(s.id)
      } else if (!activeSessionId) {
        setActiveSession(sess[0].id)
        fetchHistory(sess[0].id)
      } else {
        const current = sess.find(s => s.id === activeSessionId)
        if (current) fetchHistory(activeSessionId)
      }
    })
  }, [])

  useEffect(() => {
    if (activeSessionId) fetchHistory(activeSessionId)
  }, [activeSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  const handleAsk = async (q = question) => {
    if (!q.trim() || !activeSessionId || loading) return
    setQuestion('')
    await ask(activeSessionId, q.trim())
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() }
  }

  const handleCreateSession = async (mode) => {
    setCreating(true); setCreateError('')
    try {
      const s = await createSession(mode, mode === 'real' ? connStr : undefined)
      setShowNewModal(false); setConnStr('')
      fetchHistory(s.id)
    } catch (e) { setCreateError(e.message) }
    finally { setCreating(false) }
  }

  const hasKey = !!groqApiKey

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #C4B5FD, #A78BFA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(167,139,250,0.3)',
            }}>
              <Database size={15} color="#fff" />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>SQLChat</p>
              <p style={{ fontSize: 10, color: 'var(--text3)' }}>Ask your database</p>
            </div>
          </div>
          <button onClick={() => setShowNewModal(true)}
            className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', fontSize: 12 }}>
            <Plus size={13} /> New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
          {sessions.map(s => (
            <div key={s.id}
              onClick={() => setActiveSession(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 9, marginBottom: 2,
                cursor: 'pointer', transition: 'all 0.12s',
                background: s.id === activeSessionId ? 'var(--lavender-soft)' : 'transparent',
                border: `1px solid ${s.id === activeSessionId ? 'rgba(124,111,205,0.2)' : 'transparent'}`,
              }}
              onMouseEnter={e => { if (s.id !== activeSessionId) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (s.id !== activeSessionId) e.currentTarget.style.background = 'transparent' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: s.mode === 'demo' ? 'var(--lavender-soft)' : 'var(--mint-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Database size={11} style={{ color: s.mode === 'demo' ? 'var(--lavender)' : 'var(--mint)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === s.id ? (
                  <input autoFocus value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => { renameSession(s.id, renameVal); setRenamingId(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { renameSession(s.id, renameVal); setRenamingId(null) } }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '100%', fontSize: 12, background: 'transparent', border: 'none',
                      borderBottom: '1px solid var(--lavender)', padding: '1px 0', color: 'var(--text)'
                    }} />
                ) : (
                  <p style={{
                    fontSize: 12, fontWeight: s.id === activeSessionId ? 600 : 400,
                    color: s.id === activeSessionId ? 'var(--lavender)' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {s.name}
                  </p>
                )}
                <p style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {s.mode === 'demo' ? '✦ demo' : `⚡ ${s.db_type || 'real db'}`}
                </p>
              </div>
              {s.id === activeSessionId && (
                <div style={{ display: 'flex', gap: 2 }}>
                  <button onClick={e => { e.stopPropagation(); setRenamingId(s.id); setRenameVal(s.name) }}
                    style={{ padding: 4, color: 'var(--text3)', borderRadius: 5, transition: 'color 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--lavender)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                    style={{ padding: 4, color: 'var(--text3)', borderRadius: 5, transition: 'color 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--rose)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>



      </aside>

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>{activeSession?.name || 'SQLChat'}</p>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>
              {activeSession?.mode === 'demo'
                ? 'Demo: e-commerce DB (customers, orders, products, reviews)'
                : `Connected: ${activeSession?.db_type || 'database'}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}
              className={activeSession?.mode === 'demo' ? 'badge-info' : 'badge-success'}>
              {activeSession?.mode === 'demo' ? '✦ Demo Mode' : '⚡ Live DB'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px 0' }}>
          {history.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(167,139,250,0.2)',
              }}>
                <Sparkles size={24} style={{ color: 'var(--lavender)' }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ask anything about your data</h2>
              <p style={{ color: 'var(--text3)', marginBottom: 28, fontSize: 13 }}>
                {activeSession?.mode === 'demo'
                  ? 'Try one of these examples or type your own question'
                  : 'Your database is connected — ask in plain English'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600, margin: '0 auto' }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => handleAsk(ex)}
                    style={{
                      padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      color: 'var(--text2)', cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-soft)'; e.currentTarget.style.borderColor = 'var(--lavender)'; e.currentTarget.style.color = 'var(--lavender)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}>
                    <ChevronRight size={11} /> {ex}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {history.map((item, i) => (
            <ChatMessage key={item.id} item={item} sessionId={activeSessionId} index={i} />
          ))}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <div style={{ background: 'var(--lavender)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '10px 16px', opacity: 0.7, fontSize: 14 }}>
                  {question || '...'}
                </div>
              </div>
              <div className="card" style={{ padding: 16, maxWidth: '80%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)' }}>
                  <div style={{ width: 14, height: 14, border: '2px solid var(--lavender)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Generating SQL…</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: 'var(--bg3)', border: '1.5px solid var(--border)',
            borderRadius: 14, padding: '10px 14px', transition: 'border-color 0.15s',
            boxShadow: 'var(--shadow-sm)'
          }}
            onFocus={() => { }} >
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question in plain English… (Enter to send)"
              disabled={loading}
              rows={1}
              style={{
                flex: 1, resize: 'none', background: 'transparent', border: 'none',
                fontSize: 14, lineHeight: 1.5, color: 'var(--text)', maxHeight: 120,
                overflow: 'auto',
              }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            />
            <button onClick={() => handleAsk()} disabled={!question.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: question.trim() && !loading ? 'linear-gradient(135deg, var(--lavender), var(--lavender2))' : 'var(--bg4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: question.trim() && !loading ? '0 2px 10px var(--lavender-glow)' : 'none',
              }}>
              <Send size={14} style={{ color: question.trim() && !loading ? '#fff' : 'var(--text4)' }} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text4)', marginTop: 7, textAlign: 'center' }}>
            Shift+Enter for new line · results capped at 500 rows
          </p>
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNewModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(45,38,84,0.4)', zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18,
                padding: 28, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>New Chat</h3>
                <button onClick={() => setShowNewModal(false)} style={{ color: 'var(--text3)' }}><X size={16} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { mode: 'demo', icon: '✦', title: 'Demo Database', desc: 'E-commerce data, ready instantly', color: 'var(--lavender)' },
                  { mode: 'real', icon: '⚡', title: 'Real Database', desc: 'Connect your own PostgreSQL or SQLite', color: 'var(--mint)' },
                ].map(opt => (
                  <button key={opt.mode}
                    onClick={() => opt.mode === 'demo' && handleCreateSession('demo')}
                    style={{
                      padding: '16px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                      background: 'var(--bg3)', border: `1.5px solid var(--border)`,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = opt.color; e.currentTarget.style.background = `${opt.color}0F` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg3)' }}>
                    <p style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</p>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: opt.color }}>{opt.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Real DB connection */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                  PostgreSQL / SQLite connection string
                </label>
                <input className="input" value={connStr} onChange={e => setConnStr(e.target.value)}
                  placeholder="postgresql://user:pass@localhost:5432/mydb" />
                {createError && <p style={{ fontSize: 12, color: 'var(--rose)', marginTop: 6 }}>{createError}</p>}
                <button onClick={() => handleCreateSession('real')} disabled={!connStr.trim() || creating}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
                  {creating ? 'Connecting…' : 'Connect & Start Chat'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
