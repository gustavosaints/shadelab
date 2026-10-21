# Estudo: SmileFy e ideias para o ShadeLab

Pesquisa feita em 2026-10-15 a partir de smilefy.com (páginas de plataforma, soluções, preços e recursos),
da ficha do app SmileFy TNG na App Store, de comunicados à imprensa e de páginas de cursos. Fontes no fim.

## 1. O que é

- **Empresa**: SmileFy Inc. (Fort Lauderdale, EUA). Fundador e CEO: Ralph Georg, que antes foi CTO/co-fundador
  do DSD App (o app do Coachman). Ou seja, o SmileFy é a "segunda geração" feita por quem construiu o DSD App,
  agora com IA e 3D, e concorre diretamente com o DSD.
- **Produto de 2021 a 2023 (SmileFy TNG)**: app para iPad/iPhone/Mac com análise de sorriso 2D (marcos faciais
  com medidas angulares, "30 anos de know-how de smile design"), bibliotecas de dentes, design 3D guiado em
  6 passos, editor de malha com pincéis (inflar, suavizar), planejamento de facetas, carta dentária com guia
  canina, numeração FDI/universal, exportação STL e impressão direta. Vendido junto com a assinatura da
  SmileFy Academy (reclamação comum: só dava para usar fazendo o curso). Nota 2,8 a 4,1 na App Store, poucas
  avaliações; queixas de travamentos e suporte (2022). Tamanho do app: 3 GB.
- **Produto atual (2024–2026, SmileFy 4.x e plataforma web ai.smilefy.app)**: "plataforma de planejamento de
  tratamento com IA". Cadeia completa: Simulação de sorriso → Plano de tratamento IA → Design 3D → Impressão 3D
  → Tratamento. Funciona em qualquer aparelho (web), qualquer scanner intraoral, sem instalação.

## 2. Preços (site, outubro de 2026)

| Plano | Preço | O que inclui |
|---|---|---|
| Simulação de sorriso IA | US$ 99/mês ou 699/ano | simulações e vídeos ilimitados |
| Starter | US$ 129/mês ou 1.299/ano | simulações + vídeos + treinamento + suporte, 1 usuário |
| Professional | US$ 259/mês ou 2.599/ano | + design 3D ilimitado, STL ilimitado, articulador IA, fluxo All-on-X |
| Enterprise | a partir de US$ 2.500/mês | APIs (simulação, design a partir de STL, design pronto para impressão) |
| Design4Me (terceirização) | US$ 100 por design (90 em pacote de 10) | design 3D pronto para impressão em 24 h |

Trial de 7 dias, sem cartão. Laboratório e especialistas entram de graça como colaboradores.

## 3. Como o software se comporta (recurso a recurso)

1. **Simulação de sorriso com um clique**: foto frontal sorrindo → escolhe o tipo de tratamento (facetas,
   ortodontia, clareamento, gengivectomia, implantes, arco total) → IA gera a simulação em < 60 s, "guiada pela
   face" (avalia simetria facial, arco do sorriso, linha média dental × face, proporções, harmonia). Gera também
   um **vídeo** da transformação (antes → depois animado) e um antes/depois com cortina deslizante.
2. **Relatório diagnóstico estruturado** gerado automaticamente: simetria facial, linha do sorriso e dinâmica
   labial, simetria das margens gengivais, proporções comprimento/largura, exposição gengival, harmonia; no
   caso gengival, quanto remover. Serve para consulta, encaminhamento e comunicação com o laboratório.
3. **Calibração foto ↔ scan intraoral**: alinha a foto ao STL para medidas precisas e para o 3D ficar
   "guiado pela face".
4. **Smile frame facial** sobre o 3D (mesma ideia do DSD) e **até 3 templates de design** gerados para comparar
   lado a lado.
