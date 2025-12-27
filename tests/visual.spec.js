import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {

    test.skip(!!process.env.CI, 'Visual snapshots are platform-specific and differ between macOS and Linux (CI). Run locally to verify.');
    test.beforeEach(async ({ page }) => {
        // Set a fixed viewport before goto
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');
        // Handle identity modal if it appears
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'VisualHero');
            await page.click('#identity-form button');
        }
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
        // Wait for fonts/styles to load
        await page.waitForLoadState('networkidle');
    });

    // Masking utility for timestamps and dynamic IDs
    const maskLocators = [
        page => page.locator('.message-meta'),
        page => page.locator('#display-room-id'),
        page => page.locator('#app-version'),
        page => page.locator('#peer-count'),
        page => page.locator('.room-item div:last-child') // Technical IDs in sidebar
    ];

    test('Visual: Desktop Default View', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('desktop-default.png', {
            mask: [page.locator('.message-meta'), page.locator('#app-version'), page.locator('#peer-count')],
            maxDiffPixelRatio: 0.1
        });
    });

    test('Visual: Mobile Default View (Closed Sidebar)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('mobile-sidebar-closed.png', {
            mask: [page.locator('.message-meta'), page.locator('#app-version'), page.locator('#peer-count')],
            maxDiffPixelRatio: 0.1
        });
    });

    test('Visual: Mobile Sidebar Open', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.click('#sidebar-toggle');
        await expect(page.locator('#sidebar')).toHaveScreenshot('mobile-sidebar-open.png', {
            mask: [page.locator('#app-version')]
        });
    });

    test('Visual: Join Room Modal Content', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.click('#show-join-modal');
        await expect(page.locator('#join-modal .toon-modal')).toHaveScreenshot('join-modal.png');
    });


    test('Visual: Chat Bubble Right (Own)', async ({ page }) => {
        await page.click('#edit-profile-btn');
        await page.fill('#identity-input', 'VisualTester');
        await page.click('#identity-form button');
        await page.fill('#message-input', 'This is a visual regression test for a chat bubble.');
        await page.keyboard.press('Enter');
        const bubble = page.locator('.chat-bubble-right').first();
        await expect(bubble).toHaveScreenshot('chat-bubble-right.png', {
            mask: [page.locator('.message-meta')]
        });
    });

    test('Visual: System Message Styling', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('messages-container');
            container.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'system-message';
            div.textContent = 'SYSTEM MESSAGE STYLE CHECK';
            container.appendChild(div);
        });
        await expect(page.locator('.system-message')).toHaveScreenshot('system-message.png');
    });

    test('Visual: Sidebar Active Room Item', async ({ page }) => {
        await page.waitForSelector('.room-item.active');
        await expect(page.locator('.room-item.active')).toHaveScreenshot('active-room-item.png', {
            mask: [page.locator('.room-item.active div')],
            timeout: 15000
        });
    });

    test('Visual: Share Modal and Invite Feedback', async ({ page }) => {
        // Need a room other than saved-messages to show share button
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'visual-room');
        await page.click('#join-form button[type="submit"]');

        await page.click('#share-room-btn');
        // Snapshot the whole modal
        await expect(page.locator('#share-modal .toon-modal')).toHaveScreenshot('share-modal.png', {
            mask: [page.locator('#qrcode-container canvas')] // Mask QR code as it changes
        });

        await page.click('#copy-invite-btn');
        await expect(page.locator('#copy-invite-btn')).toHaveScreenshot('copy-invite-feedback.png');
    });

    test('Visual: Profile Identity in Sidebar', async ({ page }) => {
        await page.click('#edit-profile-btn');
        await page.fill('#identity-input', 'SUPER HERO');
        await page.click('#identity-form button');
        await expect(page.locator('#sidebar header')).toHaveScreenshot('sidebar-profile-header.png');
    });

    test('Visual: Sidebar Footer Version', async ({ page }) => {
        await expect(page.locator('#app-version')).toHaveScreenshot('app-version-tag.png');
    });

    test('Visual: Room List with Multiple Items', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-1');
        await page.click('#join-form button[type="submit"]');
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-2');
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#room-list')).toHaveScreenshot('room-list-multi.png', {
            mask: [page.locator('.room-item div:last-child')]
        });
    });


    test('Visual: Exit Button Styling', async ({ page }) => {
        // Join a room so exit button is visible
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'visual-room');
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#leave-btn')).toHaveScreenshot('exit-button.png');
    });

    test('Visual: Empty Message State Container', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.locator('#messages-container')).toHaveScreenshot('messages-empty-area.png');
    });

    test('Visual: Chat Input Field and Button', async ({ page }) => {
        await expect(page.locator('#chat-form')).toHaveScreenshot('chat-input-toolbar.png');
    });

    test('Visual: Dice Generator Button', async ({ page }) => {
        await page.click('#show-join-modal');
        await expect(page.locator('#gen-room-btn')).toHaveScreenshot('dice-button.png');
    });

    test('Visual: Modal Header styling', async ({ page }) => {
        await page.click('#show-join-modal');
        await expect(page.locator('#join-modal header')).toHaveScreenshot('modal-header.png');
    });

    test('Visual: Identity Input focused state', async ({ page }) => {
        await page.click('#edit-profile-btn');
        await page.focus('#identity-input');
        await expect(page.locator('#identity-input')).toHaveScreenshot('identity-input-focus.png');
    });

    test('Visual: App Shell Borders and Shadows', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.locator('#app')).toHaveScreenshot('app-shell-borders.png', {
            mask: [page.locator('#sidebar'), page.locator('main')]
        });
    });

});
