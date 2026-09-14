const lite = require('./lite-builder-config');
module.exports = {
  ...lite,
  appId: 'com.claracore.desktop.trial',
  directories: { ...lite.directories, output: 'out/v0.7.0-local-trial' },
  extraMetadata: { ...lite.extraMetadata, name: 'claracore-desktop-trial', version: '0.7.0-preview.2' }
};
