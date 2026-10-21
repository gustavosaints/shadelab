# Smilecloud — Smile Design v2 (visto na conta do Gustavo, 2026-10-21)

Fonte: https://app.smilecloud.com (caso de demonstração "John Doe", pasta STUDIO ART). Navegado pelo Chrome do
Gustavo; o projeto "Laredo" já vinha pronto e eu criei o projeto "Giza" no caso de demonstração para ver as
ferramentas (pode ser apagado em "…" → Eliminar).

## Estrutura do caso

- Topo: **Documentação · Projetos · Metalab**. Documentação = galerias de fotos (retratos, intraorais), vídeo
  (.mov), scans STL (superior/inferior) e CBCT (.dcm), com favoritos (estrela) e coleções.
- Painel esquerdo: **Conversa em equipe** (chat do caso, com o suporte e o laboratório). "Partilhado com",
  "Team-Up Requests".
- Projetos: cartões com miniatura; **Novo Projeto** → *Design de Sorriso*, *Signature Design*, *Rever*, *Comparar*.
- Modo apresentação (ícone ▣ ao lado do nome): antes/depois lado a lado com cursor, botão **Simulação em Vídeo**.
- **Exportar** no topo direito.

## Fluxo do Design de Sorriso v2

1. **Adicionar retrato**: escolher o retrato frontal sorrindo da documentação (um deles vem marcado com ✨ =
   recomendado pela IA).
2. **Versão melhorada por IA**: tela com antes/depois (cursor) oferecendo a foto tratada pela IA (luz/pele);
   "Continuar com o Original" ou "Continuar com a Versão Melhorada" ("você aceita quaisquer diferenças
   introduzidas pela IA").
3. **Contornos automáticos**: ao abrir, o app já desenhou os CONTORNOS dos dentes (13–23 + posteriores) em
   linha branca sobre a foto, dentro de uma **guia do arco** tracejada (curva gengival em cima, curva incisal
   embaixo, alças nas comissuras). Nada de dentes renderizados ainda — só o "arame", como no SmileFy.
4. **Edição dente a dente**: clicar num dente dá zoom na boca e abre a barra: `‹ 11 ›` (navega pelos dentes),
   **Remover**, seletor de **forma** (6 formas por dente, miniaturas; "Par" = aplica ao homólogo), **Espelhar**,
   **Inverter**, **Restaurar**. Dicas ("Gimbal invisível"): arrastar move; **Ctrl+arrastar** roda livremente;
   **Ctrl+arrastar na margem** roda; **Shift** move livre sem ajustar à guia contralateral; **Alt** move o dente
   para fora da arcada mantendo os vizinhos no lugar. Tecla **T** mostra/oculta as dicas.
5. **Gerar HD**: botão central que manda os contornos + foto para a IA e devolve os dentes FOTORREALISTAS dentro
   dos contornos (é daí que vem o realismo: render generativo guiado pelos contornos, não biblioteca de PNG).
6. Barra inferior do resultado: **Cursor de Visibilidade Superior** (mistura design/original), **Cor dos
   Dentes** (slider contínuo, branco → quente), **repor**, e **Contornos dos dentes** (liga/desliga as linhas).
7. Apresentação: antes/depois com cursor, lado a lado e vídeo.

## Observações para o ShadeLab

- O que o Gustavo chama de "nítido e bonito" no SmileFy e aqui é: (a) contornos finos e editáveis sobre a foto,
  (b) render final fotorrealista feito POR IA a partir dos contornos. Nenhum dos dois usa modelo 3D cru na tela.
- Nosso modo **Contorno** já é o passo 3–4 (faltam: forma por dente com miniaturas, "Par", rotação com dois
  dedos, guia do arco com alças nas comissuras, tecla/botão de contornos on/off).
- O passo 5 equivale ao nosso "Sorriso por IA" (Gemini), parado por falta de faturamento. Com faturamento ativo,
  o caminho mais curto para o realismo é: contorno editado → máscara + foto → IA preenche os dentes dentro
  da máscara (inpainting), cor da escala no prompt. Enquanto isso, a biblioteca 2D de fotos reais cobre o
  passo 5 sem IA.
- Bons detalhes de UX para copiar: zoom automático na boca ao selecionar um dente; `‹ 11 ›` para pular entre
  dentes; "Par" para espelhar automaticamente; cursor de visibilidade em vez de botão antes/depois; versão
  melhorada da foto opcional antes de desenhar.
