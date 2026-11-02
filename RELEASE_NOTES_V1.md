# Elefante v1.0.0 — Notas de Lançamento / Release Notes

> **Desenvolvido por Vinicius Romeiro**  
> *Soberania de dados, multi-agência nativa e desenvolvimento acelerado com inteligência artificial.*

---

## 🇧🇷 Português

Temos o orgulho de anunciar o lançamento oficial do **Elefante v1.0.0** — o orquestrador soberano de agentes de IA criado para desenvolvedores, fundadores e equipes de alta performance. 

O Elefante une a conveniência de squads multidisciplinares de inteligência artificial à segurança da execução 100% local ou em servidor próprio, com controle absoluto de dados, custos e credenciais.

---

### Principais Novidades da Versão 1.0.0

#### 1. Painel Lateral Direito: Explorador de Arquivos & Editor de Código com Abas e Estilo Terminal
- **Visualização Completa do Projeto (Estilo Orca/IDE):** Navegue diretamente pela árvore de pastas e arquivos do projeto vinculado sem sair do chat.
- **Editor Terminal em Abas com Syntax Highlighting:** Abra múltiplos arquivos de código simultaneamente em abas com cabeçalho de terminal (🔴 🟡 🟢), numeração de linhas, realce sintático colorido de palavras-chave, tipos, strings, números, comandos e comentários.
- **Modos Flexíveis de Visualização e Edição:** Alterne entre modo de visualização com syntax highlighting (duplo-clique para editar) e edição direta rápida.
- **Atalhos Produtivos:** Salve arquivos com `Ctrl+S`, feche abas abertas no editor com `Ctrl+W` (sem fechar o aplicativo), e saia do modo edição com `Esc`.
- **Visualizador de Imagens & Mídias:** Previews integrados de imagens (`.png`, `.jpg`, `.webp`, `.svg`).
- **Ponte com IDE Externa:** Botão rápido "VS Code" para abrir qualquer arquivo ou pasta diretamente no editor do sistema operacional.

#### 2. Barra Inferior Permanente de Status & Métricas 100% Genuínas
- **Monitoramento em Tempo Real no Rodapé:** Inspirada em consoles modernos de engenharia, a barra inferior resume:
  - Consumo real de tokens e custos em USD a partir do banco de dados local;
  - Status real do DeepSeek: exibe o estado de conexão e permite configurar diretamente a chave de API ou endpoint local;
  - Otimizador RTK (Rust Token Killer) interativo: status real (`Ativo` / `Desativado`) clicável para alternar o filtro de compressão no terminal;
  - Status e contagem de CLIs autenticadas (ex.: 5/24 CLIs);
  - Status dos provedores ativos e rotinas em execução;
  - Alerta de aprovações de segurança pendentes;
  - Atalho rápido para alternar o painel de arquivos (`Ctrl+B`).

#### 3. Central de CLIs & Contas na Nuvem
- **Painel Unificado:** Monitore e gerencie o status de autenticação das **24+ ferramentas de CLI** mais essenciais do ecossistema moderno:
  - **Versionamento & Deploy:** GitHub CLI (`gh`), Vercel (`vercel`), Cloudflare (`cf`/`wrangler`), Railway, Fly.io, Netlify, Render, Heroku.
  - **Banco de Dados & Backend:** Supabase, Firebase, Neon, Prisma, Turso, PocketBase.
  - **Nuvem & Infra:** AWS CLI, Google Cloud (`gcloud`), Azure CLI, Docker, Terraform.
  - **Monitoramento & Pagamentos:** Stripe, Sentry, Datadog, Resend.
- **Badges de Contexto no Chat:** As conversas agora exibem chips visuais imediatos indicando quais CLIs essenciais da stack estão conectadas e autenticadas.
- **Login Instantâneo:** Inicie fluxos de autenticação direta no terminal com um único clique.

#### 2. Arquitetura Folder-First & Squads Multi-Agente
- Cada canal ou DM é contextualizado a uma pasta raiz ou subprojeto do seu disco rígido.
- Seus agentes navegam na árvore de arquivos, rodam testes, geram diffs e submetem commits git com branches isoladas.
- Modo Squad: convoque múltiplos agentes especialistas em um mesmo canal usando `@` ou deixe o router inteligente escolher quem deve responder.

