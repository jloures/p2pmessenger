import { test, expect } from '@playwright/test';

test.describe('Data Migration & Schema Evolution Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Clear storage before each test to start fresh
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    });

    // 1. Migration from "v1" (no version tag, missing fields)
    test('Migration 1: Migrate v1 structure to v2 (Add missing lastRead)', async ({ page }) => {
        // Mock v1 data
        const v1Rooms = [
            { id: 'room-1', name: 'Legacy Room', icon: '🦖' } // Missing lastRead, isPrivate
        ];

        await page.evaluate((data) => {
            localStorage.removeItem('p2p_version'); // Critical: ensure migration is triggered
            localStorage.setItem('p2p_rooms', JSON.stringify(data));
        }, v1Rooms);

        await page.reload();

        // Check if v2 migration happened
        const version = await page.evaluate(() => localStorage.getItem('p2p_version'));
        expect(version).toBe('2');

        const migratedRooms = await page.evaluate(() => JSON.parse(localStorage.getItem('p2p_rooms')));
        const room = migratedRooms.find(r => r.id === 'room-1');
        expect(room).toHaveProperty('lastRead');
        expect(room.name).toBe('Legacy Room'); // Data preserved
    });

    // 2. Data Integrity across versions
    test('Migration 2: Ensure data is not lost during migration', async ({ page }) => {
        const complexHistory = {
            'room-x': [{ text: 'Old message', sender: 'Alice', timestamp: 123 }]
        };

        await page.evaluate((msgs) => {
            localStorage.setItem('p2p_messages', JSON.stringify(msgs));
        }, complexHistory);

        await page.reload();

        // Verify message is still there
        const rooms = await page.evaluate(() => JSON.parse(localStorage.getItem('p2p_messages')));
        expect(rooms['room-x'][0].text).toBe('Old message');
    });

    // 3. LocalStorage Quota Exceeded Handling
    test('Migration 3: Gracefully handles LocalStorage QuotaExceededError', async ({ page }) => {
        // Mocked system message check
        await page.evaluate(() => {
            // Force saveMessages to fail
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = (key) => {
                if (key === 'p2p_messages') {
                    const error = new Error('Quota exceeded');
                    error.name = 'QuotaExceededError';
                    throw error;
                }
                originalSetItem.apply(localStorage, arguments);
            };
        });

        // Try to send a message
        await page.fill('#message-input', 'This will fail to save');
        await page.keyboard.press('Enter');

        // Check for system message notification
        await expect(page.locator('#messages-container')).toContainText('MEMORY FULL');
    });

    // 4. UI: Mobile Sidebar Auto-Close on main area tap
    test('UI 1: Mobile sidebar closes when tapping main message area', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Open sidebar
        await page.waitForSelector('#sidebar-toggle', { state: 'visible' });
        await page.click('#sidebar-toggle', { force: true });
        await expect(page.locator('#sidebar')).toHaveClass(/open/, { timeout: 10000 });

        // Tap on main content area on the right side (sidebar is 320px wide)
        // Click at x: 350 to ensure we hit the backdrop/main area
        await page.mouse.click(350, 100);

        // Sidebar should be closed
        await expect(page.locator('#sidebar')).not.toHaveClass(/open/, { timeout: 10000 });
    });

    // 5. UI: Mobile Sticky Input Check
    test('UI 2: Message input stays visible and at bottom on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        const footer = page.locator('main footer');
        const box = await footer.boundingBox();

        // footer should be at the bottom of the screen (approx)
        expect(box.y + box.height).toBeGreaterThan(600);
        await expect(footer).toBeVisible();
    });

    // 6. Schema Consistency: Private property handling
    test('Migration 4: Correctly handles room privacy after migration', async ({ page }) => {
        const rooms = [
            { id: 'private-1', name: 'Private', isPrivate: true },
            { id: 'public-1', name: 'Public' } // Missing isPrivate defaults to false/undefined
        ];

        await page.evaluate((r) => localStorage.setItem('p2p_rooms', JSON.stringify(r)), rooms);
        await page.reload();

        // Click public room
        await page.click('text=Public');

        // Should trigger P2P (not SAVED MESSAGES)
        await expect(page.locator('#peer-count')).not.toContainText('SAVED MESSAGES');
    });

});
