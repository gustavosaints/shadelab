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
  proporção natural/áurea) e `shading.ts` (gradientes derivados da cor-alvo).
- `src/lib/storage/` AsyncStorage: `settings.ts` e `cases.ts` (`ShadeCase` | `SmileCase`, fotos copiadas para
  `Paths.document/cases`).
- `src/components/` `Marker` (quadrado de amostra arrastável), `Handle` (alça), `SmileOverlay` (SVG), etc.
- `tests/` vitest; `eas.json` perfis de build; `reference/` (quando existir) STLs de anatomia e imagens de cor.

## Decisões técnicas

- Expo SDK 57, sem módulos fora do Expo Go: tudo roda via QR code sem build nativo.
- Gestos usam o responder system do `View` (não PanResponder/Reanimated) para passar no lint do React Compiler.
- Aviso de região heterogênea usa variação relativa (CV > 20%) e aparece inline, nunca como Alert.
- Valores Lab das escalas são aproximações da literatura; a calibração do usuário (Configurações) substitui quando
  todos os tabs estão medidos.
- Push para o GitHub só funciona da máquina do Gustavo (a sessão na nuvem não tem credencial).

## Próximos passos combinados

1. Smile Design realista a partir dos STLs do Gustavo (pasta `reference/anatomia`): renderizar cada anatomia de
   frente com iluminação de estúdio e fundo transparente, usar como sprites no overlay no lugar do SVG, tingir pela
   cor-alvo preservando o sombreamento, biblioteca de anatomias selecionável. Referência visual: Smile Creator do exocad.
2. Depois: 3D ao vivo (expo-gl + three.js) para girar/inclinar e ajustar curvatura do arco.
3. Build iOS via EAS (`eas build --platform ios --profile production` + `eas submit`) — trocar `bundleIdentifier`
   em `app.json` antes do primeiro build.
