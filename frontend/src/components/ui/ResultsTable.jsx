import { useState } from 'react'
import { Download, ChevronUp, ChevronDown } from 'lucide-react'

function exportCSV(columns, rows) {
  const header = columns.join(',')
  const body = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'results.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function ResultsTable({ columns = [], rows = [], rowCount = 0, executionMs = 0 }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const PAGE = 50

  if (!columns.length) return null

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  let sorted = [...rows]
  if (sortCol !== null) {
    const idx = columns.indexOf(sortCol)
    sorted.sort((a, b) => {
      const av = a[idx], bv = b[idx]
      const n = (v) => isNaN(Number(v)) ? v : Number(v)
      return sortDir === 'asc' ? (n(av) > n(bv) ? 1 : -1) : (n(av) < n(bv) ? 1 : -1)
    })
  }

  const pages = Math.ceil(sorted.length / PAGE)
  const visible = sorted.slice(page * PAGE, (page + 1) * PAGE)

  return (
    <div>
      {/* Meta row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', gap:8 }}>
          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, fontWeight:600 }} className="badge-info">
            {rowCount} row{rowCount !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, fontWeight:600 }} className="badge-success">
            {executionMs}ms
          </span>
        </div>
        <button onClick={() => exportCSV(columns, rows)}
          style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)',
            padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)',
            transition:'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--lavender)'; e.currentTarget.style.color='var(--lavender)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)' }}>
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid var(--border)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'var(--bg3)' }}>
              {columns.map(col => (
                <th key={col}
                  onClick={() => handleSort(col)}
                  style={{ padding:'9px 13px', textAlign:'left', fontWeight:600, color:'var(--text2)',
                    cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
                    borderBottom:'1px solid var(--border)', fontSize:11,
                    textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    {col}
                    {sortCol === col
                      ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                      : <ChevronUp size={11} style={{ opacity:0.2 }} />
                    }
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg)' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--lavender-soft)'}
                onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding:'8px 13px', borderBottom:'1px solid var(--border)',
                    fontFamily: typeof cell === 'number' || !isNaN(Number(cell)) ? 'var(--mono)' : 'var(--font)',
                    maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    color: cell === null ? 'var(--text4)' : 'var(--text)' }}>
                    {cell === null ? 'NULL' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:10 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost"
            style={{ padding:'5px 12px', fontSize:12 }}>←</button>
          <span style={{ fontSize:12, color:'var(--text2)' }}>Page {page+1} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page === pages-1} className="btn-ghost"
            style={{ padding:'5px 12px', fontSize:12 }}>→</button>
        </div>
      )}
    </div>
  )
}
