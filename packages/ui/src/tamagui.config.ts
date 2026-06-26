import { createTamagui } from 'tamagui';
import { config as defaultConfig } from '@tamagui/config/v3';

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...defaultConfig.themes.dark,
      background: '#0f0f0f',
      backgroundPress: '#1a1a1a',
      borderColor: '#2a2a2a',
      color: '#f0f0f0',
      colorSubtle: '#888',
    },
    light: {
      ...defaultConfig.themes.light,
    },
  },
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
