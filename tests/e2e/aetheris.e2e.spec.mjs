import { test, expect } from '@playwright/test';

const TARGET = process.env.TARGET_FRONTEND || 'both';
const REACT_URL = process.env.REACT_URL || 'http://localhost:3100';
const ANGULAR_URL = process.env.ANGULAR_URL || 'http://localhost:4200';
const API_URL = process.env.API_URL || 'http://localhost:8080';

const FRONTENDS = [];
if (TARGET === 'react' || TARGET === 'both') FRONTENDS.push({ name: 'React', url: REACT_URL });
if (TARGET === 'angular' || TARGET === 'both') FRONTENDS.push({ name: 'Angular', url: ANGULAR_URL });

for (const fe of FRONTENDS) {
  test.describe(`${fe.name} Workbench E2E (${fe.url})`, () => {
    test('01-16: Full pathfinding, reversible playback, presets CRUD, bundle export/import, and benchmark flow', async ({ page, request }) => {
      // 1. Load application
      await page.goto(fe.url, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'AETHERIS' })).toBeVisible();

      // 2. Verify backend health
      const healthRes = await request.get(`${API_URL}/api/v1/health`);
      expect(healthRes.ok()).toBeTruthy();
      await expect(page.getByTestId('backend-health-badge')).toContainText('Backend:');
      await expect(page.getByTestId('backend-health-badge')).not.toContainText('Unavailable');

      // 3. Edit grid (toggle wall at r1c1)
      await page.getByTestId('tool-WALL').click();
      await page.getByTestId('cell-r1c1').click();
      await expect(page.getByTestId('cell-r1c1')).toHaveAttribute('data-cell-type', 'WALL');
      // Toggle it back off so canonical grid remains solvable
      await page.getByTestId('cell-r1c1').click();
      await expect(page.getByTestId('cell-r1c1')).toHaveAttribute('data-cell-type', 'EMPTY');

      // 4-7. Execute BFS, DFS, Dijkstra, A*
      for (const algo of ['BFS', 'DFS', 'DIJKSTRA', 'ASTAR']) {
        await page.getByTestId(`algo-${algo}`).click();
        await page.getByTestId('run-algorithm-btn').click();
        await expect(page.getByTestId('metric-status')).toContainText('PATH FOUND');
        await expect(page.getByTestId('execution-source-badge')).toContainText('Backend API');
      }

      // 8-12. Play, Pause, Step Backward/Forward, Seek, Verify Final Path
      await page.getByTestId('playback-reset-btn').click();
      await expect(page.getByTestId('playback-step-label')).toContainText('0/');

      await page.getByTestId('playback-play-btn').click();
      await page.waitForTimeout(150);
      await page.getByTestId('playback-play-btn').click(); // Pause

      await page.getByTestId('playback-forward-btn').click();
      const afterForwardText = await page.getByTestId('playback-step-label').innerText();
      const afterForwardStep = parseInt(afterForwardText.split('/')[0], 10);
      expect(afterForwardStep).toBeGreaterThan(0);

      await page.getByTestId('playback-back-btn').click();
      const afterBackText = await page.getByTestId('playback-step-label').innerText();
      const afterBackStep = parseInt(afterBackText.split('/')[0], 10);
      expect(afterBackStep).toBe(afterForwardStep - 1);

      // Seek to final step
      const totalSteps = parseInt(afterBackText.split('/')[1], 10);
      await page.getByTestId('playback-scrubber').fill(String(totalSteps - 1));
      await page.getByTestId('playback-scrubber').dispatchEvent('change');
      await expect(page.getByTestId('cell-r0c0')).toHaveAttribute('data-in-path', 'true');
      await expect(page.getByTestId('cell-r4c4')).toHaveAttribute('data-in-path', 'true');

      // 13-14. Create a preset & reload it
      const presetName = `E2E-${fe.name}-${Date.now()}`;
      await page.getByTestId('preset-name-input').fill(presetName);
      await page.getByTestId('create-preset-btn').click();
      await expect(page.getByTestId('persistence-success-banner')).toContainText(presetName);
      await page.getByTestId('load-preset-btn').click();
      await expect(page.getByTestId('persistence-success-banner')).toContainText('Loaded preset');

      // 15. Export & Import presets
      await page.getByTestId('export-bundle-btn').click();
      await expect(page.getByTestId('bundle-textarea')).toHaveValue(/aetheris-preset-bundle/);
      await page.getByTestId('import-bundle-btn').click();
      await expect(page.getByTestId('persistence-success-banner')).toContainText('Imported');

      // 16. Create & retrieve benchmark
      await page.getByTestId('run-benchmark-btn').click();
      await expect(page.getByTestId('benchmark-result-card')).toBeVisible();
      await page.getByTestId('retrieve-benchmark-btn').click();
      await expect(page.getByTestId('persistence-success-banner')).toContainText('Retrieved benchmark');
    });

    test('17-18: Database unavailable (503) & no silent fallback to local execution on backend outage', async ({ page }) => {
      await page.goto(fe.url, { waitUntil: 'networkidle' });

      // Simulate 503 persistence outage on preset listing
      await page.route('**/api/v1/presets', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Service Unavailable',
            status: 503,
            detail: 'Configured database persistence is unavailable.'
          })
        })
      );
      await page.getByTestId('refresh-health-btn').click();
      await expect(page.getByTestId('persistence-error-banner')).toContainText('503');

      // Simulate backend network failure on tracePath -> must NOT silently fall back to local engine
      await page.route('**/api/v1/pathfinding/trace', (route) => route.abort('failed'));
      await page.getByTestId('run-algorithm-btn').click();
      await expect(page.getByTestId('pathfinding-error-banner')).toBeVisible();
      await expect(page.getByTestId('execution-source-badge')).toHaveCount(0);
    });
  });
}
