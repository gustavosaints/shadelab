# Digital Smile Project (DSP) — Dr. Gunnar Guimarães

Fonte: https://www.drgunnarguimaraes.com/digital-smile-project (lido em 2026-10-21). Página de venda de curso (Wix), com vídeo
de apresentação e botão de inscrição na Hotmart.

## O que é

- Método de planejamento digital do sorriso vendido como **curso gravado** (R$ 497, acesso por 1 ano, aulas em português,
  inglês e espanhol). Autor: Dr. Gunnar Guimarães, Goiânia, membro DSD desde 2016, projeto criado em 2022.
- Não é software próprio: o DSP é feito em **apps de desenho em camadas** (gratuito no computador; app de caneta pago uma vez,
  menos de US$ 5, em tablets Android/iOS) com **templates pré-configurados** e **bibliotecas de texturas e anatomias** que o
  aluno aprende a montar.
- Posicionamento: ferramenta de **venda** (simulação realista já na primeira consulta) + **guia de execução** para o
  laboratório (enceramento diagnóstico) + **conversão para exocad**.

## Fluxo ensinado

1. Fotografias do paciente → app de desenho em camadas (tablet ou notebook).
2. Análise detalhada do sorriso.
3. Simulações realistas (várias), escolhe-se a mais adequada.
4. Mock-up virtual: acréscimos e fechamento de diastemas em resina, laminados/facetas de porcelana, facetas de resina,
   cirurgias gengivais estéticas.
5. Comunicação com o laboratório → enceramento diagnóstico guiado pelo projeto.
6. Conversão do DSP para exocad.
7. **Mock-up em movimento**: vídeo realista do paciente falando e sorrindo com o projeto na boca.

## Conteúdo programático (10 módulos)

1. Ferramentas e dispositivos digitais. 2. Apps de desenho em camadas. 3. Templates pré-configurados. 4. Bibliotecas próprias
de texturas e anatomias. 5. DSP como ferramenta de venda. 6. Mock-up virtual e cirurgias gengivais. 7. Passo a passo do DSP.
8. Comunicação com o laboratório. 9. Conversão para exocad. 10. Mock-up em movimento (vídeo).

A página não fala de proporções, linha média, smile frame ou medidas: o foco é o **resultado visual realista** e o uso
comercial/laboratorial.

## O que o ShadeLab já cobre

- Simulação sobre a foto com anatomias reais (sprites dos .eoff do exocad), cor-alvo pela escala, cenários (facetas,
  clareamento, gengivectomia, diastema), antes/depois com cortina e variações, caso salvo e reabrível.
- Bibliotecas de anatomia escolhidas pelo usuário (11 do exocad).

## Ideias que o DSP sugere para o ShadeLab

1. **Textura por cima da anatomia** (módulo 4): além de fill/shade/gloss, uma camada de textura de esmalte (periquimáceas,
   translucidez incisal com mamelões) em PNG, com opacidade ajustável. É o que dá o "realismo de venda".
2. **Camada de gengiva** (módulo 6): já está na lista do DSD (docs/dsd-estudo.md §8) — carimbo de gengiva para esconder os
   dentes originais e simular gengivectomia/zênites.
3. **Blur/encaixe fotográfico**: suavizar bordas dos sprites e casar o brilho com a foto (também na lista do DSD).
4. **Exportar para o laboratório / exocad**: hoje o caso sai como imagem. Um PDF com foto original, simulação, medidas em mm
   (largura dos centrais calibrada), proporções e a anatomia escolhida (nome da biblioteca do exocad!) já serve de guia de
   enceramento, porque o laboratório tem a mesma biblioteca no exocad. Isso é uma vantagem natural do nosso pipeline.
5. **Mock-up em movimento** (módulo 10): gravar um vídeo curto do paciente e aplicar a simulação quadro a quadro com o
   MediaPipe (já usado na detecção) — ambicioso; fica para depois do 3D.
6. **Templates**: presets de "primeira consulta" (1 toque: cenário + cor + anatomia padrão do consultório) para acelerar a
   venda na cadeira.
