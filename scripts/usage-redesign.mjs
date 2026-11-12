import fs from 'node:fs'
const edit=(p,fn)=>fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')))
const base='src/renderer/src/components/'
edit(base+'Usage.tsx',s=>{
 s=s.replace("L('Uso e limites', 'Usage and limits')","L('Consumo', 'Usage')")
 s=s.replace(/  const limit = agents\.filter\(isTeam\).*\n  const usedPct = .*\n/,'')
 s=s.replace(/          \{usedPct !== undefined && \([\s\S]*?\n          \)\}/,'')
 const start=s.indexOf('function Agents('),end=s.indexOf('const percent =',start)
 return s.slice(0,start)+`function Agents({ u }: { u: UsageReport }): ReactNode {
  const agents = useStore((s) => s.agents.filter(isTeam))
  const stats = new Map(u.who.map(w => [w.id, w]))
  const total = agents.reduce((sum, a) => sum + (stats.get(a.id)?.tokens ?? 0), 0)
  const sorted = [...agents].sort((a, b) => (stats.get(b.id)?.tokens ?? 0) - (stats.get(a.id)?.tokens ?? 0))
  if (!agents.length) return null
  return <section className="read-group"><h2>{L('Por agente', 'By agent')}<span>{L('Consumo registrado neste mês. As barras mostram a participação no uso do time.', 'Recorded usage this month. Bars show each agent’s share of team usage.')}</span></h2>
    <div className="usage-agents">{sorted.map(a => {
      const row = stats.get(a.id)
      const used = row?.tokens ?? 0
      const share = total > 0 ? used / total : 0
      const model = modelInfo(a.modelId)
      return <button className="usage-agent" key={a.id} onClick={() => navigate({ kind: 'agent', id: a.id })}>
        <AgentAvatar agent={a} size={30} />
        <span className="usage-agent__who"><strong>{a.name}</strong><span className="muted small truncate">{model?.label ?? a.modelId} · {row?.replies ?? 0} {L('respostas', 'replies')}</span></span>
        <span className="usage-agent__meter"><span className="usage-meter"><span className="usage-meter__fill" style={{ width: (share * 100) + '%' }} /></span><span className="muted small">{used ? percent(share) + ' ' + L('do consumo do time', 'of team usage') : L('Sem uso neste mês', 'No usage this month')}</span></span>
        <span className="usage-agent__nums"><strong>{tokens(used)}</strong><span className="muted small">{L('tokens no mês', 'tokens this month')}</span></span><Icon name="chevron" size={14} />
      </button>
    })}</div>
  </section>
}

`+s.slice(end)
})
edit(base+'StatusBar.tsx',s=>s.replace('isTeam, navigate','navigate').replace(/  const teamLimit = .*\n  const usedPct = .*\n/,'').replace(/<strong>\{formatTokens\(totalTokens\)\}.*?<\/strong>/,'<strong>{formatTokens(totalTokens)} {L(\'tokens no mês\', \'tokens this month\')}</strong>').replace(/^.*\{usedPct !== undefined &&.*\n/gm,'').replace("L('Limites internos do Elefante', 'Elefante internal limits')","L('Consumo registrado no mês', 'Recorded usage this month')").replace(/<div>\{formatTokens\(totalTokens\)\} \/.*?<\/div>/,'<div>{formatTokens(totalTokens)} tokens · {usageData?.replies ?? 0} {L(\'respostas\', \'replies\')}</div>'))
edit(base+'Pages.tsx',s=>s.replace('tokens, UsageBar','tokens').replace(/<span className="muted">\{L\(`de \$\{tokens\(draft.limit\)\} tokens`, `of \$\{tokens\(draft.limit\)\} tokens`\)\}<\/span>/,'<span className="muted">tokens</span>').replace(/\s*<UsageBar used=\{draft.used\} limit=\{draft.limit\} \/>/,'').replace("<Field label={L('Limite mensal (milhões de tokens)', 'Monthly limit (millions of tokens)')}","<details className=\"usage-advanced\"><summary>{L('Controle avançado de execução', 'Advanced execution control')}</summary><Field label={L('Teto interno mensal (milhões de tokens)', 'Internal monthly cap (millions of tokens)')}").replace('className="input--short"\n                  />\n                </Field>\n              </div>\n            </Card>','className="input--short"\n                  />\n                </Field></details>\n              </div>\n            </Card>'))
edit(base+'Sidebar.tsx',s=>s.replace(/  const pct = agent.limit.*\n/,'').replace(/^.*\{pct >= 0.8 &&.*\n/gm,''))
