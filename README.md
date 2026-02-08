# Mamonas Assassinas - O Jogo

Versao web inspirada em **Fury of the Furries (1993)**, feita com HTML, CSS e JavaScript puro.

![Mamonas Assassinas - Hero Brand](https://raw.githubusercontent.com/heukirne/mamonas/refs/heads/main/hero-brand.png)

## Como jogar

1. No diretorio do projeto, rode:

```bash
python3 -m http.server 8000
```

2. Abra no navegador:

`http://localhost:8000`

Tambem funciona abrindo `index.html`, mas servidor local e recomendado.

## Controles

- `A` / `D` ou setas: mover
- `W` / seta para cima / `Espaco`: pular (ate 3 pulos)
- `J` / `Ctrl`: habilidade da forma atual
- `1-4`: troca direta de forma
- `Q` / `E`: ciclar formas
- `R`: reiniciar partida

## Formas e habilidades

- `Amarelo (Fogo)`: dispara fogo e quebra barreiras roxas (`B`).
- `Azul (Agua)`: nada/mergulha e dispara bolhas.
- `Vermelho (Terra)`: escava blocos destrutiveis (`D`).
- `Verde (Ar)`: usa gancho nos pontos `H`.

## Objetivo

- Coletar frutas
- Evitar inimigos e perigos (espinhos, lava, afogamento)
- Encontrar a saida `EXIT`

## Estrutura do projeto

- `index.html`: layout e UI
- `style.css`: visual retro e responsividade
- `game.js`: logica do jogo (fisica, mapa, HUD, IA, formas)
- `assets/tiny_spritesheet.png`: sprite sheet dos personagens
- `tools/generate_spritesheet.py`: gerador do sprite sheet
- `ref/`: documentacao e imagens de referencia

## Gerar sprite sheet novamente

```bash
python3 tools/generate_spritesheet.py
```

O jogo detecta automaticamente o tamanho dos frames no PNG.

