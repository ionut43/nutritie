// Semnează APK-ul de release cu o cheie fixă (din variabile de mediu), ca actualizările să se instaleze peste versiunea veche
// fără să se piardă datele. Fără variabile, Expo folosește cheia de debug.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes('NUTRITIE_KEYSTORE')) return cfg;
    g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            if (System.getenv('NUTRITIE_KEYSTORE')) {
                storeFile file(System.getenv('NUTRITIE_KEYSTORE'))
                storePassword System.getenv('NUTRITIE_KEYSTORE_PASSWORD')
                keyAlias 'nutritie'
                keyPassword System.getenv('NUTRITIE_KEYSTORE_PASSWORD')
            }
        }`);
    g = g.replace(/(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/, (m, a) => `${a}signingConfig System.getenv('NUTRITIE_KEYSTORE') ? signingConfigs.release : signingConfigs.debug`);
    cfg.modResults.contents = g;
    return cfg;
  });
};
