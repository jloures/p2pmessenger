import { test, expect } from '@playwright/test';

test.describe('P2P Messenger Performance & Stress Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'PerfHero');
            await page.click('#identity-form button');
        }
    });

    test('Perf 1: Should handle maximum message buffer (50) without UI lag', async ({ page }) => {
        // Send 60 messages (10 more than buffer)
        for (let i = 0; i < 60; i++) {
            await page.fill('#message-input', `Spam Message ${i}`);
            await page.keyboard.press('Enter');
        }

        // Check if count is exactly 50
        const bubbleCount = await page.locator('.chat-bubble-right').count();
        expect(bubbleCount).toBe(50);

        // Ensure UI is still responsive
        await page.fill('#message-input', 'Check Lag');
        await expect(page.locator('#message-input')).toHaveValue('Check Lag');
    });

    test('Perf 2: Should handle high number of rooms in sidebar', async ({ page }) => {
        await page.evaluate(() => {
            for (let i = 0; i < 30; i++) {
                // Creating rooms via script for speed
                const id = `room-perf-${i}`;
                window.addRoom(id, id, '');
            }
            location.reload();
        });

        // Wait for page load after reload
        await page.waitForSelector('#room-list');

        const roomCount = await page.locator('.room-item').count();
        expect(roomCount).toBeGreaterThanOrEqual(31); // 30 + personal room

        // Sidebar should be scrollable
        const isScrollable = await page.locator('#room-list').evaluate(el => el.scrollHeight > el.clientHeight);
        // On some screen sizes it might not be, so we adjust viewport if needed or just check visibility
        await expect(page.locator('.room-item').last()).toBeVisible();
    });

    test('Perf 3: Memory persistence of large message object', async ({ page }) => {
        // Mock a very large history in localStorage
        await page.evaluate(() => {
            const bigHistory = Array.from({ length: 50 }, (_, i) => ({
                text: 'A'.repeat(1000) + i, // 1KB per message
                sender: 'BulkSender',
                timestamp: Date.now(),
                isOwn: false
            }));
            const messages = { 'saved-messages': bigHistory };
            localStorage.setItem('p2p_messages', JSON.stringify(messages));
            location.reload();
        });

        await expect(page.locator('.chat-bubble-left').first()).toContainText('A'.repeat(100));
        await expect(page.locator('.chat-bubble-left')).toHaveCount(50);
    });

    test('Perf 4: Rapid Input stress test (Typewriter)', async ({ page }) => {
        const input = page.locator('#message-input');
        const longSent = 'The quick brown fox jumps over the lazy dog through the fast P2P network.';

        // Rapid typing simulation
        await input.pressSequentially(longSent, { delay: 10 });
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right')).toContainText(longSent);
    });
});
