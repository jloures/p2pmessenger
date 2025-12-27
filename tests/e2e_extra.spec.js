import { test, expect } from '@playwright/test';

test.describe('p2pmessenger Extra E2E Scenarios', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'ExtraHero');
            await page.click('#identity-form button');
        }
    });

    test('E2E: Dice button generates distinct IDs in sequence', async ({ page }) => {
        await page.click('#show-join-modal');
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
        await page.fill('#username', 'FeedbackHero');
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'feedback-room');
        await page.click('#join-form button[type="submit"]');

        const copyBtn = page.locator('#copy-room-btn');
        const originalText = await copyBtn.textContent();
        await copyBtn.click();

        // Should show feedback text (I changed it to 'COPIED! ✅' in main.js)
        await expect(copyBtn).toHaveText('COPIED! ✅');

        // Should revert after timeout
        await expect(copyBtn).toHaveText(originalText, { timeout: 10000 });
    });

    test('E2E: Messages handle multiline and long text', async ({ page }) => {
        await page.fill('#username', 'LongHero');

        const longText = 'A'.repeat(500);
        await page.fill('#message-input', longText);
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right')).toContainText(longText);
    });

    test('E2E: Special characters and emojis are rendered correctly', async ({ page }) => {
        await page.fill('#username', 'EmojiHero');

        const specialText = '🖍️ Pop! 💥 "Quouted" & <Escaped>';
        await page.fill('#message-input', specialText);
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right')).toContainText(specialText);
    });

    test('E2E: Rapid messaging should not break the UI', async ({ page }) => {
        await page.fill('#username', 'SpeedHero');

        const input = page.locator('#message-input');
        for (let i = 1; i <= 10; i++) {
            await input.fill(`Message ${i}`);
            await page.keyboard.press('Enter');
        }

        const bubbles = page.locator('.chat-bubble-right');
        await expect(bubbles).toHaveCount(10);
    });

    test('E2E: Auto-scroll to bottom on new message', async ({ page }) => {
        await page.fill('#username', 'ScrollHero');

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
        const alicePage = await browser.newPage();
        const bobPage = await browser.newPage();

        await alicePage.goto('/');
        const aModal = alicePage.locator('#identity-modal');
        if (await aModal.isVisible()) {
            await alicePage.fill('#identity-input', 'AliceHero');
            await alicePage.click('#identity-form button');
        }
        await alicePage.fill('#username', 'AliceHero');
        await alicePage.click('#show-join-modal');
        await alicePage.fill('#room-id', 'room-alpha');
        await alicePage.click('#join-form button[type="submit"]');

        await bobPage.goto('/');
        const bModal = bobPage.locator('#identity-modal');
        if (await bModal.isVisible()) {
            await bobPage.fill('#identity-input', 'BobHero');
            await bobPage.click('#identity-form button');
        }
        await bobPage.fill('#username', 'BobHero');
        await bobPage.click('#show-join-modal');
        await bobPage.fill('#room-id', 'room-beta');
        await bobPage.click('#join-form button[type="submit"]');

        await alicePage.fill('#message-input', 'Secret Alpha Message');
        await alicePage.keyboard.press('Enter');

        // Bob should NOT see Alice's message in his room
        await bobPage.waitForTimeout(2000);
        const bobMessages = await bobPage.locator('.chat-bubble-left').count();
        expect(bobMessages).toBe(0);

        await alicePage.close();
        await bobPage.close();
    });

    test('E2E: Entering room via Hash auto-joins and maintains state', async ({ page }) => {
        await page.goto('/#room=persistent-room&name=PersistentHero');

        await expect(page.locator('#display-room-id')).toContainText('PERSISTENT-ROOM');
        await expect(page.locator('#username')).toHaveValue('PersistentHero');

        await page.reload();
        // Since it's in localStorage now, it should persist switching back to it
        await expect(page.locator('#display-room-id')).toContainText('PERSISTENT-ROOM');
    });

    test('E2E: Peer Count is visible and reactive', async ({ browser }) => {
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        const room = 'count-room';

        await pageA.goto('/');
        const aModal = pageA.locator('#identity-modal');
        if (await aModal.isVisible()) {
            await pageA.fill('#identity-input', 'UserAHero');
            await pageA.click('#identity-form button');
        }
        await pageA.fill('#username', 'UserAHero');
        await pageA.click('#show-join-modal');
        await pageA.fill('#room-id', room);
        await pageA.click('#join-form button[type="submit"]');

        await expect(pageA.locator('#peer-count')).toContainText('1 HERO ONLINE', { timeout: 30000 });

        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        const bModal = pageB.locator('#identity-modal');
        if (await bModal.isVisible()) {
            await pageB.fill('#identity-input', 'UserBHero');
            await pageB.click('#identity-form button');
        }
        await pageB.fill('#username', 'UserBHero');
        await pageB.click('#show-join-modal');
        await pageB.fill('#room-id', room);
        await pageB.click('#join-form button[type="submit"]');

        await expect(pageA.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 30000 });

        await contextA.close();
        await contextB.close();
    });
});
