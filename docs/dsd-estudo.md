# Estudo: Digital Smile Design (DSD) e o que levar para o ShadeLab

Pesquisa feita em 2026-10-14 a partir do site digitalsmiledesign.com, da apostila original "The Digital Smile
Design Concept" (Coachman, Yoshinaga, Calamita, Sesma), do artigo "DSDapp use for multidisciplinary esthetic
planning" (J Esthet Restor Dent 2020), da revisão "Digital Smile Design: an overview of 3D digital workflow"
(JCDR 2023) e de repositórios públicos no GitHub. Fontes no fim.

## 1. O que o DSD é

- **Marca e empresa**: Digital Smile Design é uma empresa (DSD Planning Center SL, Madrid) fundada por
  Christian Coachman (dentista e técnico brasileiro). Vende educação, consultoria, uma rede de clínicas
  certificadas, um centro de planejamento/laboratório digital e um app.
- **Conceito**: planejamento estético "guiado pela face" (facially driven). Começou em 2007 com desenhos em
  Keynote/PowerPoint sobre fotos; hoje liga o desenho 2D a enceramento digital 3D, ortodontia, cirurgia guiada
  e CAD/CAM. Coachman descreve seis gerações: desenho a mão sobre foto → desenho 2D digital → 2D com ligação
  analógica ao modelo → 2D com ligação 3D digital → fluxo 100% 3D → "4D" (movimento).
- **Não existe código aberto do DSD.** O software é fechado (DSD App para iPad/Mac M1, sem Android). O que há
  no GitHub são projetos acadêmicos pequenos (ver seção 6).

## 2. Ecossistema e preços (site, outubro de 2026, valores variam por país)

| Produto | O que é | Preço informado |
|---|---|---|
| DSD App | Simulador 2D grátis para iPad/Mac. Só desenha sobre foto; não gera 3D nem mock-up. | grátis |
| DSD Online | E-learning com a certificação do app | US$ 35/mês |
| DSD Provider (curso) | 2 dias; libera acesso ao Planning Center | US$ 700 on demand a US$ 2.900 presencial |
| DSD Provider (assinatura) | 1 desenho/mês incluso, casos ilimitados no lab | ~US$ 595–650/mês ou ~US$ 6.990/ano |
| Planning Center & Lab | Desenho 2D+3D do sorriso, enceramento digital, mock-up motivacional (STL), ortho setup, guias, restaurações "DSD Natural" | US$ 160–870 por produto; casos complexos US$ 300–1.500 |
| DSD Clinic (rede) | Clínica certificada, acesso ilimitado | a partir de US$ 6.000/mês |
| DSD Residency 1 e 2 | Cursos longos | US$ 3.300–7.725 (2023) |

O que o dentista envia ao Planning Center: 5 fotos faciais, 1 vídeo e 3 scans intraorais (CBCT e raio‑X em
casos complexos). Recebe: STLs do desenho sobre o modelo original e sobre o modelo reduzido, STL do mock-up
motivacional, relatório e apresentação em PowerPoint. Prazo: DSD Upper em 3 dias úteis, interdisciplinar em 7.

## 3. Protocolo de documentação (apostila)

**Vídeos com smartphone, não fotos.** 8 vídeos: 4 técnicos e 4 complementares. A foto é um frame do vídeo
(30 quadros/s aumenta a chance de pegar o sorriso espontâneo, que dura ~500 ms).

Técnicos:
1. Frontal facial, com e sem afastador, sorrindo, dentes separados (jig de silicone nos molares), câmera na
   altura dos olhos, ~1 m de distância com zoom digital leve para reduzir distorção. Cabeça e câmera paradas
   para as duas imagens se sobreporem.
2. Perfil: lábios em repouso e sorriso "E"; referência é o filtro.
3. "12 horas": de cima da cabeça, paciente afasta o lábio com os polegares; mostra a relação linha média
   facial, linha bipupilar, comissuras, ângulos da mandíbula, mento, forma do arco e vermelhão do lábio
   inferior.
4. Oclusal anterior, perpendicular ao plano oclusal, de pré-molar a pré-molar, rafe palatina reta.

Complementares: entrevista (4 perguntas: por que procura tratamento, do que gosta/não gosta no sorriso,
expectativas, o que entende por sorriso ideal), fonética em close (contar de 0 a 10, F/V/S, sorriso normal e
"E"), funcional intraoral (protrusão e lateralidades), estrutural (oclusais superior e inferior).

Estúdio: 2 painéis LED frontais, fundo neutro (preto é mais fácil de manter uniforme que branco), paciente a
~0,5 m da parede, monopé e apoio de cabeça.

## 4. O "Smile Frame" (quadro do sorriso) em 8 passos — o coração do método

