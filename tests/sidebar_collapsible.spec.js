import { test, expect } from '@playwright/test';

test.describe('Collapsible Sidebar - Desktop', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle identity modal
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'DesktopHero');
            await page.click('#identity-form button');
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    });

    test('Desktop 1: Initially expanded', async ({ page }) => {
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toBeVisible();
        await expect(sidebar).not.toHaveClass(/collapsed/);
    });

    test('Desktop 2: Toggle collapses sidebar', async ({ page }) => {
        const sidebar = page.locator('#sidebar');
        const toggle = page.locator('#sidebar-toggle');
        await toggle.click();
        await expect(sidebar).toHaveClass(/collapsed/);
    });

    test('Desktop 3: Toggle expands sidebar', async ({ page }) => {
        const sidebar = page.locator('#sidebar');
        const toggle = page.locator('#sidebar-toggle');
        await toggle.click(); // Collapse
        await toggle.click(); // Expand
        await expect(sidebar).not.toHaveClass(/collapsed/);
    });

    test('Desktop 4: Width is zero when collapsed', async ({ page }) => {
        const sidebar = page.locator('#sidebar');
        const toggle = page.locator('#sidebar-toggle');
        await toggle.click();
        const box = await sidebar.boundingBox();
        expect(box?.width).toBe(0);
    });

    test('Desktop 5: Toggle button moves with sidebar', async ({ page }) => {
        const toggle = page.locator('#sidebar-toggle');
        const initialBox = await toggle.boundingBox();
        await toggle.click(); // Collapse
        const collapsedBox = await toggle.boundingBox();
        expect(collapsedBox?.x).not.toBe(initialBox?.x);
    });

    test('Desktop 6: Toggle color changes when expanded', async ({ page }) => {
        const toggle = page.locator('#sidebar-toggle');
        // expanded state: red background as per css: .sidebar-smooth:not(.collapsed)~#sidebar-toggle { background-color: var(--toon-red); }
        // The helper getComputedStyle can verify this
        const color = await toggle.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(color).toBe('rgb(255, 107, 107)'); // #FF6B6B
    });

    test('Desktop 7: Main content adjusts margin', async ({ page }) => {
        const main = page.locator('main');
        const initialBox = await main.boundingBox();
        await page.click('#sidebar-toggle');
        const collapsedBox = await main.boundingBox();
        expect(collapsedBox?.width).toBeGreaterThan(initialBox?.width);
    });

    test('Desktop 8: Items and Brand are hidden when collapsed', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const brand = page.locator('#sidebar h1');
        await expect(brand).not.toBeInViewport();
    });

    test('Desktop 9: Click room while expanded works', async ({ page }) => {
        const roomItem = page.locator('.room-item').first();
        await roomItem.click();
        await expect(roomItem).toHaveClass(/active/);
    });

    test('Desktop 10: State persists across room switch', async ({ page }) => {
        const toggle = page.locator('#sidebar-toggle');
        const sidebar = page.locator('#sidebar');
        await toggle.click(); // Collapse
        await expect(sidebar).toHaveClass(/collapsed/);

        // Switch room via hash to avoid clicking hidden sidebar buttons
        await page.evaluate(() => window.location.hash = '#room=test-room-persistence');

        // Ensure room changed
        await expect(page.locator('#display-room-id')).toHaveText('TEST-ROOM-PERSISTENCE');

        // Sidebar should still be collapsed
        await expect(sidebar).toHaveClass(/collapsed/);
    });
});

test.describe('Collapsible Sidebar - Mobile', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle identity modal
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'MobileHero');
            await page.click('#identity-form button');
        }
        await page.setViewportSize({ width: 375, height: 667 });
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    });

    test('Mobile 1: Initially hidden off-screen', async ({ page }) => {
        const sidebar = page.locator('#sidebar');
        const box = await sidebar.boundingBox();
        expect(box?.x).toBeLessThan(0);
    });

    test('Mobile 2: Open sidebar shows it on-screen', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toHaveClass(/open/);
        const box = await sidebar.boundingBox();
        expect(box?.x).toBe(0);
    });

    test('Mobile 3: Close sidebar via toggle', async ({ page }) => {
        await page.click('#sidebar-toggle'); // Open
        await page.click('#sidebar-toggle'); // Close
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/open/);
    });

    test('Mobile 4: Backdrop appears when open', async ({ page }) => {
        const backdrop = page.locator('#sidebar-backdrop');
        await expect(backdrop).toBeHidden();
        await page.click('#sidebar-toggle');
        await expect(backdrop).toBeVisible();
    });

    test('Mobile 5: Clicking backdrop closes sidebar', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const backdrop = page.locator('#sidebar-backdrop');
        // Use force or click outside sidebar width
        await backdrop.click({ position: { x: 350, y: 300 } });
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/open/);
    });

    test('Mobile 6: Sidebar occupies full height', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const sidebar = page.locator('#sidebar');
        const box = await sidebar.boundingBox();
        const viewport = page.viewportSize();
        expect(box?.height).toBe(viewport?.height);
    });

    test('Mobile 7: Brand name visible when open', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const brand = page.locator('#sidebar h1');
        await expect(brand).toBeVisible();
        await expect(brand).toHaveText('P2PMSG');
    });

    test('Mobile 8: Sidebar closes after selecting a room', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const roomItem = page.locator('.room-item').first();
        await roomItem.click();
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/open/);
    });

    test('Mobile 9: Toggle button icon changes (X icon)', async ({ page }) => {
        // We can check classes or calculated styles of burger spans
        await page.click('#sidebar-toggle');
        const bg = await page.locator('#sidebar-toggle').evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(bg).toBe('rgb(255, 107, 107)'); // Red when open
    });

    test('Mobile 10: Clicking main content closes sidebar', async ({ page }) => {
        await page.click('#sidebar-toggle');
        const main = page.locator('main');
        // Force click as sidebar intercepts the top-left area
        await main.click({ position: { x: 350, y: 300 }, force: true });
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/open/);
    });
});
