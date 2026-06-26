const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all packages in the monorepo
config.watchFolders = [workspaceRoot];

// Resolve modules from workspace root first, then project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Follow symlinks so Yarn workspace packages (node_modules/@quakelink/*) resolve
config.resolver.unstable_enableSymlinks = true;

// Tamagui: enable CSS interop
config.resolver.sourceExts.push('mjs');

module.exports = config;
