# ShadeLab — contexto para o Claude

App Expo (React Native) de tomada de cor dental e Smile Design. Dono: Gustavo (dentista), que não programa:
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

- `src/app/` telas (Expo Router): `index` (início), `shade/capture` (câmera), `shade/analyze` (marcadores, análise, salvar
  caso ou calibração), `cases/` (lista e detalhe), `settings` (escala, calibração), `smile/index` (Smile Design).
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
- `src/lib/image/` leitura de pixels (expo-image-manipulator + jpeg-js) e média robusta (descarta 15% extremos).
- `src/lib/smile/` `teeth.ts` (contornos dos 6 anteriores traçados em quadrado unitário, spline Catmull-Rom, layout por
  proporção natural/áurea), `shading.ts` (gradientes derivados da cor-alvo), `anatomy.ts` (layout com sprites de
  anatomia real: medidas em mm e posição no arco vindas do catálogo) e `anatomyCatalog.ts` (GERADO por
  `scripts/anatomia/render.mjs`, não editar à mão).
- `src/lib/smile/frame.ts` face-bow digital estilo DSD: marcos faciais em frações da imagem, calibração em mm pela
  largura dos dois centrais, desvio de linha média, inclinação, relação L/C do central (70–90%), curvas do smile
  frame (sorriso, gengival, papilas a 40%). UI em `components/FaceFrame.tsx`. Estudo do DSD em `docs/dsd-estudo.md`.
- `src/lib/smile/mouth.ts` contorno da boca (8 pontos, frações da imagem, em `SmileParams.mouth`): `ClipPath` no
  `SmileOverlay` recorta os dentes pela abertura dos lábios; `fitToMouth` encaixa o arco (72% da largura da boca).
  UI em `components/MouthOutline.tsx`.
- Fluxo do Smile Design (2026-10-15): foto fixa no alto (canvas com altura máx. 50% da tela) e passos rolando embaixo:
  Foto → Boca → Forma e cor (contorno é o padrão; ao entrar, `fitTeeth` encaixa pela análise de pixels ou pela boca)
  → Ajustar → Comparar. Um efeito garante o encaixe (`fittedMouth`): ao chegar em Forma/Ajustar/Comparar por qualquer
  caminho com uma boca ainda não encaixada, `fitTeeth` roda sozinho (antes, entrar pelos chips de passo deixava o arco
  no tamanho PADRÃO = 8,5% da largura da foto → dentes "gigantes" numa foto de rosto inteiro, 2026-10-15); um aviso
  aparece se o central ficar fora de 9–21% da largura da boca. Regra de gestos (pedido do Gustavo): pinça na foto é SEMPRE zoom da imagem e um dedo
  arrasta a vista ampliada; para mover/dimensionar dentes é preciso tocar neles antes no passo Ajustar
  ("Conjunto" seleciona o arco, "Unitário" um dente; toque fora solta). A câmera guiada NÃO valida o enquadramento
  (ele pediu para tirar o verde/vermelho): só mostra o guia e a frase para sorrir. `smile/capture.tsx` é a câmera guiada AO VIVO: um WebView com
  getUserMedia + MediaPipe em modo vídeo desenha a silhueta de cabeça e ombros (`HEAD_SILHOUETTE`) e a deixa verde
  quando o rosto está enquadrado; a captura é feita no canvas do WebView (selfie espelhada) e volta por
  `pendingPhoto.ts`. Se o WebView não liberar a câmera, cai para `NativeCapture` (expo-camera, conferência após o
  clique via `checkFraming`). Zoom da vista no editor: chip "Zoom" na barra de passos; a vista interna cresce em
  layout (não em transform), então `area` já vem em px ampliados e os gestos continuam coerentes.
  Detecção automática: `components/FaceLandmarker.tsx` = WebView invisível com MediaPipe Face Landmarker (CDN +
  modelo do Google, precisa de internet na 1ª vez); `lib/face/landmarks.ts` mapeia os 478 marcos para boca (lábio
  interno), face-bow e caixa do rosto; `lib/face/detect.ts` recorta a boca e chama `lib/smile/autofit.ts`
  (máscara de dente por claridade/saturação, vales de claridade = espaços interproximais → linha média, largura e
  altura do central, larguras de laterais/caninos em `edits`). Tudo com ajuste manual: "Mover todos" (arco) /
  "Mover um" (toque seleciona o dente). Reabrir caso: `/smile?caseId=` carrega e salva por cima; a análise de cor
  aceita `caseId` + dados do caso em `/shade/analyze`.
