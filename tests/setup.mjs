// Nos testes, imagens importadas com require() (assets do app) viram só um número, como no Metro.
import Module from 'node:module';

for (const ext of ['.jpg', '.jpeg', '.png']) {
  Module._extensions[ext] = (m) => {
    m.exports = 1;
  };
}
