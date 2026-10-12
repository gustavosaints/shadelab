# ShadeLab

App de tomada de cor dental por câmera, com correção por referência e registro de casos para o laboratório.
Feito com Expo (React Native): roda em iOS, Android e navegador a partir do mesmo código.

## Rodar no celular (Expo Go)

```bash
npm install
npx expo start
```

Instale o app **Expo Go** no celular e leia o QR code do terminal. iOS e Android funcionam sem Xcode ou Android Studio.

Outros comandos:

```bash
npm run web        # abre no navegador
npm test           # testes do núcleo de cor (vitest)
npm run typecheck  # TypeScript
npm run lint       # ESLint (config Expo)
```

## O que está pronto

- **Tirar cor**: câmera com guias de enquadramento (dente + referência), ou foto da galeria.
- **Análise**: quadrados arrastáveis sobre a foto para dente, referência e gengiva (opcional).
  A cor é lida em RGB linear, descartando reflexos e sombras, corrigida pela referência
  (cartão cinza 18%, cartão branco ou um tab da escala) e convertida para CIELAB.
- **Comparação** com VITA Classical (16) e VITA 3D-Master (26) por ΔE00 (CIEDE2000),
  com classificação pelos limiares clínicos de Paravina et al. (2015): ≤ 0,8 imperceptível, ≤ 1,8 aceitável.
- **Calibração da escala física**: fotografe cada tab da sua escala; com todos medidos, a comparação
  usa a cor real da sua escala no seu aparelho em vez dos valores médios de catálogo.
- **Casos**: paciente, dente (FDI), observações, foto, cor do dente e da gengiva, salvos no aparelho.
- **PDF para o laboratório** com a prescrição de cor, gerado e compartilhado pelo próprio app.

## Precisão: leia antes de usar na clínica

Câmera de celular não é espectrofotômetro. O resultado depende de:

1. Luz natural indireta e **sem flash**.
2. Referência de cor **no mesmo plano e mesma luz** que o dente.
3. Dente limpo e úmido, quadrado de amostra no **terço médio**.
4. **Calibrar a escala** em Configurações, na mesma luz e com a mesma referência usadas nos pacientes.

Os valores padrão das escalas em `src/lib/color/shades.ts` são médias aproximadas da literatura.
Confirme sempre visualmente com a escala física antes da cimentação.

## Estrutura

```
src/app/                 telas (Expo Router)
  index.tsx              início
  shade/capture.tsx      câmera
  shade/analyze.tsx      marcadores, análise e salvar caso / calibração
  cases/                 lista e detalhe do caso (PDF, excluir)
  settings.tsx           escala, calibração, identificação
  smile/index.tsx        placeholder do Smile Design
src/lib/color/           conversões sRGB/Lab, CIEDE2000, escalas, correção por referência, matching
src/lib/image/           leitura de pixels (expo-image-manipulator + jpeg-js) e média robusta
src/lib/storage/         AsyncStorage: configurações, calibrações e casos
src/components/          botões, chips, cartões, marcador arrastável, linha de resultado
tests/                   testes unitários do núcleo
```

## Próximos módulos

- Smile Design (foto frontal, linhas de referência, biblioteca de formatos, antes/depois).
- Cor do substrato (stump shade) com escala de dies.
- Conta, sincronização entre aparelhos e painel web para o laboratório.
- Build de desenvolvimento com `react-native-vision-camera` para travar exposição e balanço de branco.

## Publicar nas lojas

```bash
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```

Requer conta Expo (EAS) e contas de desenvolvedor Apple e Google.