5. **Design 3D a partir do scan** (passos: enviar scan → IA gera o setup respeitando anatomia, oclusão e forma
   do arco → refinar → exportar). Refinamento por **instruções em texto ou voz** ("deixe os centrais um pouco
   maiores", "ajuste a curva do sorriso"). Ajustes de posição, forma, proporção, contatos, gengiva, espessura.
6. **Articulador com IA**: mapa de calor dos contatos oclusais, protrusiva e lateralidades, relatório de
   oclusão com recomendações de ajuste.
7. **Renderização do 3D em cor natural ou num tom VITA escolhido**, com antes/depois.
8. **Saídas prontas para impressão**: mock-up/enceramento, provisórios, facetas impressas, conchas (shells),
   guia de gengivectomia, provisório All-on-X, guia cirúrgico; compatível com 3Shape, Dexis, Medit e outros.
9. **Collaboration Suite**: sala de chat por caso (HIPAA), arquivos STL e designs no fio da conversa,
   tradução automática em 15 idiomas, áudio/vídeo, laboratório entra sem assinatura.
10. **Fluxos por especialidade**: cosmético (6 passos), gengivectomia (5 passos), ortodontia (simular no rosto
    antes de mandar para o planejamento de alinhadores), All-on-X, laboratório, DSO.
11. **SmileFy Drive** (armazenamento de casos), tutoriais em YouTube, academia com cursos presenciais
    (AU$ 3.999 o de 2 dias).

Números de marketing: 200.000 simulações, 98% de aceitação de caso "reportada", 1.250 membros.

## 4. Comparação direta com o ShadeLab

| Tema | SmileFy | ShadeLab hoje |
|---|---|---|
| Simulação | IA generativa a partir da foto, 60 s | sprites de anatomia real posicionados à mão, tingidos pela cor-alvo |
| Cor do dente | escolhe tom VITA para renderizar | **mede** a cor do dente real (CIELAB, ΔE00, calibração da escala) — SmileFy não tem |
| Análise facial | automática (IA) + relatório | manual (pontos arrastáveis) + métricas; sem relatório |
| 3D / STL | sim, a partir de scan intraoral | não (planejado: 3D ao vivo) |
| Boca / lábios | IA segmenta | contorno manual com 8 pontos (feito ontem) |
| Antes/depois | cortina deslizante + vídeo | "segure para ver o antes" |
| Laboratório | chat por caso, STL, relatório | PDF de prescrição de cor |
| Preço | US$ 99–259/mês | próprio |

O ShadeLab não vai competir no 3D a partir de scan intraoral com IA. Onde ele pode ganhar: cor medida (ninguém
dos dois faz), simplicidade, custo zero e um 2D bem feito. O que vale copiar são as **ideias de produto**.

## 5. Ideias para trazer (em ordem de valor × esforço)

1. **Cenários de tratamento como botões** (facetas, clareamento, gengivectomia, fechamento de diastema,
   alinhamento): cada um é um preset de parâmetros (anatomia, cor, comprimento, espaçamento, linha gengival).
   O dentista toca e vê; é o que vende o "um clique" do SmileFy. Esforço baixo.
2. **Antes/depois com cortina deslizante** na tela e na imagem exportada (lado a lado e cortina). Baixo.
3. **Relatório diagnóstico em PDF** com a análise facial já calculada (linha média, inclinação, proporção
   L/C, proporções laterais/caninos, curva do sorriso), a cor medida e a cor-alvo, com as imagens. Médio.
4. **Simulação de clareamento**: a cor-alvo aplicada sobre os dentes reais da foto (dentro do contorno da
   boca), sem trocar a forma — usa a máscara da boca que já existe e a cor medida pelo módulo de cor. Médio.
5. **Vídeo da transformação** (antes → depois com fade/cortina) exportado como MP4 ou GIF para o paciente
   levar; no Expo dá para montar quadro a quadro com view-shot. Médio.
6. **Camada de gengiva**: editar a linha gengival na simulação (gengivectomia visual) com cor rosada medida
   da própria foto. Médio.
7. **Marcos faciais automáticos** (MediaPipe/Vision no aparelho) para preencher pupilas, comissuras e lábios
   sozinhos; o contorno da boca viria pronto. Alto, mas é o maior salto de usabilidade.
8. **Templates comparáveis**: guardar 2–3 variações do mesmo caso e mostrar lado a lado. Baixo/médio.
9. **Compartilhar caso com o laboratório** via link/PDF com a prescrição de cor + imagem da simulação +
   parâmetros (mais tarde, chat). Médio.
10. **Exportar o desenho 2D para o exocad Smile Creator** (o Gustavo tem exocad): imagem calibrada +
    parâmetros em JSON. Baixo.

O que não vale perseguir agora: IA generativa de foto (custo de servidor, qualidade imprevisível, e tira o
controle do dentista), 3D a partir de scan intraoral, articulador virtual.

## 6. O app em uso (vídeos do Gustavo, 2026-10-21)

Dois vídeos gravados no iPhone (4 min + 2,5 min) percorrendo o SmileFy v4.8.1 de ponta a ponta. O que aparece na tela:

### 6.1 Paciente e documentação
- Menu: Novo Paciente, Meus Pacientes, Colabore, Notificações, Suporte, Conta.
- Ficha "Digitalização do Paciente" com grade de fotos por categoria: Sorriso exagerado, Frontal em repouso, Sorriso com
  afastador, Perfil em repouso, Perfil sorrindo, 12 horas; "Arquivos adicionais": vídeo de entrevista, arquivos, objeto 3D,
  scan facial. Botão **Calibrar** no rodapé. Origem da foto: SmileFy Drive, Virtual Patient, Galeria, Tirar foto, iCloud,
  Dropbox, GDrive.
- Câmera "Foto de Sorriso IA": guia de rosto desenhado por cima do vídeo (traço branco, olhos/nariz/boca), chave M/AI, botão
  vermelho de gravar e botão de foto. Sem validação verde/vermelha visível.
- Ficha do caso: nome, foto, "Versão de nota curta", notas, "Guardar o caso". Lista de pacientes com Abrir / Colabore /
  DesignForMe (serviço pago de desenho) e nuvem de sincronia.
- **Linha do tempo do paciente**: cada ação vira um cartão datado (Documentação do Paciente, Smile Design IA, …). "Novo
  Projeto": Digitalização, Calibração dos Arquivos, Exportar, Smile Design IA, Simulação de Sorriso 3D, Design de Sorriso 3D.

### 6.2 Smile Design IA (One Click)
- Abas SmileFyAI / AI Clinical Doc / SmileFyAVA. Opções: Smile Design (natural colors), Crown Lengthening & Dominant, Ortho &
  Veneers, Straight Dentition, Gummy Smile, Hollywood Smile Design, Edentulous Full Arch Implant Bridge, Bleaching; Smile
  Design With Templates; Merge Smile; IOS Analysis Frontal / Occlusal.
- "Edição IA": Melhoria de Imagem (Picture Quality, Remove Background, Blur Background) e Paciente Virtual (CranioFacial
  Assessment, Align Head Frontally, Bigger Smile); AVA: 45 & 90 degrees, Profile 45, Profile 90.
- Resultado em ~20 s ("Generating image…"), com Desfazer/Refazer e botão "Original" para comparar. No vídeo a IA só
  clareou/alinhou levemente; o rosto ficou igual.

### 6.3 Simulação de Sorriso 3D (o editor manual — o que mais interessa)
- **Primeiro vem a grade, depois os dentes**: ao abrir, o app desenha só um "arame": curva do sorriso (incisal) e curva
  gengival em linha branca pontilhada, e cada dente como um segmento vertical verde com pontos brancos nas pontas
  (gengival/incisal). Duas alças vermelhas **curve** nas comissuras mudam a curvatura; setas vermelhas grandes
  (horizontal e vertical) movem o conjunto. Só quando o usuário pede "Estética"/"3D Fy" é que a biblioteca é renderizada
  ("Por favor, aguarde…"). Isso deixa o posicionamento rápido e sem distração.
- Modos de toque na foto: **Posicionar / Girar / Tamanho / (A) Todos / Off**.
- Régua "Sorriso Frontal — Todos — SmileFyAVA" (quais dentes/vistas).
- Abas: **QUADR.** (frame), **AJUSTES**, **LUZ 3D**, **MODELOS**.
  - QUADR.: Simetria on/off (desenha linhas horizontais de referência pela face), Facial thirds on/off, Linha média facial;
    Altura (min–max); **Cálculo Altura/Largura DIREITA e ESQUERDA** (slider 70–90 %, mostra 77/79/80); Curvatura do
    sorriso; Plano oclusal (inclinação); **Corredor bucal direita/esquerda**.
  - AJUSTES → Funções: **grupo** on/off (move em conjunto) e **refletir tamanho** (espelha o ajuste no dente homólogo).
  - LUZ 3D & CORES: Luz 3D on/off, posição (inferior–alto), brilho; **CORES DOS DENTES**: M1 M2 M3 B1 A1 B2 B3 USER +
    Intensidade de cor; **Sombra lábio superior** (inferior–alto) + Tam. sombra — uma sombra escura projetada do lábio
    sobre a cervical dos dentes, que é o que faz a simulação "entrar" na foto.
  - MODELOS: lista com prévia do arco (JCP, JCP2, SFY10, GZ, FO2, F31, MO5, FO6, SFYO1, SFYO2, SFYO3…); ao tocar, um
    cartão mostra o arco e os seis dentes individuais, com botões **F / S** (frontal / lateral). Toggle Estética / 3D Fy e
    botão Antes & Depois.
- Zoom por pinça na foto funciona durante o posicionamento (ele aproxima a boca até os dentes ocuparem a tela) e os
  pontos da grade acompanham.
- **Antes e Depois**: tela própria com linha vertical arrastável (Deslizar) ou Lado a Lado, botão "Compa(rar)".

### 6.4 O que isso muda na nossa lista
1. **Arame antes dos sprites** (alto valor, esforço médio): no passo Boca/Forma desenhar primeiro só as curvas e os eixos dos
   dentes (barato, nítido) e renderizar a anatomia ao entrar em Ajustar/Comparar ou por um toque "Ver dentes". Resolve a
   sensação de lentidão e facilita o encaixe.
2. **Sombra do lábio superior** (alto valor, esforço baixo): gradiente escuro do lábio para a cervical dentro do recorte da
   boca, com posição e tamanho ajustáveis. É o truque de realismo mais barato do SmileFy.
3. **Refletir tamanho / grupo** (médio, baixo): já temos `mirrorEdit`; falta o botão "espelhar para o outro lado" e o modo
   grupo visível.
4. **Cálculo altura/largura por lado** (médio, baixo): já calculamos a relação L/C do central no face-bow; expor como slider
   70–90 % que altera `heightRatio` por lado.
5. **Corredor bucal** (médio, médio): escurecer/estreitar os caninos e o espaço posterior; hoje só temos `ARCH_VIS`.
6. **Linha do tempo do paciente** (médio, médio): na tela do caso, listar eventos (cor tirada, simulação, variação) em ordem.
7. **Categorias de foto** (baixo por enquanto): só se o fluxo de documentação for adotado.

## Fontes

- https://smilefy.com/pricing
- https://smilefy.com/solutions/ai-smile-simulation
- https://smilefy.com/platform/ai-3d-design
- https://smilefy.com/platform/ai-treatment-design
- https://smilefy.com/platform/3d-print-ready-design
- https://smilefy.com/platform/collaboration-suite
- https://smilefy.com/solutions/cosmetic
- https://smilefy.com/solutions/gingivectomy
- https://smilefy.com/solutions/orthodontic
- https://smilefy.com/resources
- https://mwm.ai/apps/smilefy-tng/1560854610
- https://www.dentalproductsreport.com/view/new-smilefy-4-0-features-innovative-3d-smile-design-powered-by-ai
- https://instituteofdigitaldentistry.com/free-online-dentistry-courses/smilefy-the-newest-3d-digital-smile-design-software/
- https://justuseapp.com/en/app/1560854610/smilefy-tng/contact
