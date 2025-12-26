import { test, expect } from '@playwright/test';

test.describe('P2P Messenger UI Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display sidebar and saved messages on start', async ({ page }) => {
        await expect(page.locator('#sidebar')).toBeVisible();
        await expect(page.locator('#display-room-id')).toContainText('SAVED-MESSAGES');
    });

    test('should generate a random room ID when dice is clicked in modal', async ({ page }) => {
        await page.click('#show-join-modal');
        const roomIdInput = page.locator('#room-id');
        const diceBtn = page.locator('#gen-room-btn');

        const initialValue = await roomIdInput.inputValue();
        await diceBtn.click();

        const newValue = await roomIdInput.inputValue();
        expect(newValue).not.toBe(initialValue);
        expect(newValue).toMatch(/^room-/);
    });

    test('should show join modal and join a room', async ({ page }) => {
        await page.fill('#username', 'TestUser');
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'test-room');
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#display-room-id')).toHaveText('TEST-ROOM');
        // Check if it appears in sidebar
        await expect(page.locator('#room-list')).toContainText('test-room');
    });

    test('should copy room link to clipboard', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await page.fill('#username', 'TestUser');
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'share-room');
        await page.click('#join-form button[type="submit"]');

        await page.click('#copy-room-btn');

        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('#room=share-room');
    });

    test('should allow switching between rooms', async ({ page }) => {
        await page.fill('#username', 'Hero');

        // Join room A
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-a');
        await page.click('#join-form button[type="submit"]');

        // Go back to Saved Messages
        await page.click('text=Saved-Messages');
        await expect(page.locator('#display-room-id')).toContainText('SAVED-MESSAGES');

        // Go back to Room A
        await page.click('text=room-a');
        await expect(page.locator('#display-room-id')).toHaveText('ROOM-A');
    });

    test('should prevent sending empty messages', async ({ page }) => {
        const messageInput = page.locator('#message-input');
        await messageInput.fill('   ');
        await page.keyboard.press('Enter');

        // Check bubbles - should only be system message or empty
        const messages = page.locator('.chat-bubble-right, .chat-bubble-left');
        await expect(messages).toHaveCount(0);
    });
});
