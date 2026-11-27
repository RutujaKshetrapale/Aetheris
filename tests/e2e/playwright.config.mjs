export default {
  testDir: '.',
  timeout: 60000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 15000
  },
  reporter: [['list']]
};
