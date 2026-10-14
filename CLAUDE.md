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
- `assets/anatomia/<id>/` sprites por anatomia: `{central,lateral,canine}-{fill,shade,gloss}.png` + `thumb.png`.
  `fill` é branco e recebe `tintColor` = cor-alvo; `shade` (preto) e `gloss` (branco) só têm alfa, por isso a cor
  escolhida domina e o sombreamento é preservado. Dentes 21–23 = espelho dos sprites (`scaleX: -1`).
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
2. "Calibrar meu cartão": fotografar qualquer cartão cinza/branco ao lado de um tab conhecido e guardar o Lab real.
3. Depois: 3D ao vivo (expo-gl + three.js) para girar/inclinar e ajustar curvatura do arco.
4. Build iOS via EAS (`eas build --platform ios --profile production` + `eas submit`) — trocar `bundleIdentifier`
   em `app.json` antes do primeiro build.
