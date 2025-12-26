import { test, expect } from '@playwright/test';

test.describe('P2P Messenger UI Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the join view on start', async ({ page }) => {
        await expect(page.locator('#join-view')).toBeVisible();
        await expect(page.locator('h1')).toHaveText('p2pmessenger');
    });

    test('should generate a random room ID when dice is clicked', async ({ page }) => {
        const roomIdInput = page.locator('#room-id');
        const diceBtn = page.locator('#gen-room-btn');

        const initialValue = await roomIdInput.inputValue();
        await diceBtn.click();

        const newValue = await roomIdInput.inputValue();
        expect(newValue).not.toBe(initialValue);
        expect(newValue).toMatch(/^room-/);
    });

    test('should transition to chat view after joining', async ({ page }) => {
        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'test-room');
        await page.click('button[type="submit"]');

        await expect(page.locator('#chat-view')).toBeVisible();
        await expect(page.locator('#join-view')).toBeHidden();
        await expect(page.locator('#display-room-id')).toHaveText('#test-room');
    });

    test('should copy room link to clipboard', async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'share-room');
        await page.click('button[type="submit"]');

        await page.click('#copy-room-btn');

        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('#room=share-room');
    });

    test('should show disconnect button and reload on click', async ({ page }) => {
        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'test-room');
        await page.click('button[type="submit"]');

        await expect(page.locator('#leave-btn')).toBeVisible();

        // Clicking leave should reset to join view (via reload)
        await page.click('#leave-btn');
        await expect(page.locator('#join-view')).toBeVisible();
    });
});
