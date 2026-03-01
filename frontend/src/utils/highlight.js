const KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|AS|AND|OR|NOT|IN|LIKE|IS|NULL|COUNT|SUM|AVG|MIN|MAX|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|EXISTS|BETWEEN|ASC|DESC|INTO|VALUES|SET|BY|REFERENCES|PRIMARY|KEY|FOREIGN|DEFAULT|CONSTRAINT)\b/gi

export function highlightSQL(sql) {
  if (!sql) return ''

  return sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(--[^\n]*)/g, '<span style="color:var(--sql-comment)">$1</span>')
    .replace(/'([^']*)'/g, '<span style="color:var(--sql-string)">\'$1\'</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:var(--sql-number)">$1</span>')
    .replace(KEYWORDS, (m) => `<span style="color:var(--sql-keyword);font-weight:600">${m.toUpperCase()}</span>`)
}
