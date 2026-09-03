const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  outputDir: 'test-results',

  webServer: [
    {
      command: 'npm start',
      cwd: './backend',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: './frontend',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ],

  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    screenshot: 'on',
    video: 'on',
    trace: 'on'
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
