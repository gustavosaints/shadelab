// Metro: além dos assets padrão do Expo, os arcos 3D (.bin) usados pelo visualizador do Smile Design.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, 'bin'];

module.exports = config;
