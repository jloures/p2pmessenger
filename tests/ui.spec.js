import { test, expect } from '@playwright/test';

test.describe('P2P Messenger UI Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('UI 1: Should display sidebar and Saved-Messages on load', async ({ page }) => {
        await expect(page.locator('#sidebar')).toBeVisible();
        await expect(page.locator('#display-room-id')).toContainText('SAVED-MESSAGES');
        await expect(page.locator('.room-item.active')).toContainText('Saved-Messages');
    });

    test('UI 2: Should persist username in localStorage', async ({ page }) => {
        const username = 'PersistenceHero';
        await page.fill('#username', username);
        await page.reload();
        await expect(page.locator('#username')).toHaveValue(username);
    });

    test('UI 3: Should toggle sidebar visibility on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        const sidebar = page.locator('#sidebar');
        const toggle = page.locator('#sidebar-toggle');

        await expect(sidebar).toHaveClass(/transform/);
        await toggle.click();
        await expect(sidebar).toHaveClass(/open/);
        await toggle.click();
        await expect(sidebar).not.toHaveClass(/open/);
    });

    test('UI 4: Should open and close the join room modal', async ({ page }) => {
        const modal = page.locator('#join-modal');
        await page.click('#show-join-modal');
        await expect(modal).toBeVisible();
        await page.click('#close-modal');
        await expect(modal).toBeHidden();
    });

    test('UI 5: Should generate random room IDs via the dice button', async ({ page }) => {
        await page.click('#show-join-modal');
        const input = page.locator('#room-id');
        await page.click('#gen-room-btn');
        const val1 = await input.inputValue();
        expect(val1).toMatch(/^room-/);
        await page.click('#gen-room-btn');
        const val2 = await input.inputValue();
        expect(val2).not.toBe(val1);
    });

    test('UI 6: Should join a new room and update sidebar list', async ({ page }) => {
        const roomID = 'hero-base';
        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#display-room-id')).toHaveText(roomID.toUpperCase());
        await expect(page.locator('#room-list')).toContainText(roomID);
    });

    test('UI 7: Should allow renaming a room and updating the header', async ({ page }) => {
        const roomID = 'rename-test';
        const nickname = 'Bento Box';

        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        page.on('dialog', async dialog => {
            await dialog.accept(nickname);
        });

        await page.locator(`.room-item[data-room-id="${roomID}"]`).hover();
        await page.locator(`.rename-btn[data-id="${roomID}"]`).click({ force: true });

        await expect(page.locator('#display-room-id')).toHaveText(nickname.toUpperCase());
    });

    test('UI 8: Should show room technical ID in subtitle when renamed', async ({ page }) => {
        const roomID = 'subtitle-test';
        const nickname = 'HQ';

        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        page.on('dialog', async dialog => {
            await dialog.accept(nickname);
        });

        await page.locator(`.room-item[data-room-id="${roomID}"]`).hover();
        await page.locator(`.rename-btn[data-id="${roomID}"]`).click({ force: true });

        await expect(page.locator('#peer-count')).toContainText(`ID: ${roomID}`);
    });

    test('UI 9: Should navigate correctly between multiple rooms', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-1');
        await page.click('#join-form button[type="submit"]');

        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-2');
        await page.click('#join-form button[type="submit"]');

        await page.click('text=room-1');
        await expect(page.locator('#display-room-id')).toHaveText('ROOM-1');
        await page.click('text=Saved-Messages');
        await expect(page.locator('#display-room-id')).toContainText('SAVED-MESSAGES');
    });

    test('UI 10: Should remove a room from the list when EXIT is clicked', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'bye-bye');
        await page.click('#join-form button[type="submit"]');

        await page.click('#leave-btn');
        await expect(page.locator('#room-list')).not.toContainText('bye-bye');
        await expect(page.locator('#display-room-id')).toContainText('SAVED-MESSAGES');
    });

    test('UI 11: Should provide visual feedback when copying room link', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-write']);
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'copy-link');
        await page.click('#join-form button[type="submit"]');

        const copyBtn = page.locator('#copy-room-btn');
        await copyBtn.click();
        await expect(copyBtn).toHaveText('COPIED! ✅');
        await expect(copyBtn).toHaveText('LINK 🔗', { timeout: 5000 });
    });

    test('UI 12: Should prevent sending whitespace-only messages', async ({ page }) => {
        const input = page.locator('#message-input');
        await input.fill('     ');
        await page.keyboard.press('Enter');

        const messages = page.locator('.chat-bubble-left, .chat-bubble-right');
        await expect(messages).toHaveCount(0);
    });
});
