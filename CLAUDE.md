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
  MANTER CONECTADO (2026-10-22, o Gustavo pediu para não digitar a senha toda vez): chave na tela de login
  (ligada por padrão) e em Configurações › Acesso; grava `cypris.auth.remember` no secure-store e o
  `AuthContext` abre direto em `unlocked` e não bloqueia ao voltar do segundo plano. "Sair" desliga.
  FACE ID (2026-10-22): `lib/biometric.ts` (expo-local-authentication) é só um atalho para o login local. Se o
  aparelho tem biometria cadastrada, depois do 1º login com senha um Alert oferece "Usar Face ID?" (preferência
  `cypris.auth.biometric` on/off no AsyncStorage); ligado, a tela de login pede o Face ID ao abrir e mostra o botão
  "Entrar com Face ID" (cancelar volta para a senha). Liga/desliga em Configurações › Acesso (ligar pede o Face ID
  antes). `faceIDPermission` no plugin do app.json; no Expo Go o iOS pode recusar (`missing_usage_description`)
  e o app mostra uma mensagem pedindo a senha — no app instalado (EAS) funciona.

- `src/app/` telas (Expo Router): `index` (início), `shade/capture` (câmera), `shade/analyze` (marcadores, análise, salvar
  caso ou calibração), `cases/` (lista e detalhe), `settings` (escala, calibração), `smile/index` (Smile Design por IA).
- `src/lib/color/` sRGB↔CIELAB, CIEDE2000, escalas VITA Classical e 3D-Master, correção por referência, matching.
  ESCALA REAL (2026-10-22): a VITA Classical do app usa os valores MEDIDOS na régua do Gustavo
  (`lib/color/vitaClassicalMeasured.ts`, GERADO por `scripts/escala/measure.mjs` a partir de
  `reference/escala/vita-classical.jpg`, fora do git: caixas das coroas marcadas à mão, balanço de branco pela placa
  cinza, exposição normalizada para a média de L* da literatura, leitura por terços) + a foto recortada de cada tab
  em `assets/escala/vita-classical/` (resultados, caso salvo e PDF). A régua tinha um A2 repetido no lugar do B3
  (ele mandou ignorar): o B3 fica com o valor da literatura e sem foto. `ShadeRef.thirds`/`image`; a comparação usa
  os terços medidos quando a escala não está calibrada no aparelho. Testes carregam imagens via `tests/setup.mjs`.
  VITA 3D-MASTER (2026-10-22): 29 tabs (0M1–0M3 + 26). Base = valores medidos com SpectroShade em Dias et al.,
  Biomimetics 2023;8(5):384 (mesma escala de L* da Classical do app); por cima, a escala REAL do Gustavo
  (`lib/color/vita3dMasterMeasured.ts`, GERADO por `scripts/escala/measure-3d.mjs` a partir das fotos IMG_4404–4408
  em `reference/escala/3d-master/`, fora do git): réguas Chroma/Hueguide 0/1, 2, 3, 4 (placa clara, creme — a cor
  dela é corrigida pelos tabs repetidos na Valueguide, de placa escura neutra) e Valueguide 0M2–5M2. Exposição de
  cada foto pela média de L* da literatura dos tabs dela. Faltou a régua do grupo 5: 5M1 e 5M3 ficam com a
  literatura e sem foto. Fotos recortadas em `assets/escala/vita-3d-master/`. Funções comuns em `scripts/escala/lib.mjs`.
  ORIENTAÇÃO DOS TABS: o cabo entra pela cervical, então na foto (cabo para baixo) o TOPO é o incisal. A Classical
  estava com cervical/incisal invertidos até 2026-10-22 (corrigido; o terço médio não mudou).
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
  ANIMAÇÃO DA LEITURA (2026-10-22, inspirada na varredura do "Gerar HD" do SmileCloud): ao tocar "Analisar cor",
  `components/ShadeScan.tsx` abre um cartão escuro no meio da tela (Modal) com o contorno de um incisivo, grade de
  pontos, anel girando, faixa de luz varrendo e os terços acendendo; legenda em 3 passos. Fica ≥ 2 s (0,3 s com
  "Reduzir movimento"); quando o resultado chega o dente se pinta com a cor medida e mostra o tab, e fecha (~1,1 s;
  toque pula). Só na tomada de cor, não na calibração.
