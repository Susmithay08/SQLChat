import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const API = '/api'

export const useStore = create(
  persist(
    (set, get) => ({
      // Settings
      groqApiKey: '',
      setGroqApiKey: (k) => set({ groqApiKey: k }),

      // Sessions
      sessions: [],
      activeSessionId: null,
      fetchSessions: async () => {
        const r = await fetch(`${API}/sessions`)
        const data = await r.json()
        set({ sessions: data })
        return data
      },
      createSession: async (mode, connectionString) => {
        const r = await fetch(`${API}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: mode === 'demo' ? 'Demo Chat' : 'Real DB Chat', mode, connection_string: connectionString }),
        })
        if (!r.ok) {
          const err = await r.json()
          throw new Error(err.detail || 'Failed to create session')
        }
        const data = await r.json()
        set(s => ({ sessions: [data, ...s.sessions], activeSessionId: data.id }))
        return data
      },
      deleteSession: async (id) => {
        await fetch(`${API}/sessions/${id}`, { method: 'DELETE' })
        set(s => {
          const sessions = s.sessions.filter(x => x.id !== id)
          const activeSessionId = s.activeSessionId === id ? (sessions[0]?.id ?? null) : s.activeSessionId
          return { sessions, activeSessionId }
        })
      },
      renameSession: async (id, name) => {
        await fetch(`${API}/sessions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        set(s => ({ sessions: s.sessions.map(x => x.id === id ? { ...x, name } : x) }))
      },
      setActiveSession: (id) => set({ activeSessionId: id }),

      // Query history per session
      histories: {},   // sessionId -> QueryItem[]
      loading: false,

      fetchHistory: async (sessionId) => {
        const r = await fetch(`${API}/sessions/${sessionId}/history`)
        const data = await r.json()
        set(s => ({ histories: { ...s.histories, [sessionId]: data } }))
        return data
      },

      ask: async (sessionId, question) => {
        set({ loading: true })
        const { groqApiKey } = get()
        try {
          const r = await fetch(`${API}/query/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, question, groq_api_key: groqApiKey || undefined }),
          })
          const data = await r.json()
          if (!r.ok) throw new Error(data.detail || 'Query failed')
          set(s => ({
            histories: {
              ...s.histories,
              [sessionId]: [...(s.histories[sessionId] || []), data],
            },
          }))
          return data
        } finally {
          set({ loading: false })
        }
      },

      runSQL: async (sessionId, sql) => {
        const r = await fetch(`${API}/query/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, sql }),
        })
        return r.json()
      },
    }),
    {
      name: 'sqlchat-store',
      partialState: (s) => ({ groqApiKey: s.groqApiKey }),
    }
  )
)
