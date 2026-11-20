const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Evita erro EMFILE (too many open files) no Windows
config.maxWorkers = 2;

module.exports = config;