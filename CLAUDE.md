# Cypris Smile (antigo ShadeLab) — contexto para o Claude

App Expo (React Native) de tomada de cor dental e Smile Design. Nome público "Cypris Smile" desde 2026-10-22
(escolha do Gustavo; evitamos "DSD" no nome por ser a marca do Digital Smile Design). No código, pasta, `slug`,
`scheme` e `bundleIdentifier` continuam "shadelab" — trocar o bundle só antes do 1º build na loja, com cuidado. Dono: Gustavo (dentista), que não programa:
explique em português simples, um comando por vez, e rode você mesmo o que for possível.

## Como rodar e verificar

```bash
npm install
npx expo start          # QR code para o Expo Go no iPhone (precisa de login Expo no PC e no app)
npm test                # vitest: núcleo de cor, imagem e geometria dos dentes
npm run typecheck       # tsc
npm run lint            # eslint (config Expo)
```

Antes de dar uma tarefa por concluída: testes, typecheck e lint limpos.

## Estrutura

- VISUAL E ACESSO (2026-10-22): tema pastel em `src/theme` (`colors` grafite/rosé, `pastel` para os cartões,
  `fonts` Italiana + Jost via @expo-google-fonts carregadas em `app/_layout.tsx`). Logomarca = proposta D
  (`components/Logo.tsx`: "Cypris" Italiana, arco rosé, "SMILE" Jost Light; quadro de propostas no Artifact
  https://claude.ai/artifact/PCjwG41S4vEWrirg4LyBGh). Abertura `components/Intro.tsx` (logo em fade) por cima das
  rotas; depois `components/LoginScreen.tsx`: no 1º uso cria usuário e senha, depois pede login a cada abertura e
  quando o app volta de 5 min em segundo plano (`lib/AuthContext.tsx`, regras puras em `lib/authRules.ts`). Acesso
  LOCAL: `lib/auth.ts` grava usuário, sal e SHA-256 da senha no expo-secure-store (sem servidor, sem recuperação de
  senha; trocar senha e Sair em Configurações). As rotas ficam sempre montadas e a tela de acesso é uma camada por
  cima, para não perder o que estava aberto ao bloquear. Tela inicial sem cabeçalho: logo no topo e cartões pastel.

- `src/app/` telas (Expo Router): `index` (início), `shade/capture` (câmera), `shade/analyze` (marcadores, análise, salvar
  caso ou calibração), `cases/` (lista e detalhe), `settings` (escala, calibração), `smile/index` (Smile Design por IA).
- `src/lib/color/` sRGB↔CIELAB, CIEDE2000, escalas VITA Classical e 3D-Master, correção por referência, matching.
  Tomada de cor (redesenho de 2026-10-21, pedido do Gustavo): o quadro do dente é um RETÂNGULO redimensionável
  (alça no canto inferior direito, `components/Marker.tsx`) que cobre a coroa inteira; `sampleThirds` lê colo /
  médio / incisal e `matchShadeProfile` compara o perfil com o tab inteiro (terços medidos na calibração —
  `Settings.calibrationThirds` — ou os offsets típicos `THIRD_OFFSETS`), pesos 0,3/0,5/0,2. Resultado: só o
  "mais provável" e a "alternativa mais próxima" (topN 2), SEM rótulo de qualidade ("diferença visível" foi
  retirado da UI; `quality` continua gravado no caso por compatibilidade). Pinça dá zoom na foto da análise;
  chip Superior/Inferior inverte a ordem dos terços. Câmera de cor: botão Frontal/Traseira, `mirror` ligado na
  frontal (a foto sai como se vê na tela) e zoom 1x/2x/3x no canto.
  PDF (`src/lib/report/shadeReport.ts`): recorte da boca em volta do quadro do dente com o quadro e as linhas dos
  terços desenhados em SVG, ao lado da imagem do tab mais próximo — a FOTO REAL do tab se ele foi calibrado
  (`Settings.tabImages`, recorte gravado em `Paths.document/calib/` por `lib/image/crop.ts` na hora de salvar a
  calibração) ou, sem calibração, um tab ilustrado com o degradê colo→incisal dos valores da escala. Gengiva:
  escala `lib/color/gingiva.ts` (IPS Gingiva G1–G5, Lab APROXIMADO — sem valores publicados), calibrável em
  Configurações (`mode=calibrate-gingiva`, grava Lab + foto em `gingivaCalibrations`/`gingivaTabImages`); o
  caso guarda `toothRect`, `lowerTooth`, `thirds`, `gingivaRect`, `gingivaMatches`.
  2026-10-22 (pedidos do Gustavo): a análise de pixels para achar o dente foi retirada; no lugar, `placeByMouth`
  usa SÓ a detecção de boca do Smile Design (MediaPipe → `mouthBounds`) para a posição inicial: quadro do dente
  QUADRADO com lado ≈ 16 % da largura da boca, sobre o 11 logo abaixo do lábio superior, e o da gengiva menor logo
  acima (sem rosto, ficam os quadros padrão, também quadrados). A
  "Referência na foto" (cinza 18 %/branco/tab) saiu da tela: a leitura é direta, sem correção, `referenceMode`
  padrão `none` (o código de correção em `lib/color/calibrate.ts` continua para uso futuro). `Marker`: alça redonda
  com responder próprio, pinça sobre o quadro, e modo explícito "Mover quadros / Redimensionar quadros" (chips
  abaixo da foto); enquanto arrasta um quadro a rolagem da tela trava (`dragging`).
- `src/lib/image/` leitura de pixels (expo-image-manipulator + jpeg-js) e média robusta (descarta 15% extremos).
- SMILE DESIGN POR IA (redesenho de 2026-10-22, pedido do Gustavo: "retirar toda a parte manual de colocar os
  dentes"). `src/app/smile/index.tsx`: foto (câmera guiada `smile/capture.tsx` → `pendingPhoto.ts`, ou galeria) →
  escolhas → "Gerar Smile Design com IA" → antes e depois → salvar no caso. Escolhas em `lib/ai/prompt.ts`: forma
  (`TOOTH_SHAPES`: retangular, triangular, arredondado, quadrado — os 4 da imagem de referência dele), textura
  (`TEXTURES`: lisa, natural, caracterizada), cor da escala (Lab calibrado se houver, descrito em palavras +
  sRGB) e gengiva (`GUM_OPTIONS`: manter ou plastia gengival). `buildDesignPrompt` monta a instrução (uma linha,
  em inglês); `lib/ai/smileGen.ts#generateDesign` chama o Gemini (`generateContent`, resposta IMAGE, foto reduzida
  a 1536 px). Modelo padrão `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite, o mais barato; testado no AI Studio
  com a foto dele em 2026-10-22); quem estava no padrão antigo `gemini-2.5-flash-image` é migrado em
  `loadSettings`. Chave e modelo em `components/AiConfig.tsx` ("Configurar IA" no fim da tela; ficam só no
  aparelho). Cada geração vira uma variação (chips) com o resumo `designSummary`. Antes e depois em
  `components/BeforeAfter.tsx`: "Cortina" (arrastar na foto passa a linha de um lado para o outro) e
  "Transparência" (barra que mistura o depois sobre o antes — pedida para casos de plastia gengival); o `ref`
  serve para compartilhar a imagem com a comparação. O caso (`SmileCase`) guarda `renderedUri`, `targetShade`,
  `aiStyle` (resumo) e `ai` (forma/textura/gengiva/modelo); `params` recebe `DEFAULT_SMILE_PARAMS` só por
  compatibilidade. A tela do caso mostra o mesmo antes e depois e "Gerar outra versão" (`/smile?caseId=`).
  REMOVIDOS nessa data: editor manual (contorno, boca, ajustar, face-bow na tela, biblioteca 2D de sorrisos,
  cenários, rascunho automático) e a tela separada "Sorriso por IA". Ficaram só bibliotecas usadas por outras
  partes ou por testes: `lib/smile/teeth.ts` (tipos de `SmileParams`), `mouth.ts` (a análise de cor usa a boca
  detectada para posicionar os quadros), `frame.ts`, `autofit.ts` e `lib/face/*` (MediaPipe).
- Histórico (já descartado, não refazer): sprites das anatomias do exocad, arco 3D ao vivo com three.js, biblioteca
  2D recortada de imagem e editor manual de contornos — o Gustavo achou todos "sem forma" ou difíceis de usar; o
  realismo que ele quer é o de IA guiada (ver `docs/smilecloud-estudo.md` e `docs/smilefy-estudo.md`).
- `src/lib/storage/` AsyncStorage: `settings.ts` e `cases.ts` (`ShadeCase` | `SmileCase`, fotos copiadas para
  `Paths.document/cases`).
- `src/components/` `Marker` (quadro de amostra), `BeforeAfter`, `AiConfig`, `FaceLandmarker` (MediaPipe invisível), etc.
- `tests/` vitest; `eas.json` perfis de build; `reference/anatomia/` (fora do git, ver README lá) cópia filtrada da
  biblioteca de dentes do exocad (139 bibliotecas legíveis) e `reference/renders/` prévias + folha de contato.

## Decisões técnicas

- Expo SDK 57, sem módulos fora do Expo Go: tudo roda via QR code sem build nativo.
- Gestos usam o responder system do `View` (não PanResponder/Reanimated) para passar no lint do React Compiler.
- Aviso de região heterogênea usa variação relativa (CV > 20%) e aparece inline, nunca como Alert.
- Valores Lab das escalas são aproximações da literatura; a calibração do usuário (Configurações) substitui quando
  todos os tabs estão medidos.
- Push para o GitHub só funciona da máquina do Gustavo (a sessão na nuvem não tem credencial).

## Próximos passos combinados

1. Smile Design por IA (feito em 2026-10-22, falta validar no iPhone com os créditos do Gemini — R$ 200 depositados
   no dia, entrando na conta). Ideias seguintes: guiar a IA com o contorno desenhado (duas imagens), escolher
   comprimento/largura dos centrais, PDF do antes e depois para o paciente, app centrado no paciente.
2. Continuação do DSD (ver `docs/dsd-estudo.md`, seção 8): régua digital em mm sobre a foto, camada de gengiva
   com cor/opacidade e carimbo para esconder os dentes originais, blur para casar com a foto, antes/depois com
   cortina, PDF do smile frame para o laboratório, marcos faciais automáticos (MediaPipe), vídeo.
3. "Calibrar meu cartão": fotografar qualquer cartão cinza/branco ao lado de um tab conhecido e guardar o Lab real.
4. Build iOS via EAS (`eas build --platform ios --profile production` + `eas submit`) — trocar `bundleIdentifier`
   em `app.json` antes do primeiro build.