1. **Face-bow digital**: linha média facial (glabela → filtro) e referência horizontal (bipupilar e
   intercomissural). Decide-se se há desvio ou inclinação da linha média dental e qual referência adotar.
   Desvio de 2–3 mm passa despercebido olhando só o sorriso; em foto da face inteira, 1 mm já pode ser
   percebido em faces assimétricas.
2. **Curva do sorriso**: definida com a análise do vídeo em 3 momentos: repouso (relação lábio superior ×
   bordas incisais), sorriso natural (corredor bucal × bochechas: alargar ou estreitar o arco), sorriso
   angulado (comprimento dos posteriores × lábio inferior: curva mais plana ou mais inclinada).
3. **Proporção interdental (largura)**: o DSD recomenda a **proporção RED** (Recurring Esthetic Dental), não
   a áurea: vista de frente, se o central mede x, o lateral mede 0,7x e o canino 0,5x. O distal dos caninos
   pode ser balizado por referências faciais (canto interno dos olhos, asas do nariz, comissuras em repouso).
4. **Proporção largura/comprimento do central**: ideal ~80%, trabalha-se entre 70 e 90%.
5. **Curva gengival**: sobre o colo do novo central, inclinando para posterior conforme a exposição gengival.
6. **Curva das papilas**: um pouco abaixo da gengival; a papila tem ~40% da altura da coroa. No app, duas
   linhas pontilhadas marcam a zona de 30–50% a partir do colo.
7. **Curva do vermelhão** (vista 12 horas): define a posição vestíbulo-palatina de cada anterior.
8. **Curva do arco** (vista oclusal): arco estreito ou largo em relação à face, distribuição de espaços,
   apinhamento, diastemas, espaço para implante.

Depois: **régua digital** (calibra-se uma medida real, normalmente distal-a-distal dos centrais medida com
paquímetro no modelo, e transferem-se as medidas do desenho para o enceramento com o paquímetro) →
enceramento vestibular (sem cobrir oclusal, para avaliar função no articulador) → mock-up motivacional
("test drive", filmado) → apresentação do plano → fluxo 2D/3D (NemoDSD, exocad, 3Shape, Cerec) → guias,
provisórios e restaurações.

## 5. Como o DSD App se comporta (iPad)

Fluxo em tela, pela certificação e pelas capturas da loja:
1. Importa foto frontal de sorriso máximo (mínimo) e, opcionalmente, close do sorriso ou scan intraoral
   sobreposto (a calibração com scan dá precisão "3D").
2. **Calibração**: marca pupilas, glabela, ponta do nariz, filtro, mento, comissuras e a largura real dos
   dois centrais; a foto pode ser girada para nivelar. Mostra régua de 20 mm.
3. **Análise facial**: plano horizontal (bipupilar/intercomissural), linha média facial (glabela–filtro),
   sobreposição vermelho/verde de simetria.
4. **Smile frame**: linha média real × ideal, guia dos caninos, curva do sorriso, curva gengival, curva das
   papilas, proporção dos 6 anteriores. Sliders de comprimento do central e relação largura/comprimento;
   setas para mover/dimensionar cada dente.
5. **Biblioteca "Smile Donator"**: 10 bibliotecas de formas de dentes (doadas por Coachman e outros); pode
   misturar anatomias entre dentes.
6. **Cor e integração**: contorno do lábio, cor do dente (brilho, saturação, calor, contraste, matiz) e
   **blur** para igualar a resolução da foto; **camada de gengiva** com cor/opacidade e **carimbo (stamp)**
   para esconder os dentes originais; opacidade geral do sorriso.
7. **Saída**: "DSD Final Picture", antes/depois lado a lado ou com cortina, assinatura do paciente,
   desenhos e notas para o laboratório, PDF, compartilhamento com outros usuários do app (lab).
8. Também: medições precisas (gengivectomia, lascas), comparação de vários desenhos, casos de treino
   ("Try me"), digitalização do paciente (documentos), 13 idiomas, nuvem.

Limites assumidos pelo próprio DSD: só 2D, não move dentes de verdade, não gera mock-up; quem quer 3D compra
o serviço do Planning Center. Avaliação na App Store: 3,7 (poucas avaliações); 647 MB; versão 2.3.

Na revisão de Omar & Duarte (2017) o DSD App pontuou 10/20 em parâmetros de análise (Photoshop 20, Keynote
19, ADSD 18, Planmeca Romexis 13): a fraqueza apontada é a análise facial frontal e de perfil. Pontos fortes:
3D (via serviço), uso em tablet, fluxo organizado.

## 6. Código público relacionado (GitHub)

