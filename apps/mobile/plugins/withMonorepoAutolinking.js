const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches the generated Podfile to pass the workspace root's node_modules to
 * use_expo_modules! so CocoaPods can find ExpoModulesCore and other pods that
 * Yarn hoists to the monorepo root instead of apps/mobile/node_modules.
 */
module.exports = function withMonorepoAutolinking(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // The workspace root node_modules is three levels up from apps/mobile/ios/
      const patch = `use_expo_modules!(searchPaths: [File.expand_path('../../../node_modules', __dir__)])`;

      if (podfile.includes('use_expo_modules!') && !podfile.includes('searchPaths')) {
        podfile = podfile.replace('use_expo_modules!', patch);
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
