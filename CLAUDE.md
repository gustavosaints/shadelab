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
- `src/lib/smile/scenarios.ts` cenários de tratamento com um toque (natural, facetas, clareamento, gengivectomia,
  fechar diastema, alinhar): presets sobre os parâmetros atuais + cor sugerida por escala. Na tela: cartão
  "Comparar" com cortina arrastável (foto original recortada por cima do canvas), lado a lado e variações
  (`components/SmilePanes.tsx`, até 3 guardadas em `SmileCase.variants`); "Compartilhar imagem" captura os painéis
  quando um modo lado a lado/variações está ativo.
- `src/app/smile/ai.tsx` + `src/lib/ai/` "Sorriso por IA" (separado do Smile Design manual): foto → estilo
  (natural, Hollywood, jovem, discreto, alinhado, clareamento) + cor da escala → `generateSmile` chama o Gemini
  (REST `generateContent`, resposta em imagem; modelo em `Settings.aiModel`, padrão `gemini-2.5-flash-image`) com a
  foto reduzida a 1536 px e o prompt de `prompt.ts` (cor descrita em palavras + sRGB). A chave fica em
  `Settings.aiApiKey`, só no aparelho; a tela avisa que a foto sai do aparelho. Resultado gravado no cache e salvo
  como `SmileCase` com `aiStyle`. Ainda não testado com chave real.
- `assets/anatomia/<id>/` sprites por anatomia: `{central,lateral,canine}-{fill,shade,gloss}.png` + `thumb.png`.
  Desenho (`components/AnatomyOverlay.tsx` → `AnatomyLayer`): imagens NATIVAS (`Image` com `tintColor` para o
  `fill`, mais `shade` e `gloss` por cima), porque `Mask` com `Image` do react-native-svg NÃO renderizou no iPhone
  (Gustavo viu a biblioteca sumir). O recorte pela boca da camada nativa é feito com `@react-native-masked-view`
  no `SmileOverlay`; o modo contorno continua em SVG com `ClipPath`. Dentes 21–23 = `scaleX: -1`.
  ARMADILHA (2026-10-15): `Image` de asset local com só `StyleSheet.absoluteFill` é desenhado no tamanho ORIGINAL
  do PNG no iOS (o RN injeta width/height do asset e largura explícita vence left/right) → um central cobria a boca
  inteira. As camadas usam `width/height: '100%'` (`styles.layer`). A linha cinza de diagnóstico sob a foto
  (`BUILD_TAG`, % do central na boca, área, zoom, anatomia, encaixe ok/pendente) serve para conferir versão e encaixe.
  Cada dente é renderizado no seu próprio referencial (vista vestibular com giro leve: lateral 8°, canino 18°) e com
  a fatia distal levemente esmaecida (lateral 4%, canino 16%); o layout põe os dentes lado a lado por contato
  (`offsetX` do catálogo não é usado). Visual (2026-10-15, referência: renders do SmileFy que o Gustavo mandou):
  normais suavizadas (`blurNormals`), luz principal lateral alta, brilho frontal nítido, curva de contraste que
  deixa o corpo na cor cheia e concentra sombra nas proximais/colo (`SHADE_DEPTH` 0,62). Ele achou as anatomias
  anteriores "sem forma"; a seleção atual em `libraries.json` é a série Jan Hajto (F31 = a mesma do SmileFy) e ele
  quer escolher as demais pela folha de contato `reference/renders/_folha-de-contato.png` + `.txt`.
- Edição dente a dente: `SmileParams.edits[fdi] = { dx, dy, sw, sh, rot }` aplicado por `applyToothEdit` nos dois
  layouts; rotação desenhada com `rotate()` em torno do centro da caixa; com um dente selecionado, arrastar na foto
  move só ele.
- `scripts/anatomia/` `import.mjs` (copia da biblioteca do exocad só os anteriores superiores), `mesh.mjs` (lê `.eoff`
  = OFF binário do exocad, e `.stl`), `raster.mjs` (rasterizador ortográfico com z-buffer e normais), `png.mjs`,
  `render.mjs` (luz de estúdio, translucidez incisal por espessura, corte na linha da gengiva, catálogo TS) e
  `libraries.json` (quais anatomias entram no app). Orientação das malhas: x = mesial (dente direito), y = vestibular,
  z = incisal; o `upperjaw.xml` dá posição e eixos de cada dente no arco e a câmera olha o arco de frente.
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

1. Smile Design realista (feito em 2026-10-14, falta validar no iPhone): sprites dos `.eoff`/STL com luz de estúdio,
   12 anatomias em `libraries.json` (escolher mais pela `reference/renders/_folha-de-contato.png`). Pendências:
   conferir o `tintColor` do `Image` no Expo Go; os sprites ficam um pouco grandes se a gengiva não cobrir o colo;
   algumas bibliotecas (robtoly, Nondas) mostram uma linha fina onde a margem cervical recortada foi remendada.
   Licença: as anatomias são do exocad/autores — confirmar redistribuição antes de publicar na loja.
2. Continuação do DSD (ver `docs/dsd-estudo.md`, seção 8): régua digital em mm sobre a foto, camada de gengiva
   com cor/opacidade e carimbo para esconder os dentes originais, blur para casar com a foto, antes/depois com
   cortina, PDF do smile frame para o laboratório, marcos faciais automáticos (MediaPipe), vídeo.
3. "Calibrar meu cartão": fotografar qualquer cartão cinza/branco ao lado de um tab conhecido e guardar o Lab real.
4. Depois: 3D ao vivo (expo-gl + three.js) para girar/inclinar e ajustar curvatura do arco.
5. Build iOS via EAS (`eas build --platform ios --profile production` + `eas submit`) — trocar `bundleIdentifier`
   em `app.json` antes do primeiro build.
