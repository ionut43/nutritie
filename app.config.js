// Numărul build-ului vine din GitHub Actions, ca fiecare versiune nouă să se instaleze peste cea veche.
module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER || 1);
  return {
    ...config,
    android: { ...config.android, versionCode: build },
    ios: { ...config.ios, buildNumber: String(build) },
  };
};