- `src/lib/smile/scenarios.ts` cenários de tratamento (presets) — a UI foi RETIRADA do Smile Design a pedido do
  Gustavo em 2026-10-21, junto com as proporções Áurea/RED (só "Natural" fica; o código continua para testes). Na tela: cartão
  "Comparar" com cortina arrastável (foto original recortada por cima do canvas), lado a lado e variações
  (`components/SmilePanes.tsx`, até 3 guardadas em `SmileCase.variants`); "Compartilhar imagem" captura os painéis
  quando um modo lado a lado/variações está ativo.
- `src/app/smile/ai.tsx` + `src/lib/ai/` "Sorriso por IA" (separado do Smile Design manual): foto → estilo
  (natural, Hollywood, jovem, discreto, alinhado, clareamento) + cor da escala → `generateSmile` chama o Gemini
  (REST `generateContent`, resposta em imagem; modelo em `Settings.aiModel`, padrão `gemini-2.5-flash-image`) com a
  foto reduzida a 1536 px e o prompt de `prompt.ts` (cor descrita em palavras + sRGB). A chave fica em
  `Settings.aiApiKey`, só no aparelho; a tela avisa que a foto sai do aparelho. Resultado gravado no cache e salvo
  como `SmileCase` com `aiStyle`. Ainda não testado com chave real.
- ANATOMIA 3D AO VIVO (2026-10-21, substitui os sprites — Gustavo pediu arco inteiro, nítido, como o SmileFy):
  `scripts/anatomia/export3d.mjs` lê os 7 dentes de cada lado das duas arcadas da biblioteca do exocad (malhas 1..7 do
  lado direito + espelho para o esquerdo, posições/eixos dos `upperjaw.xml`/`lowerjaw.xml`, que estão em
  `library/metadata/<nome>/` quando faltam na biblioteca), simplifica com `meshoptimizer` (~2 500 triângulos/dente,
  borda cervical travada) e grava `assets/arcos/<id>.bin` (~0,65 MB por arco: "SL3D" + JSON + int16 + uint16; ver
  cabeçalho do script). Referencial: x = esquerda do paciente, y = cabeça, z = frente; origem na borda incisal dos
  centrais superiores; inferior com 2 mm de sobremordida. Lista do app em `scripts/anatomia/arcos.json` →
  `src/lib/smile/archCatalog.ts` (GERADO). `metro.config.js` adiciona `bin` aos assets.
  Visualizador: `viewer/src/main.js` (three.js, câmera ortográfica em mm, luz de estúdio SEM tone mapping para a cor
  da escala chegar fiel, MeshPhysicalMaterial com clearcoat; recorte pela boca via CSS `clip-path`, esmaecimento acima
  da linha da gengiva via `mask-image` (coroa 10,5 mm + 1,5 mm de transição) e sombra do lábio superior como SVG
  borrado ao longo da borda do lábio). `node scripts/viewer/build.mjs` empacota com esbuild em
  `assets/viewer/smile3d.html` (único arquivo, offline) e `viewer/dev/smile3d.js`. Página de teste no PC:
  `viewer/dev/index.html` (servida por `.claude/launch.json` → `viewer-dev`, porta 8099, `?zoom=3` aproxima a boca;
  `face.jpg` é foto do Gustavo, fora do git). No app, `components/Smile3D.tsx` = WebView transparente, sem toques
  (gestos ficam no canvas do app), que recebe `loadArch(base64)` e `setParams({...})` por `injectJavaScript`;
  parâmetros: `midlineX`, `incisalY` (= gumY + comprimento do central), `centralWidth`, `rotX/Y/Z`, `color`,
  `opacity`, `gloss`, `showLower`, `lowerGap`, `lipShadow`, `mouth`. `SmileParams.arch` (id do arco) liga o modo 3D
  e `SmileParams.arch3d` guarda os ajustes 3D; sem `arch` fica o modo contorno (SVG).
