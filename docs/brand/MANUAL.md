# Elefante — Manual de marca e interface
Versão 1.0 · 6 de novembro de 2026

## Essência
Elefante é um espaço de trabalho para coordenar agentes de IA. A marca deve transmitir clareza, proximidade e controle. Assinatura curta: **Seu time de IA**. Escrever sempre Elefante, com inicial maiúscula. Evitar promessas de autonomia ilimitada ou resultados garantidos.

## Símbolo
O elefante frontal usa orelhas violetas, rosto claro e tromba curva sobre um fundo grafite. A forma simples deve continuar reconhecível em tamanhos pequenos. O arquivo mestre é assets/elefante.svg; PNG, ICO e ICNS são derivados.
- Área de proteção: pelo menos 20% da largura do símbolo em cada lado, fora do ícone de aplicativo.
- Tamanho mínimo: 24 px para a marca; 16 px apenas para favicon e ícones de sistema.
- Wordmark: Elefante em Inter Semibold, espaçamento entre letras de -0,02 em.
- Não deformar, inclinar, redesenhar o rosto, adicionar brilhos, sombras internas ou efeitos 3D.
- Não usar símbolos de provedores como se fossem a marca do Elefante.
- Para fundos coloridos, manter a base grafite do ícone. Não remover a base das versões ICO/ICNS.

## Paleta
| Nome | Hex | Aplicação |
|---|---|---|
| Grafite da marca | #181722 | Base do ícone e peças de marca |
| Violeta da marca | #B6A3FF | Orelhas, ilustrações e destaque de marca |
| Névoa | #EDE8FF | Rosto do símbolo e texto sobre grafite |
| Violeta de ação claro | #7154CF | Links e destaque no tema claro |
| Violeta de ação escuro | #B3A0FA | Links e destaque no tema escuro |
| Fundo escuro | #101115 | Área principal |
| Navegação escura | #14151B | Barra lateral |
| Superfície escura | #1A1B23 | Cartões e painéis |
| Texto escuro | #EDEDEF | Texto principal no tema escuro |
| Fundo claro | #F6F6F7 | Área principal no tema claro |
| Superfície clara | #FFFFFF | Cartões no tema claro |
| Texto claro | #111318 | Texto principal no tema claro |

Violeta indica identidade e seleção. Verde indica sucesso, âmbar atenção e vermelho falha. Não usar cor como único indicador: acompanhar estados com texto e, quando útil, ícone. Validar contraste WCAG AA de cada combinação antes de criar novos componentes; a paleta sozinha não garante acessibilidade.

## Tipografia
**Inter Variable** é a fonte oficial de marca e interface. Os arquivos WOFF2 e a licença estão em fontes/. WOFF2 serve para apps e web; não é um instalador de fonte do Windows. Fallback: Segoe UI, system-ui, sans-serif.
- Título de página: 24–28 px / 1,2; peso 650.
- Título de seção: 16–18 px / 1,35; peso 600.
- Texto e controles: 13–14 px / 1,5; peso 400–500.
- Rótulos auxiliares: 12 px / 1,4; peso 400–500. Evitar texto essencial menor que 12 px.
- Marca em peças: peso 600, sem caixa-alta integral.
- Números de consumo: tabular-nums para evitar saltos durante atualizações.
- Código: ui-monospace, Cascadia Code, Consolas, monospace.

## Sistema de interface
Escala de espaçamento: 4, 8, 12, 16, 24, 32, 48 px. Raios: 8 px em controles compactos; 10 px em controles padrão; 14–16 px em cartões; 18 px em popovers. Bordas de 1 px discretas. Sombra somente para superfícies flutuantes, não em todo elemento.

Manter navegação lateral estável, área principal silenciosa e ações agrupadas por contexto. Usar no máximo uma ação primária dominante por seção. Em novos controles, alvo de clique mínimo recomendado de 36 px no desktop e 44 px no toque. Foco de teclado visível. Animações de 120–180 ms; respeitar prefers-reduced-motion.

## Padrão de consumo
- Por agente: consumo contabilizado no mês, respostas e participação no uso do time.
- Barra por agente: percentual do consumo do time, explicitamente identificado. Não é saldo ou teto de assinatura.
- Conta do provedor: janelas e percentuais enviados pelo próprio provedor; identificar Codex ou Claude e a janela.
- Dados indisponíveis devem aparecer como indisponíveis, nunca como zero confirmado.
- Tetos internos são controles avançados de execução, não quotas individuais fornecidas pela assinatura.
- Contagem interna atual: entrada não cacheada + saída + 10% das leituras de cache. Descrever como tokens contabilizados, não como faturamento.
- Valores de custo estimado devem ser identificados como estimativa; não apresentar assinatura como cobrança por token.

## Ícones e provedores
Ícones de ação: traço uniforme, 16–20 px, acompanhados de rótulo ou tooltip acessível. Identificadores de modelo devem manter nome textual e fornecedor; o símbolo sozinho não basta. Os símbolos estilizados atualmente no app não substituem os arquivos oficiais de marca dos provedores. Ao trocar por logos oficiais, registrar fonte e condições de uso.

## Voz
Português direto, acolhedor e específico. Preferir “Consumo neste mês”, “Quota indisponível”, “Tentar novamente” e “Alterações salvas”. Erros devem explicar o que aconteceu e o próximo passo. Não afirmar “concluído”, “publicado” ou “instalado” sem verificação correspondente.

## Arquivos e distribuição
- manual.html: versão visual, abre offline no navegador.
- MANUAL.md: especificação textual editável.
- tokens.css: base para implementar o padrão em interfaces.
- assets/elefante.svg: símbolo vetorial mestre.
- assets/icon.png: ícone 512 × 512.
- assets/icon.ico: Windows, múltiplas resoluções.
- assets/icon.icns: macOS.
- assets/tray.png: bandeja, 32 × 32.
- fontes/: Inter Variable WOFF2 e licença.

## Checklist de entrega
Verificar ícone da janela, executável, atalho, bandeja, favicon, tela de abertura e páginas internas. Testar claro/escuro, foco, textos longos e números grandes. Antes de atualizar: fechar Elefante, criar backup, verificar pacote e manter intacta a pasta data/. O cache de ícones e atalhos fixados do Windows pode manter uma imagem antiga mesmo após os arquivos serem atualizados.
