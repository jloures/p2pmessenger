import { test, expect } from '@playwright/test';

test.describe('ToonChat Extra E2E Scenarios', () => {

    test('E2E: Dice button generates distinct IDs in sequence', async ({ page }) => {
        await page.goto('/');
        const values = new Set();
        for (let i = 0; i < 5; i++) {
            await page.click('#gen-room-btn');
            const val = await page.inputValue('#room-id');
            values.add(val);
        }
        expect(values.size).toBe(5);
    });

    test('E2E: Copy button provides visual feedback', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-write']);
        await page.goto('/');
        await page.fill('#username', 'FeedbackHero');
        await page.fill('#room-id', 'feedback-room');
        await page.click('button[type="submit"]');

        const copyBtn = page.locator('#copy-room-btn');
        const originalText = await copyBtn.textContent();
        await copyBtn.click();

        // Should show link icon
        await expect(copyBtn).toHaveText('🔗');

        // Should revert after timeout
        await expect(copyBtn).toHaveText(originalText, { timeout: 5000 });
    });

    test('E2E: Messages handle multiline and long text', async ({ page }) => {
        await page.goto('/');
        await page.fill('#username', 'LongHero');
        await page.fill('#room-id', 'stress-room');
        await page.click('button[type="submit"]');

        const longText = 'A'.repeat(500);
        await page.fill('#message-input', longText);
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right')).toContainText(longText);
    });

    test('E2E: Special characters and emojis are rendered correctly', async ({ page }) => {
        await page.goto('/');
        await page.fill('#username', 'EmojiHero');
        await page.fill('#room-id', 'emoji-room');
        await page.click('button[type="submit"]');

        const specialText = '🖍️ Pop! 💥 "Quouted" & <Escaped>';
        await page.fill('#message-input', specialText);
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right')).toContainText(specialText);
    });

    test('E2E: Rapid messaging should not break the UI', async ({ page }) => {
        await page.goto('/');
        await page.fill('#username', 'SpeedHero');
        await page.fill('#room-id', 'speed-room');
        await page.click('button[type="submit"]');

        const input = page.locator('#message-input');
        for (let i = 1; i <= 10; i++) {
            await input.fill(`Message ${i}`);
            await page.keyboard.press('Enter');
        }

        const bubbles = page.locator('.chat-bubble-right');
        await expect(bubbles).toHaveCount(10);
    });

    test('E2E: Auto-scroll to bottom on new message', async ({ page }) => {
        await page.goto('/');
        await page.fill('#username', 'ScrollHero');
        await page.fill('#room-id', 'scroll-room');
        await page.click('button[type="submit"]');

        // Flood with messages
        for (let i = 0; i < 20; i++) {
            await page.fill('#message-input', `Fill ${i}`);
            await page.keyboard.press('Enter');
        }

        const container = page.locator('#messages-container');
        const isAtBottom = await container.evaluate((el) => {
            return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 50;
        });
        expect(isAtBottom).toBe(true);
    });

    test('E2E: Multi-room isolation (Tabs)', async ({ browser }) => {
        const page1 = await browser.newPage();
        const page2 = await browser.newPage();

        await page1.goto('/');
        await page1.fill('#username', 'Alice');
        await page1.fill('#room-id', 'room-alpha');
        await page1.click('button[type="submit"]');

        await page2.goto('/');
        await page2.fill('#username', 'Bob');
        await page2.fill('#room-id', 'room-beta');
        await page2.click('button[type="submit"]');

        await page1.fill('#message-input', 'Secret Alpha Message');
        await page1.keyboard.press('Enter');

        // Bob should NOT see Alice's message
        await page2.waitForTimeout(2000);
        const bobMessages = await page2.locator('.chat-bubble-left').count();
        expect(bobMessages).toBe(0);
    });

    test('E2E: Entering room via Hash maintains state on reload', async ({ page }) => {
        await page.goto('/#room=persistent-room&name=PersistentHero');
        await page.click('button[type="submit"]');

        // Check text content without being case sensitive or literal about case if it's tricky
        await expect(page.locator('#display-room-id')).toContainText('PERSISTENT-ROOM');

        await page.reload();
        await expect(page.locator('#room-id')).toHaveValue('persistent-room');
        await expect(page.locator('#username')).toHaveValue('PersistentHero');
    });

    test('E2E: Invalid Join prevention (Manual Validation Trigger)', async ({ page }) => {
        await page.goto('/');

        // Try bypass with invalid handle (if we had manual validation)
        await page.fill('#username', 'A'); // Too short according to utils.validateHandle
        await page.fill('#room-id', 'valid-room');
        await page.click('button[type="submit"]');

        // We expect the LAST system message to contain the error
        await expect(page.locator('.system-message').last()).toContainText('INVALID NAME OR ROOM ID');
    });

    test('E2E: Peer Count is visible and reactive', async ({ browser }) => {
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        const room = 'count-room';

        await pageA.goto('/');
        await pageA.fill('#username', 'UserA');
        await pageA.fill('#room-id', room);
        await pageA.click('button[type="submit"]');

        await expect(pageA.locator('#peer-count')).toHaveText('1 Peer');

        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        await pageB.fill('#username', 'UserB');
        await pageB.fill('#room-id', room);
        await pageB.click('button[type="submit"]');

        await expect(pageA.locator('#peer-count')).toHaveText('2 Peers', { timeout: 30000 });
    });

});