- NOMES NA TELA (2026-10-23): "Tirar cor" virou "Colorimetria Dental" (início, câmera, aba "Colorimetria" nos
  Casos). No Smile Design, os textos não falam em IA para o usuário (título, descrição, botão "Gerar Smile Design",
  animação "SMILE DESIGN"; o modelo e o tempo da geração não aparecem mais no resultado nem no caso). Só ficou
  "Configurar IA" (a chave) e o aviso de que a foto vai ao Google.
- VALOR, CROMA E MATIZ (2026-10-23, "sempre leve em consideração"): `deltaE2000Parts` separa o ΔE00 em valor
  (ΔL'/SL), croma (ΔC'/SC) e matiz (ΔH'/SH); `lib/color/hcv.ts`: `compareHcv` (dente × tab, frases "dente mais
  claro/escuro, mais/menos saturado, mais amarelado/avermelhado", abaixo de 0,8 = igual), `hcvTieBreak` (empate no
  total abaixo do perceptível: ganha o valor mais próximo, depois croma, depois matiz — ordem clássica e da
  3D-Master) e `describe3dMaster` (nome do tab → valor/matiz/croma). Aparece no resultado da análise (cada tab), na
  cor medida (Valor · Croma · Matiz°), no detalhe do caso e numa tabela do PDF.
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
  aparelho). Cada geração vira uma variação (chips) com o resumo `designSummary`. Espera da geração:
  `components/SmileGenerating.tsx` (mesmo estilo da `ShadeScan`, aprovado pelo Gustavo): grade + faixa de luz
  varrendo a foto, cartão com os 6 dentes anteriores acendendo, etapas a cada 4,5 s (forma/textura/cor/gengiva da
  escolha), barra até ~92 % em 28 s e segundos; ao chegar a imagem, "revela" o sorriso da esquerda para a direita
  (como o Revelar HD do SmileCloud) e só então entra no antes e depois. Antes e depois em
  `components/BeforeAfter.tsx`: "Cortina" (arrastar na foto passa a linha de um lado para o outro) e
  "Transparência" (barra que mistura o depois sobre o antes — pedida para casos de plastia gengival); o `ref`
  serve para compartilhar a imagem com a comparação. O caso (`SmileCase`) guarda `renderedUri`, `targetShade`,
  `aiStyle` (resumo) e `ai` (forma/textura/gengiva/modelo); `params` recebe `DEFAULT_SMILE_PARAMS` só por
  compatibilidade. A tela do caso mostra o mesmo antes e depois e "Gerar outra versão" (`/smile?caseId=`).
  PLANEJAMENTO NA FOTO (2026-10-22, pedido do Gustavo): forma (só Quadrado, Arredondado, Triangular — a retangular
  saiu; o id fica no tipo para casos antigos) e textura começam SEM escolha e são obrigatórias para gerar. Ao abrir a
  foto, `runMapping` acha a boca (MediaPipe, `FaceLandmarker` invisível na tela) e encaixa os dentes 15–25
  (`lib/smile/mapping.ts`: `fitTeethToPhoto`/autofit quando confiável e plausível, senão só pela largura da boca;
  foto espelhada troca os números). `components/SmileMap.tsx` mostra um recorte ampliado da boca com os números;
  com forma escolhida, a silhueta dela em cada dente (contornos de `teeth.ts`, pré-molares com o do canino); com
  textura escolhida, prévia transparente nos 12/11/21/22 (lisa = brilho; natural = periquimácias, sulcos, incisal
  translúcida; caracterizada = + mamelos, halo, colo saturado, manchas, trinca). "Tamanho": Todos ou um dente
  (chip ou toque na foto), Incisal/Cervical ± 0,5 mm (até ±3 mm, escala px/mm pelo central = 8,5 mm);
  `describeLengths` põe os ajustes na instrução da IA. Com resultado, chips "Planejamento" / "Antes e depois".
  DELIMITAR A BOCA (2026-10-22): o detector precisa do ROSTO inteiro; em foto de sorriso de perto ele falha. Aí
  aparece "Delimitar a boca" (e, quando achou, "Ajustar a boca"): `components/MouthEditor.tsx` com 8 pontos (C
  cantos, S lábio superior, I lábio inferior; contorno inicial `centeredMouth`), vista que se aproxima da boca a
  cada ponto solto (`mouthCrop`); "Pronto" encaixa os dentes dentro do contorno (`mapInMouth`: autofit ou
  largura da boca, 15–25 ocupando 95 % entre as comissuras).
  ARCO + ZOOM + FOTO FIXA (2026-10-22, pedido do Gustavo): `ToothMap` guarda o encaixe (`base`) e `archTeeth(map,
  arch)` monta os dentes com `ArchEdit` — largura do central em mm (fecha/abre o arco só na largura, passos de
  0,25 mm, 6,5–11), altura (sobe/desce o arco inteiro, 0,5 mm, ±4) e "Proporção áurea" (larguras vistas de frente
  1 : 0,618 : 0,382, pré-molares 0,33/0,27; ignora as larguras medidas). `describeArch` vai na instrução da IA junto
  com `describeLengths`. O recorte da vista usa o encaixe original (não pula ao ajustar). `SmileMap` tem pinça (até
  5x) e, aproximado, arrasto com um dedo; selo "tocar para 1x". A tela agora é foto FIXA no topo (planejamento,
  delimitar boca, antes e depois ou a animação de geração) ocupando METADE da área da tela (`photoH`; SmileMap e MouthEditor recortam na proporção da caixa) e as opções
  rolam embaixo. `SmileGenerating` preenche a caixa do pai.
  ALÇAS NA SILHUETA (2026-10-22, vídeo do SmileCloud que ele mandou): os botões do arco saíram; arrastar com um dedo
  em cima dos dentes (`ArchBody`) move o conjunto inteiro e um toque rápido escolhe o dente; `SmileMap` desenha
  alças (`archHandles`): ✥ em cima no meio move o arco (dx/dy mm), colchetes ciano nas pontas = "curva distal"
  (para os lados abre/fecha o arco — `open`, largura aparente de canino/pré-molares, corredor bucal; para cima/baixo
  muda a curva do sorriso — `curveMm`), barras brancas embaixo nas pontas = largura (`centralMm`). Lógica pura em
  `dragArch` (mapping.ts); texto no canto enquanto arrasta. Ficou "Zerar arco" (os chips Natural/Áurea saíram em 2026-10-22: "não faz sentido"; `golden` segue no modelo, sempre falso).
  VARREDURA DA BOCA (2026-10-22): sem rosto na foto, `runMapping` usa `scanMouthInPhoto` (detect.ts) →
  `lib/smile/mouthScan.ts#scanMouth` (foto a 360 px, Lab): dentes = claros e pouco croma; junta os dentes
  (dilatação) e escolhe o grupo largo com vermelho em volta e escuro entre os dentes (evita brilho do nariz);
  cresce pelos dentes e pelo escuro, e nas laterais pelo corredor bucal (menos vermelho que o lábio); sobe sobre a
  gengiva à mostra até o lábio; contorno pelo lado de dentro dos lábios, cantos nas pontas (8 pontos). Testado nas
  fotos de perto do Gustavo e no quadro do vídeo do SmileCloud (fixtures fora do git em `reference/scan-test/`);
  teste sintético em `tests/mouthScan.test.ts`. O contorno aparece tracejado sobre a foto (`SmileMap` prop `mouth`).
  FOTO INTEIRA + MOLDURA (2026-10-22, ele achou que o recorte na boca "cortava muito o rosto"): `SmileMap` mostra a
  foto INTEIRA no quadro (sem recorte na boca), pinça até 8x; números, contornos e alças são divididos pelo zoom
  para ficarem do mesmo tamanho na tela. Para a foto encher o quadro: `lib/smile/frameAspect.ts` (proporção do
  quadro = metade da área); a câmera do Smile Design (`smile/capture.tsx`, `faceGuide(W, H, aspect)`) mostra a
  moldura nessa proporção, escurece o resto e corta a foto nela; foto da galeria (na câmera ou em "Escolher da
  galeria") abre `components/PhotoCropper.tsx` (moldura fixa, arrastar/pinça, "Cortar e usar" ou "Usar a foto
  inteira"); `PendingPhoto.crop` avisa a tela para abrir o corte.
  CORREÇÕES (print do Gustavo, 2026-10-22): o `FaceLandmarker` montava só depois de escolher a foto, então a 1ª
  detecção sempre falhava — agora as duas versões da tela (sem foto / com foto) têm a mesma raiz e ordem (corte,
  detector), e ele já está carregado. Na varredura, o limiar dos dentes ficou relativo à PELE (no máx. pele + 8):
  com parede branca ao fundo, dentes amarelados/sombreados ficavam de fora. `centeredMouth` agora começa abaixo do
  meio (60 %) e `mouthCrop` nunca passa do tamanho da foto (sem faixas pretas no editor).
  HEMIARCOS (2026-10-23): chips "Simétrico" / "Hemiarcos separados (11–15 / 21–25)". `ArchEdit.left/right`
  (lado DA FOTO; foto espelhada troca os números) somam largura, abertura e curva só daquela metade; `dragArch(...,
  linked)` aplica nos dois ou só no lado da alça; a linha média não anda (o espaço central não depende da largura).
  `describeArch(arch, mirrored)` nomeia o hemiarco para a IA.
  DENTE A DENTE NA SILHUETA (2026-10-22): tocar num dente mostra barrinhas rosé (`toothHandles` em SmileMap):
  em cima = cervical, embaixo = incisal, lados = largura daquele dente (`LengthEdit.width`, mm; `archTeeth(map, arch,
  edits)` soma a largura no layout e os vizinhos se acomodam). Arrasto livre em 0,1 mm (`setToothEdit`), botões
  de 0,5 mm na seção Tamanho (Incisal, Cervical, Largura). Tudo vai na instrução da IA (`describeLengths`).
  IMAGEM-GUIA (2026-10-23, 1º teste com crédito: "a mudança quase não existiu"): `generateDesign` agora manda
  2 imagens — a foto e a MESMA foto com o planejamento desenhado (`lib/smile/guideImage.ts#paintGuide`: cada dente
  de `planTeeth` preenchido na cor-alvo, degradê colo→incisal, contorno escuro fino; feito em JS com jpeg-js) — e a
  instrução (`buildDesignPrompt`, `withGuide`) pede uma transformação CLARAMENTE VISÍVEL (facetas/coroas novas),
  ocupando exatamente as formas da imagem 2, sem copiar o preenchimento nem os contornos. Depois do 2º teste
  (diastemas ficaram, 21 torto): `ALIGNMENT` sempre na instrução (fechar todos os diastemas, dentes retos, 11/21
  simétricos, não manter espaço/rotação original) e o guia desenha os dentes encostados (+4 % de largura) com linha
  discreta na própria cor (a linha escura era lida como espaço). Custo por geração
  medido: ~R$ 0,21 no Nano Banana 2 Lite (US$ 0,034/imagem).
  SORRISO BAIXO (2026-10-26, enceramento do Gustavo com pouca exposição dentária saiu com dentes gigantes): três
  mudanças. (1) `paintGuide(..., clip)` só pinta dentro da abertura dos lábios (`mouthPolygon` em mouth.ts amostra o
  contorno suave; `DesignGuide.mouth`), e a instrução com guia diz que o resto do dente fica escondido atrás do
  lábio e que os lábios não se movem. (2) `anchorToLip` (mapping.ts): se o encaixe automático achou o "colo"
  encostado no lábio superior (< 0,3 da largura do central) com altura vista < 1,2, a silhueta é ancorada pela
  INCISAL e a coroa inteira (1,2) sobe por trás do lábio; sorriso alto não muda. (3) Com guia, o prompt NÃO pede
  mais "transformação CLARAMENTE VISÍVEL" nem "centrais dominantes": tamanho, comprimento e posição vêm SÓ da
  imagem 2 (sem guia, o texto antigo continua). Na tela, `SmileMap` recorta as silhuetas pela boca
  (`clip-mouth`) e mostra a parte atrás dos lábios tracejada e tênue, igual ao que a IA recebe.
  REMOVIDOS nessa data: editor manual (contorno, boca, ajustar, face-bow na tela, biblioteca 2D de sorrisos,
  cenários, rascunho automático) e a tela separada "Sorriso por IA". Ficaram só bibliotecas usadas por outras
  partes ou por testes: `lib/smile/teeth.ts` (tipos de `SmileParams`), `mouth.ts` (a análise de cor usa a boca
  detectada para posicionar os quadros), `frame.ts`, `autofit.ts` e `lib/face/*` (MediaPipe).
- Histórico (já descartado, não refazer): sprites das anatomias do exocad, arco 3D ao vivo com three.js, biblioteca
  2D recortada de imagem e editor manual de contornos — o Gustavo achou todos "sem forma" ou difíceis de usar; o
  realismo que ele quer é o de IA guiada (ver `docs/smilecloud-estudo.md` e `docs/smilefy-estudo.md`).
- CASOS (2026-10-22, pedido do Gustavo): `app/cases/index.tsx` com duas abas (Tomada de cor / Smile Design, com
  contagem). Na aba de cor: `components/SwipeRow.tsx` (responder do View, regras puras em `lib/swipe.ts`) — arrastar
  para a direita envia o PDF (`lib/report/shareShadeCase.ts`, o mesmo do detalhe), para a esquerda exclui com
  "Tem certeza…?"; "Selecionar" no cabeçalho (ou toque longo) marca casos, com "Selecionar todos" e "Excluir /
  Excluir todos" (`deleteCases`). Desde 2026-10-23 a aba de Smile Design tem os mesmos gestos e
  seleção (enviar = imagem da simulação, `lib/report/shareSmileCase.ts`).
- `src/lib/storage/` AsyncStorage: `settings.ts` e `cases.ts` (`ShadeCase` | `SmileCase`, fotos copiadas para
  `Paths.document/cases`).
- `src/components/` `Marker` (quadro de amostra), `BeforeAfter`, `AiConfig`, `FaceLandmarker` (MediaPipe invisível), etc.
- `tests/` vitest; `eas.json` perfis de build; `reference/anatomia/` (fora do git, ver README lá) cópia filtrada da
  biblioteca de dentes do exocad (139 bibliotecas legíveis) e `reference/renders/` prévias + folha de contato.

## Backup dos casos (2026-10-23)

Cada endereço do app no Expo Go (servidor da clínica, versão publicada) e o futuro app instalado têm armazenamento
SEPARADO (o Gustavo achou que os casos tinham sido excluídos). Configurações › "Backup dos casos": `lib/storage/
backup.ts#exportCases` grava um .json (formato em `backupFormat.ts`, fotos em base64, escrito caso a caso com
append) e abre o compartilhar; `importCases` (via expo-document-picker) recria as fotos em `Paths.document/cases`
e salva só os casos com id novo. Não leva login, chave da IA nem calibrações.
ATENÇÃO: no Expo Go a pasta de dados vem do `extra.eas.projectId` (sem ele, pasta anônima). Ligar o projeto à conta
Expo em 2026-10-23 "sumiu" com os casos; foram recuperados tirando o projectId por um momento, exportando e
importando. Não remover/trocar o projectId sem combinar com o Gustavo.

## Publicar para usar fora da rede (EAS Update no Expo Go, desde 2026-10-23)

Projeto Expo `@gustavosaints/shadelab` (projectId 35123588-021a-48a9-a226-8f0861c35600), `runtimeVersion` policy
`sdkVersion` (= `exposdk:57.0.0`, o que o Expo Go aceita), branch e canal `preview`. O Gustavo abre pelo link/QR
fixo `exp://u.expo.dev/35123588-021a-48a9-a226-8f0861c35600?runtime-version=exposdk%3A57.0.0&channel-name=preview`
(`expo-go-qr.svg` na raiz, fora do git). Para publicar uma versão nova (no Windows o `eas update` direto falha com
"C:\Program não é reconhecido" no Git Bash; usar PowerShell, exportar antes e pular o git):

```powershell
npx expo export --platform ios --output-dir dist
$env:EAS_NO_VCS = '1'; npx eas-cli@latest update --branch preview --platform ios --environment preview --message "..." --skip-bundler --input-dir dist --non-interactive
```

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
