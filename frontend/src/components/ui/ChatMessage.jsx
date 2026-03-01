import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, Check, Play, AlertCircle, Lightbulb } from 'lucide-react'
import { highlightSQL } from '../../utils/highlight'
import ResultsTable from './ResultsTable'
import { useStore } from '../../store'

export default function ChatMessage({ item, sessionId, index }) {
  const [copied, setCopied] = useState(false)
  const [sqlOpen, setSqlOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedSQL, setEditedSQL] = useState(item.sql || '')
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)
  const { runSQL } = useStore()

  const copySQL = async () => {
    await navigator.clipboard.writeText(item.sql || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      const result = await runSQL(sessionId, editedSQL)
      setRunResult(result)
    } finally { setRunning(false) }
  }

  const displayCols = runResult ? runResult.columns : item.result_columns || []
  const displayRows = runResult ? runResult.rows : item.result_rows || []
  const displayCount = runResult ? runResult.row_count : item.row_count || 0
  const displayMs = runResult ? runResult.execution_ms : item.execution_ms || 0
  const displayError = runResult ? runResult.error : item.error

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{ marginBottom: 20 }}
    >
      {/* Question bubble */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--lavender), var(--lavender2))',
          color:'#fff', borderRadius:'16px 16px 4px 16px',
          padding:'10px 16px', maxWidth:'80%', fontSize:14, lineHeight:1.5,
          boxShadow:'0 2px 12px var(--lavender-glow)',
        }}>
          {item.question}
        </div>
      </div>

      {/* Response card */}
      <div style={{ maxWidth:'95%' }}>
        {/* SQL block */}
        {item.sql && (
          <div className="card" style={{ marginBottom:10, overflow:'hidden' }}>
            {/* SQL header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 14px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--lavender)' }} />
                <span style={{ fontSize:11,fontWeight:700,color:'var(--lavender)',
                  textTransform:'uppercase',letterSpacing:'0.06em' }}>Generated SQL</span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={copySQL} style={{ display:'flex',alignItems:'center',gap:5,
                  fontSize:11,color:'var(--text3)',padding:'4px 8px',borderRadius:6,
                  background:'var(--bg2)',border:'1px solid var(--border)',transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--lavender)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                  {copied ? <Check size={11} style={{color:'var(--mint)'}} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => { setEditing(e=>!e); setEditedSQL(item.sql) }}
                  style={{ fontSize:11,color:'var(--text3)',padding:'4px 8px',borderRadius:6,
                    background:'var(--bg2)',border:'1px solid var(--border)',transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--peach)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                  Edit
                </button>
                <button onClick={() => setSqlOpen(o=>!o)} style={{ color:'var(--text3)', padding:'4px' }}>
                  {sqlOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
              </div>
            </div>

            {sqlOpen && (
              editing ? (
                <div style={{ padding:14 }}>
                  <textarea value={editedSQL} onChange={e=>setEditedSQL(e.target.value)}
                    style={{ width:'100%',minHeight:80,background:'var(--bg3)',border:'1.5px solid var(--lavender)',
                      borderRadius:8,padding:'10px 12px',fontFamily:'var(--mono)',fontSize:12,
                      color:'var(--text)',lineHeight:1.6,resize:'vertical' }} />
                  <div style={{ display:'flex',gap:8,marginTop:8 }}>
                    <button onClick={handleRun} disabled={running} className="btn-primary"
                      style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,padding:'7px 14px' }}>
                      <Play size={11}/>
                      {running ? 'Running…' : 'Run'}
                    </button>
                    <button onClick={()=>setEditing(false)} className="btn-ghost" style={{fontSize:12,padding:'7px 12px'}}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding:14 }}>
                  <pre style={{ fontFamily:'var(--mono)',fontSize:12,lineHeight:1.7,
                    color:'var(--text)',overflow:'auto',whiteSpace:'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: highlightSQL(item.sql) }} />
                </div>
              )
            )}
          </div>
        )}

        {/* Explanation */}
        {item.explanation && (
          <div style={{ display:'flex',alignItems:'flex-start',gap:8,
            padding:'10px 14px',marginBottom:10,
            background:'var(--yellow-soft)',border:'1px solid rgba(255,209,102,0.3)',
            borderRadius:10,fontSize:13,color:'var(--text2)' }}>
            <Lightbulb size={14} style={{color:'var(--yellow)',marginTop:1,flexShrink:0}} />
            {item.explanation}
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div style={{ display:'flex',alignItems:'flex-start',gap:8,
            padding:'10px 14px',marginBottom:10,
            background:'var(--rose-soft)',border:'1px solid rgba(232,124,138,0.3)',
            borderRadius:10,fontSize:13,color:'var(--rose)' }}>
            <AlertCircle size={14} style={{marginTop:1,flexShrink:0}} />
            <div>
              <p style={{fontWeight:600,marginBottom:3}}>Query Error</p>
              <p style={{fontFamily:'var(--mono)',fontSize:11}}>{displayError}</p>
            </div>
          </div>
        )}

        {/* Results table */}
        {displayCols.length > 0 && (
          <ResultsTable columns={displayCols} rows={displayRows}
            rowCount={displayCount} executionMs={displayMs} />
        )}

        {/* Re-run result */}
        {runResult && !runResult.error && runResult.columns.length > 0 && (
          <div style={{marginTop:6,fontSize:11,color:'var(--mint)'}}>✓ Re-ran with edited SQL</div>
        )}
      </div>
    </motion.div>
  )
}