- BIBLIOTECA 2D DE SORRISOS (2026-10-21, depois de descartar o 3D): `reference/sorrisos/tipos-de-sorriso.png`
  (imagem que o Gustavo mandou: retangular, triangular, arredondado, quadrado, renderizados) →
  `scripts/sorrisos/extract.mjs` recorta cada arco com alfa pelo brilho (fundo preto), mede linha média, colo,
  incisal e largura do central em px e gera `assets/sorrisos/<id>.png` + `src/lib/smile/smileLibrary.ts` (GERADO).
  `lib/smile/library.ts#libraryPlacement` encaixa o PNG pelos mesmos parâmetros do contorno (midlineX, gumY,
  centralWidth, heightRatio; escala vertical independente). `components/SmileLibraryLayer.tsx`: Image com
  tamanho explícito + cópia tingida pela cor-alvo (35 %) + sombra do lábio superior (gradiente SVG) dentro de um
  MaskedView com o contorno da boca. `SmileParams.library` liga o modo (cards "Modelo" no passo Forma; sem
  library = contorno). Editor no estilo Smilecloud (ver `docs/smilecloud-estudo.md`): no Unitário há `‹ 11 ›`
  para navegar entre dentes, forma por dente (`ToothEdit.shape`), chip "Par" (`pairMode`, espelha cada ajuste
  no homólogo), "Ocultar/Mostrar" e zoom automático na boca (2,2x) ao selecionar um dente.
- Edição dente a dente: `SmileParams.edits[fdi] = { dx, dy, sw, sh, rot, shape? }` aplicado por `applyToothEdit` nos dois
  layouts; rotação desenhada com `rotate()` em torno do centro da caixa; com um dente selecionado, arrastar na foto
  move só ele.
- `scripts/anatomia/` `import.mjs` (copia da biblioteca do exocad para `reference/anatomia`, só consulta),
  `mesh.mjs` (lê `.eoff` = OFF binário do exocad, e `.stl`; `readToothBow` lê o XML do arco), `export3d.mjs` +
  `arcos.json` (arcos 3D do app). Orientação das malhas: x = mesial (dente direito), y = vestibular, z = incisal; o
  XML dá posição e eixos de cada dente no arco (cada arcada no seu próprio referencial, z = oclusal).
- `src/lib/storage/` AsyncStorage: `settings.ts` e `cases.ts` (`ShadeCase` | `SmileCase`, fotos copiadas para
  `Paths.document/cases`).
- `src/components/` `Marker` (quadrado de amostra arrastável), `Handle` (alça), `SmileOverlay` (SVG), etc.
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

1. Anatomia 3D ao vivo (feita em 2026-10-21, falta validar no iPhone): 4 arcos (Avelar X1, JO 2026, DA507, Shorodok
   G013). Pendências: snapshot do WebView para compartilhar/salvar (hoje a captura do canvas pega o WebView?
   conferir), miniaturas dos arcos, edição dente a dente no 3D, curva do sorriso/plano oclusal deformando o arco,
   translucidez incisal. Depois: app centrado no paciente (lista de pacientes → linha do tempo → projetos) e editor
   no estilo SmileFy (arame antes dos dentes, modos Posicionar/Girar/Tamanho, abas Quadro/Ajustes/Luz/Modelos) —
   ver `docs/smilefy-estudo.md` §6. Licença: as anatomias são do exocad/autores — confirmar antes de publicar.
2. Continuação do DSD (ver `docs/dsd-estudo.md`, seção 8): régua digital em mm sobre a foto, camada de gengiva
   com cor/opacidade e carimbo para esconder os dentes originais, blur para casar com a foto, antes/depois com
   cortina, PDF do smile frame para o laboratório, marcos faciais automáticos (MediaPipe), vídeo.
3. "Calibrar meu cartão": fotografar qualquer cartão cinza/branco ao lado de um tab conhecido e guardar o Lab real.
4. Build iOS via EAS (`eas build --platform ios --profile production` + `eas submit`) — trocar `bundleIdentifier`
   em `app.json` antes do primeiro build.