- `ahmed-sedky/smile-design`: trabalho de faculdade (Cairo), Python + PyQt5 + dlib + OpenCV; detecta "4
  defeitos" e sobrepõe templates. Sem licença declarada; não dá para reaproveitar código, só a ideia (marcos
  faciais automáticos com dlib/MediaPipe).
- `NileshRaut-code/dentist-smile-app` (hoje 404): app Android com MediaPipe, segmentação dos dentes pela
  boca e clareamento em CIELAB rumo a uma cor VITA, mais "alinhamento" das bordas incisais a um arco.
- Nada equivalente ao DSD App em código aberto. O ShadeLab, por já ter leitura de cor CIELAB e sprites de
  anatomia, está numa posição boa para cobrir o 2D.

## 7. Parâmetros numéricos úteis (DSD + literatura clássica)

| Parâmetro | Valor de referência |
|---|---|
| Largura/comprimento do central | 75–80% ideal; 70–90% aceitável |
| Larguras aparentes (RED) | lateral 0,70 × central; canino 0,50 × central |
| Proporção áurea (Lombardi/Levin) | lateral 0,618 × central; canino 0,382 × central |
| Percentual áureo (Snow) | central 25%, lateral 15%, canino 10% da largura dos 6 anteriores |
| Linha média dental × facial | perceptível a partir de ~1 mm na face inteira; 2–3 mm só no sorriso |
| Inclinação do plano incisal | paralelo à bipupilar (ou intercomissural se os olhos forem assimétricos) |
| Zênite gengival do lateral | 0,5–1 mm abaixo da linha central–canino (centrais e caninos nivelados) |
| Borda incisal do lateral | até 1 mm mais curta que a linha central–canino |
| Papila | ~40% da altura da coroa (ponto de contato: 50% de altura) |
| Exposição gengival | até 2–3 mm aceitável; > 3 mm "sorriso gengival" |
| Linha do sorriso | baixa (lábio cobre parte dos dentes), média (até 2 mm de gengiva), alta |
| Ameias incisais | aumentam progressivamente do central ao canino |
| Corredor bucal | intermediário: nem escuro demais nem eliminado |
| Curva do sorriso | bordas incisais paralelas ao lábio inferior; só o dente guia toca a curva |

## 8. O que aplicar no ShadeLab (prioridade)

Já existe: foto do sorriso, 6 anteriores com anatomia real tingida pela cor-alvo (equivalente ao Smile
Donator + cor), proporção natural/áurea, curva do sorriso, comparar antes/depois, salvar e compartilhar.

1. **Face-bow digital e calibração** (feito nesta rodada): pontos arrastáveis para pupilas, glabela, filtro,
   comissuras e distal dos centrais; largura real dos dois centrais em mm; linhas bipupilar, intercomissural
   e média facial; cálculo do desvio da linha média dental em mm e da inclinação do plano; botão para alinhar
   a linha média à face.
2. **Proporção RED** como terceira opção, e aviso quando a relação L/C do central sai de 70–90%.
3. **Curvas do smile frame** sobre a simulação: curva do sorriso (bordas incisais), curva gengival e linha
   das papilas a 40%.
4. Próximas rodadas: régua digital com medidas em mm sobre a foto (gengivectomia, comprimento), camada de
   gengiva (cor/opacidade) e "carimbo" para esconder dentes originais, blur para casar com a resolução da
   foto, antes/depois com cortina deslizante, relatório PDF do smile frame para o laboratório, exportação
   2D para o Smile Creator do exocad (a mesma biblioteca de dentes já está no app), marcos faciais
   automáticos (MediaPipe) e, por fim, vídeo (frames do sorriso espontâneo).

## Fontes

- https://digitalsmiledesign.com/dsd-app
- https://digitalsmiledesign.com/smile-design-app
- https://digitalsmiledesign.com/files/Old-Website-Assets/Media/Apostila_DSD.pdf
- https://digitalsmiledesign.com/membership/about-dsd-clinics/dsd-planning-center
- https://digitalsmiledesign.com/learning-hub/what-does-the-dsd-provider-plan-cost
- https://digitalsmiledesign.com/learning-hub/how-much-does-it-cost-to-submit-a-case-to-the-dsd-planning-center
- https://go.digitalsmiledesign.com/hubfs/DSD%20Articles/Articles%20by%20others/DSDapp%20use%20for%20multidisciplinary%20esthetic%20planning.pdf
- https://www.jcdr.net/articles/PDF/17386/61467_CE%5BRa1%5D_F(IS)_PF1(AB_KM)_PFA(AB_KM)_PN(KM).pdf
- https://infiniadental.com/digital-smile-design-10-rules-for-perfect-smile-designs/
- https://mwm.ai/apps/dsd-app/6476902245
- https://github.com/ahmed-sedky/smile-design
- https://exocad.com/smilecreator
