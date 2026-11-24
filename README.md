# Stitched Worlds — O Último Brinquedo

Jogo de plataforma 2D em pixel art para Android. Tico, um dinossauro de pelúcia, ganha vida numa noite de tempestade e é
jogado no **Avesso** — a dimensão dos brinquedos perdidos — onde precisa dominar o poder das costuras para voltar para casa.

- **APK pronto:** [`release/StitchedWorlds.apk`](release/StitchedWorlds.apk) (um único arquivo, funciona offline)
- Toda a arte e todo o som são gerados por código (pixel art procedural + sintetizador WebAudio) — nenhum arquivo de imagem ou áudio.

## Como jogar
| Ação | Celular | Teclado | Controle |
|---|---|---|---|
| Andar / correr | analógico (empurre até o fim para correr) | ← → / A D (Shift corre) | analógico / D-pad |
| Pular (segure para pular mais alto) | botão ⬆ | Z / Espaço | A |
| Ataque com o fio (segure: Agulhada) | botão do fio | X / J | X |
| Esquiva | botão de rastro | C / L | B |
| Habilidade dimensional | botão do carretel | V / I | Y |
| Trocar habilidade | botão de setas | Q / E | LB |
| Interagir / falar | botão da mão | ↑ / W | ↑ |
| Pausa | botão ⏸ / voltar do Android | Esc / P | Start |

### O Fio do Destino (habilidades)
1. **Costura Dimensional** — perto de um ilhó dourado, costura uma ponte de fio até outro ilhó; laça e prende inimigos.
2. **Descosturar a Realidade** — desfaz paredes costuradas, armaduras de inimigos e armadilhas; revela segredos.
3. **Remendo Temporal** — rebobina plataformas, pontes e pedregulhos por alguns segundos; devolve projéteis.
4. **Retalho Fantasma** — deixa uma cópia que distrai inimigos e pesa em placas; use de novo para trocar de lugar.
5. **Forma Desfiada** — com a barra cheia, Tico se desfia: mais rápido, mais forte, atravessa barreiras e cria plataformas.

## Desenvolvimento
```bash
npm install                      # esbuild
node tools/serve.mjs 8080        # abre http://127.0.0.1:8080/ (parâmetros: ?level=w1_1&debug=1&god=1&unlock=all)
node tools/build.mjs             # gera dist/ (index.html + game.js único)
bash android/build_apk.sh        # gera release/StitchedWorlds.apk (requer Android SDK 35 + build-tools 35.0.0, JDK 17+)
node tools/validate_levels.mjs   # valida os mapas das fases
node tools/check.mjs             # teste de fumaça de todas as fases e menus
node tools/shot.mjs --q "level=w1_1" --out .shots/a.png   # screenshot automatizado (Playwright)
```
Arquitetura e contratos: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · História: [`docs/STORY.md`](docs/STORY.md) ·
Equipe/arquivos: [`docs/TEAM.md`](docs/TEAM.md).

Estrutura: `src/engine/` (motor: render pixel-perfect, física, câmera, partículas, luz, áudio, salvamento),
`src/game/` (Tico, habilidades, inimigos, chefes, fases, cenas, UI, história), `android/` (WebView em tela cheia),
`tools/` (build, testes, screenshots).
