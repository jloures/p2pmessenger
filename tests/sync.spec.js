import { test, expect } from '@playwright/test';

test.describe('P2P Messenger Multi-Tab Synchronization', () => {

    async function setupSyncPage(context, name) {
        const page = await context.newPage();
        await page.goto('/');
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', name);
            await page.click('#identity-form button');
        }
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
        return page;
    }

    test('Sync 1: Changing username in one tab should update another tab', async ({ browser }) => {
        const context = await browser.newContext();
        const page1 = await setupSyncPage(context, 'Hero1');
        const page2 = await setupSyncPage(context, 'Hero2');

        // Change name in Tab 1
        await page1.click('#edit-profile-btn');
        await page1.fill('#identity-input', 'SynchronizedHero');
        await page1.click('#identity-form button');

        // Wait for storage event / sync
        await expect(page2.locator('#display-username')).toHaveText('SYNCHRONIZEDHERO', { timeout: 10000 });

        await context.close();
    });

    test('Sync 2: Adding a room in one tab should show up in another tab', async ({ browser }) => {
        const context = await browser.newContext();
        const page1 = await setupSyncPage(context, 'Hero1');
        const page2 = await setupSyncPage(context, 'Hero2');

        // Join room in Tab 1
        await page1.click('#show-join-modal');
        await page1.fill('#room-id', 'cross-tab-room');
        await page1.click('#join-form button[type="submit"]');

        // Check Tab 2
        await expect(page2.locator('#room-list')).toContainText('cross-tab-room', { timeout: 10000 });

        await context.close();
    });

    test('Sync 3: Deleting a room in one tab should remove it and switch room in another tab', async ({ browser }) => {
        const context = await browser.newContext();
        const page1 = await setupSyncPage(context, 'Hero1');
        const page2 = await setupSyncPage(context, 'Hero2');

        // Add room in Tab 1
        await page1.click('#show-join-modal');
        await page1.fill('#room-id', 'delete-me');
        await page1.click('#join-form button[type="submit"]');

        // Switch Tab 2 to that room
        await page2.click('[data-room-id="delete-me"]');
        await expect(page2.locator('#display-room-id')).toHaveText('DELETE-ME');

        // Delete in Tab 1
        await page1.click('#leave-btn');

        // Tab 2 should have been kicked back to personal room
        await expect(page2.locator('#display-room-id')).not.toHaveText('DELETE-ME', { timeout: 10000 });
        await expect(page2.locator('#room-list')).not.toContainText('delete-me', { timeout: 10000 });

        await context.close();
    });

    test('Sync 4: Messages history should stay in sync across tabs', async ({ browser }) => {
        const context = await browser.newContext();
        const page1 = await setupSyncPage(context, 'Hero1');
        const page2 = await setupSyncPage(context, 'Hero2');

        const msg = 'Testing cross-tab message sync ' + Date.now();
        await page1.fill('#message-input', msg);
        await page1.keyboard.press('Enter');

        // Check Tab 2 (same room - personal channel)
        await expect(page2.locator('#messages-container')).toContainText(msg, { timeout: 10000 });

        await context.close();
    });
});
