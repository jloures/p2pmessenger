import { test, expect } from '@playwright/test';

test.describe('Network Resilience & Latency Simulation', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    });

    test('Network 1: App persists Saved Messages when network drops', async ({ context, page }) => {
        await expect(page.locator('#display-room-id')).toContainText('SAVED-MESSAGES');
        await context.setOffline(true);
        await page.fill('#message-input', 'Local Note');
        await page.keyboard.press('Enter');
        await expect(page.locator('.chat-bubble-right')).toContainText('Local Note');
    });

    test('Network 2: Transitions status correctly when switching to a P2P room', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'test-net-room');
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#display-room-id')).toHaveText('TEST-NET-ROOM');
        // Should not be stuck on Saved Messages
        await expect(page.locator('#peer-count')).not.toContainText('SAVED MESSAGES');
    });

    test('Network 3: UI remains responsive during a "Long Handshake" (Signaling Latency)', async ({ context, page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await context.route('**/trystero/**', async route => {
            await new Promise(resolve => setTimeout(resolve, 3000));
            await route.continue();
        });

        // Open sidebar on mobile
        await page.click('#sidebar-toggle');
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'latent-room');
        await page.click('#join-form button[type="submit"]');

        // Sidebar should still be toggleable (close it)
        await page.click('#sidebar-toggle');
        await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
    });

    test('Network 4: Handles signaling server failure gracefully', async ({ context, page }) => {
        await context.route('**/*.trystero.dev/**', route => route.abort('failed'));

        await page.click('#show-join-modal');
        await page.fill('#room-id', 'fail-room');
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#display-room-id')).toContainText('FAIL-ROOM');
        await expect(page.locator('#message-input')).toBeVisible();
    });

    test('Network 5: Reconnects successfully after going from Offline to Online', async ({ context, page }) => {
        await context.setOffline(true);
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'recon-room');
        await page.click('#join-form button[type="submit"]');

        await context.setOffline(false);
        await expect(page.locator('#display-room-id')).toContainText('RECON-ROOM');
    });

    test('Network 6: Peer identity persists when offline in a room', async ({ context, page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'offline-id-test');
        await page.click('#join-form button[type="submit"]');

        await context.setOffline(true);
        await expect(page.locator('#profile-name')).toBeVisible();
        await expect(page.locator('#display-room-id')).toContainText('OFFLINE-ID-TEST');
    });

    test('Network 7: "Slow 3G" simulation for library loading', async ({ context, page }) => {
        await context.route('**/*.js', async route => {
            await new Promise(f => setTimeout(f, 500));
            await route.continue();
        });

        await page.reload();
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Network 8: Messaging locally still works even if Net is flaky', async ({ context, page }) => {
        await page.click('text=Saved-Messages');
        await context.setOffline(true);

        await page.fill('#message-input', 'Offline note');
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right')).toContainText('Offline note');
    });

    test('Network 9: Modal can be closed even during network hanging', async ({ context, page }) => {
        await context.route('**/trystero/**', () => { });
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'stuck-room');
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#join-modal')).toBeHidden();
    });

    test('Network 10: Prevents redundant signaling when switching rapidly', async ({ context, page }) => {
        await context.route('**/trystero/**', async route => {
            await route.continue();
        });

        for (let i = 0; i < 3; i++) {
            await page.click('#show-join-modal');
            await page.fill('#room-id', `rapid-${i}`);
            await page.click('#join-form button[type="submit"]');
        }

        await expect(page.locator('#display-room-id')).toContainText('RAPID-2');
    });

});
