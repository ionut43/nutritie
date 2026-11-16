/**
 * Serverul Monitorului Prețurilor nu trimite certificatul intermediar (Sectigo DV R36).
 * Browserele îl descarcă singure, Android nu. Îl adăugăm doar pentru domeniul acela,
 * restul conexiunilor rămân cu verificarea obișnuită a sistemului.
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config>
    <domain includeSubdomains="true">monitorulpreturilor.info</domain>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/sectigo_dv_r36" />
    </trust-anchors>
  </domain-config>
</network-security-config>
`;

module.exports = function withPriceCert(config) {
  config = withDangerousMod(config, ['android', async (c) => {
    const res = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res');
    fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
    fs.mkdirSync(path.join(res, 'raw'), { recursive: true });
    fs.writeFileSync(path.join(res, 'xml/network_security_config.xml'), XML);
    fs.copyFileSync(path.join(c.modRequest.projectRoot, 'scripts/prices/sectigo_intermediate.pem'), path.join(res, 'raw/sectigo_dv_r36.pem'));
    return c;
  }]);
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return c;
  });
};
