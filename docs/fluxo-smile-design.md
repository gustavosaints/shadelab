# Fluxo atual do Smile Design (2026-10-15) — base para o fluxograma

Foto fixa no alto; barra de passos; comandos rolam embaixo. Pinça na foto = zoom da imagem (sempre).

```
[Início] → Fotografar com guia (janela 3:4, guia de rosto, selfie espelhada)  ou  Galeria
   │
   ▼
[1 Foto]   Espelhar · Fotografar de novo · Galeria
   │ (automático ao entrar: detector acha rosto e boca)
   ▼
[2 Boca]   8 pontos arrastáveis no lábio interno · Detectar de novo · Marcar à mão · Remover
   │ "Boca pronta" → encaixa dentes (espaços na foto; se falhar, largura da boca)
   ▼
[3 Forma e cor]   Cor (escala) · Anatomia (Contorno padrão, 12 bibliotecas) · Forma quadrada/oval/triangular + barra
                  · Proporção natural/áurea/RED · Cenários (natural, facetas, clareamento, gengivectomia, diastema, alinhar)
                  · Reencaixar na boca
   │
   ▼
[4 Ajustar]   Conjunto (toque nos dentes seleciona o arco: arrastar move, pinça dimensiona, alças ↕ ↔)
              Unitário (toque seleciona um dente: arrastar, pinça, rotação, largura, comprimento, espelhar)
              Toque fora solta · Reencaixar · Zerar · Ajuste fino (sliders) · Análise facial (face-bow)
   │
   ▼
[5 Comparar]  Normal · Cortina · Lado a lado · Variações (A/B/C) · Segurar para ver o antes
              Compartilhar imagem · Salvar / Atualizar caso
   │
   ▼
[Caso]  Editar simulação (volta ao passo 4) · Compartilhar · Excluir
```

## Decisões em aberto (para o fluxograma)

1. A detecção automática da boca deve rodar sozinha ao entrar ou só quando tocar em "Detectar"?
2. Encaixe dos dentes: automático ao entrar em "Forma e cor" (como hoje) ou botão explícito?
3. "Ajustar": começar com o conjunto já selecionado ou sem seleção (hoje: sem seleção; Conjunto seleciona o arco)?
4. Onde fica a Análise facial: no passo 4 (hoje), num passo próprio, ou só no relatório?
5. Cenários de tratamento: no passo 3 (hoje) ou como primeiro passo depois da boca ("o que vamos simular?")?
6. O que o paciente vê: existe um "modo apresentação" só com a foto e a cortina, sem comandos?
7. Salvar: no final (hoje) ou salvar automático a cada passo, com "Salvar como" para variações?
8. Câmera: manter a prévia no navegador (selfie espelhada e recorte 3:4) ou voltar para a câmera nativa?
9. Sorriso por IA: fica fora do fluxo (tela separada, como hoje) ou entra como alternativa ao passo 3 quando houver chave?
10. Módulo de cor: o fluxo "Tirar cor" deve alimentar a cor-alvo do Smile Design do mesmo paciente?
