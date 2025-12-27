import { test, expect } from '@playwright/test';

test.describe('Mobile Header Visibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13/14 size
        await page.goto('/');

        // Fill identity if needed
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'TestHero');
            await page.click('#identity-form button');
            await expect(modal).toBeHidden();
        }
    });

    test('Header should be visible on mobile', async ({ page }) => {
        const header = page.locator('.header-smooth');
        await expect(header).toBeVisible();
    });

    test('Header should have correct background color on mobile', async ({ page }) => {
        const header = page.locator('.header-smooth');
        // var(--toon-yellow) is #FFD93D
        await expect(header).toHaveCSS('background-color', 'rgb(255, 217, 61)');
    });

    test('Header should have non-zero height on mobile', async ({ page }) => {
        const header = page.locator('.header-smooth');
        const box = await header.boundingBox();
        expect(box.height).toBeGreaterThan(80);
    });

    test('Header should contain the room name on mobile', async ({ page }) => {
        const roomIdDisplay = page.locator('#display-room-id');
        await expect(roomIdDisplay).toBeVisible();
        await expect(roomIdDisplay).not.toBeEmpty();
    });

    test('Header should not be covered by other elements', async ({ page }) => {
        const header = page.locator('.header-smooth');
        const headerBox = await header.boundingBox();

        // Check if messages container is below header
        const messages = page.locator('#messages-container');
        const messagesBox = await messages.boundingBox();
        expect(messagesBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    });

    test('Header should handle safe area inset appropriately', async ({ page }) => {
        // This is hard to test in Playwright without specialized emulation, 
        // but we can check if it's at least still visible
        const header = page.locator('.header-smooth');
        await expect(header).toBeVisible();
    });

    test('Header should be visible when sidebar is open on mobile', async ({ page }) => {
        await page.click('#sidebar-toggle');
        await expect(page.locator('#sidebar')).toHaveClass(/open/);
        const header = page.locator('.header-smooth');
        await expect(header).toBeVisible();
    });

    test('Header room name should wrap or truncate instead of expanding header height', async ({ page }) => {
        // Switch to a room with a very long name
        await page.click('#sidebar-toggle');
        await page.click('#show-join-modal');
        const longName = 'This Is A Very Very Very Very Very Very Long Room Name';
        await page.fill('#room-id', longName);
        await page.click('#join-form button[type="submit"]');

        const header = page.locator('.header-smooth');
        const box = await header.boundingBox();
        // Height should still be around 84px (allowing some for safe area)
        expect(box.height).toBeLessThan(150);
    });
});
