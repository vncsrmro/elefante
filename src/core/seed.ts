import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { L } from '../shared/lang'
import type { Agent } from '../shared/types'
import type { Db } from './db'

// First run: a team of agents and the user's real project folders (or sample projects).
export function seed(db: Db): void {
  const agent = (a: Omit<Agent, 'id' | 'used' | 'grants' | 'memory' | 'computer' | 'archived'>): Agent => ({
    ...a,
    id: randomUUID(),
    used: 0,
    grants: {},
    memory: 'auto',
    computer: true,
    computerKind: 'mac',
    archived: false
  })
  const lia = agent({
    name: 'Lia',
    handle: 'lia',
    role: L('Engenharia', 'Engineering'),
    color: 'sky',
    instructions: L(
      'Ajuda com código, arquitetura e bugs diretamente na pasta do projeto. Explica o raciocínio em poucas linhas e mostra código quando ajuda.',
      'Helps with code, architecture and bugs directly in the project folder. Explains the reasoning in a few lines and shows code when it helps.'
    ),
    modelId: 'sonnet',
    effort: 'medium',
    limit: 3_000_000
  })
  const theo = agent({
    name: 'Theo',
    handle: 'theo',
    role: L('Dados & Backend', 'Data & Backend'),
    color: 'violet',
    instructions: L(
      'Responde perguntas sobre métricas, SQL, APIs e análise de dados. Mostra a query ou a conta que usou.',
      'Answers questions about metrics, SQL, APIs and data analysis. Shows the query or the math it used.'
    ),
    modelId: 'gpt-5.6-luna',
    effort: 'medium',
    limit: 2_000_000
  })
  const nina = agent({
    name: 'Nina',
    handle: 'nina',
    role: L('Produto & Copy', 'Product & Copy'),
    color: 'rose',
    instructions: L(
      'Escreve posts, landing pages, anúncios e textos no meu tom: leve, curto, sem jargão.',
      'Writes posts, landing pages, ads and copy in my tone: light, short, no jargon.'
    ),
    modelId: 'sonnet',
    effort: 'low',
    limit: 2_000_000
  })

  const realProjects: Array<{ name: string; path: string }> = [
    { name: 'Stival', path: 'E:\\romeiro.dev\\Stival' },
    { name: 'paperx', path: 'E:\\romeiro.dev\\PaperX\\paperx' },
    { name: 'CUQUI', path: 'E:\\romeiro.dev\\CUQUI' },
    { name: 'video-shield', path: 'C:\\Users\\vncs\\orca\\video-shield' },
    { name: 'IA LOCAL', path: 'D:\\IA LOCAL' },
    { name: 'Recebidos do Bem', path: 'E:\\romeiro.dev\\Recebidos do Bem' },
    { name: 'marcen', path: 'E:\\romeiro.dev\\MARCEN\\marcen' },
    { name: 'Verse-Haven', path: 'E:\\romeiro.dev\\VerseHaven\\Verse-Haven' },
    { name: 'Accanto', path: 'E:\\romeiro.dev\\Accanto' },
    { name: 'tapp.food', path: 'E:\\romeiro.dev\\Reels Food' },
    { name: 'Romeiro', path: 'E:\\romeiro.dev\\Romeiro' },
    { name: 'NATAL', path: 'E:\\romeiro.dev\\NATAL' },
    { name: 'sil', path: 'E:\\romeiro.dev\\sil' },
    { name: 'alemao', path: 'E:\\romeiro.dev\\alemao' },
    { name: 'REVERSE LIVE', path: 'E:\\romeiro.dev\\REVERSE LIVE' },
    { name: 'spy-inovasys', path: 'E:\\romeiro.dev\\InovaSys' }
  ]

  const foundProjects = realProjects.filter((p) => existsSync(p.path))

  db.tx(() => {
    for (const a of [lia, theo, nina]) db.saveAgent(a)
    if (foundProjects.length > 0 && process.env['ELEFANTE_FAKE_ENGINES'] !== '1') {
      for (const p of foundProjects) {
        db.createConversation({
          id: randomUUID(),
          kind: 'channel',
          name: p.name,
          project: p.path,
          topic: p.path,
          members: [lia.id, theo.id, nina.id]
        })
      }
    } else {
      db.createConversation({ id: randomUUID(), kind: 'channel', name: L('engenharia', 'engineering'), members: [lia.id, theo.id] })
      db.createConversation({ id: randomUUID(), kind: 'channel', name: L('dados', 'data'), members: [theo.id] })
      db.createConversation({ id: randomUUID(), kind: 'channel', name: L('conteudo', 'content'), members: [nina.id] })
    }
  })
}