#### 3. Assistente Builder Fante
- O arquiteto nativo de agentes do Elefante agora se chama **Fante**.
- Converse naturalmente para descrever uma tarefa ou gargalo de trabalho.
- O Fante propõe um card completo com papel, instruções em tom humano, seleção do modelo ideal, nível de esforço e permissões de conectores antes de qualquer criação.

#### 4. Hub de 300+ Modelos & DeepSeek Caching
- Conecte suas contas do **Claude (Anthropic)**, **Codex (OpenAI)**, **Google Gemini**, **Antigravity**, **OpenCode**, **Pi** ou **chaves diretas de API**.
- Otimização pioneira para modelos **DeepSeek (R1 e V3)** com reaproveitamento de *KV Cache* de contexto, cortando mais de 90% dos custos e da latência em prompts contínuos.

#### 5. Compressão Nativa de Tokens: RTK & Caveman Mode
- **RTK (Rust Token Killer):** Proxy transparente e de altíssima velocidade embutido no terminal do sistema. Reduz o consumo de tokens de contexto em 60% a 90% em saídas ruidosas (git status, npm, vitest, tsc, docker).
- **Caveman Mode:** Instruções de síntese extrema para quem prefere respostas telegráficas e zero prolixidade.

#### 6. Ações no Computador (agent-desktop)
- Seus agentes podem abrir e operar aplicativos reais no macOS, Windows e Linux (como Notas, Calendário, Spotify, VS Code).
- Inspeção nativa da árvore de acessibilidade do sistema operacional sem roubar o mouse nem o foco da digitação.
- **Aprovação Humana Obrigatória:** Qualquer ação que envie mensagens, crie agendamentos, publique ou apague informações requer sua autorização prévia.

#### 7. Modo Servidor Headless & Mobile
- Execute `npm run server` na sua VPS Linux ou máquina dedicada.
- Acesse a interface web completa via navegador do celular ou laptop via Tailscale ou túnel seguro SSH.
- Suporte a rotinas automáticas com retentativas inteligentes em segundo plano, mesmo com o seu computador de trabalho desligado.

#### 8. Soberania Total & Backup SQLite
- Nenhum dado de telemetria é enviado a terceiros.
- Banco de dados SQLite único com histórico de conversas, métricas de tokens por agente e rotação diária automática de backups.

---

## 🇺🇸 English

We are proud to introduce **Elefante v1.0.0** — the sovereign, multi-agent AI orchestrator built for high-performance developers and engineering teams.

Elefante brings the power of autonomous AI squads directly to your local workspace, ensuring total sovereignty over your codebase, keys, and private data.

---

### Key Highlights in v1.0.0

- **Right Project & Code Explorer (Orca-Style):** Integrated file tree browser, multi-tab terminal-like code editor with syntax highlighting, line numbers gutter, seamless toggle between syntax view and editing, native `Ctrl+W` tab closing, image previews, and one-click external editor launch (VS Code / Cursor).
- **Persistent Bottom Status Bar:** Real-time genuine token usage and cost metrics, real DeepSeek connection status with direct setup link, interactive RTK token compression toggle, connected cloud CLIs summary, active routines, and quick panel toggles.
- **Cloud CLIs & Accounts Hub:** Manage authentication and connectivity across 24+ industry-standard tools (GitHub, Vercel, Supabase, Cloudflare, Railway, AWS, Docker, Stripe, Sentry, and more).
- **Folder-First Multi-Agent Architecture:** Anchor discussions and agent actions to local filesystem repositories with independent workspaces and git integration.
- **Fante Builder Assistant:** Conversational agent architect that interviews you, recommends personas, picks optimal LLM models, and scopes minimal-privilege tools.
- **300+ Models & DeepSeek KV Caching:** Seamless multi-provider support with first-class DeepSeek caching, saving over 90% of token overhead on recurring turns.
- **Native Token Compression:** Built-in RTK (Rust Token Killer) filter reducing terminal output tokens by 60–90%, alongside optional Caveman brevity mode.
- **Computer Use via Accessibility Tree:** Control native OS desktop apps with zero mouse hijacking and human-in-the-loop approvals for sensitive actions.
- **Self-Hosted Headless & Mobile Web:** Run on a private VPS with automatic routine scheduling and responsive mobile UI.

---
*Created with focus and precision by Vinicius Romeiro.*
