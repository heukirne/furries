# AGENTS.md

Guia rapido para agentes que forem editar este projeto.

## Objetivo do projeto

Manter e evoluir uma versao web jogavel inspirada no Fury of the Furries, priorizando:

- jogabilidade fluida
- visual pixel-art retro
- codigo simples sem dependencias externas

## Regras tecnicas

- Nao adicionar frameworks sem necessidade.
- Preservar o funcionamento offline com arquivos estaticos.
- Manter compatibilidade com navegadores modernos sem build step.
- Usar ASCII nos arquivos fonte.

## Arquivos principais

- `game.js`: toda a logica de jogo.
- `index.html`: estrutura da pagina.
- `style.css`: estilos da interface.
- `assets/tiny_spritesheet.png`: sprite sheet utilizado em runtime.
- `tools/generate_spritesheet.py`: script oficial para regenerar sprites.
- `ref/`: material de pesquisa e referencia visual/documental.

## Fluxo recomendado para mudancas

1. Ler rapidamente `README.md`.
2. Fazer alteracoes pequenas e incrementais.
3. Se mudar sprites, regenerar com:
   `python3 tools/generate_spritesheet.py`
4. Validar JS com:
   `node --check game.js`
5. Testar jogando localmente:
   `python3 -m http.server 8000`

## Padrao de qualidade

- Nao quebrar controles existentes.
- Nao remover habilidades das 4 formas.
- Manter fallback visual em `game.js` caso o sprite sheet falhe.
- Evitar regressao no HUD (vidas, tempo, pontuacao, frutas).

## Quando alterar mapa/mecanicas

- Garantir que a fase continua finalizavel.
- Manter obstaculos que exigem cada forma (fogo/agua/terra/ar).
- Evitar soft-locks.

