import config from './playwright.config.js';

export default {
  ...config,
  testDir: './tests/production',
  use: { ...config.use, baseURL: 'http://127.0.0.1:4174/bamboo-flute-customizer/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort --base /bamboo-flute-customizer/',
    url: 'http://127.0.0.1:4174/bamboo-flute-customizer/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
};
