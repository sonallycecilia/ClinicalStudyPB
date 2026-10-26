import { defineConfig } from 'cypress';

export default defineConfig({
  expose: {
    apiUrl: 'http://localhost:3000',
  },
  
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    pageLoadTimeout: 30000,
  },
});
