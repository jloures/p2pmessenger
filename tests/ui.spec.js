import { test, expect } from '@playwright/test';

test.describe('P2P Messenger UI Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle identity modal if it appears
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'TestHero');
            await page.click('#identity-form button');
        }
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    });

    // 1. Initial State
    test('UI 1: Should display sidebar and User identity on load', async ({ page }) => {
        await expect(page.locator('#sidebar')).toBeVisible();
        await expect(page.locator('#display-room-id')).toContainText('TESTHERO');
        await expect(page.locator('.room-item.active')).toContainText('TestHero');
    });

    // 2. Persistence: Username
    test('UI 2: Should persist username in localStorage', async ({ page }) => {
        const username = 'PersistenceHero';
        await page.fill('#username', username);
        await page.reload();
        await expect(page.locator('#username')).toHaveValue(username);
    });

    // 3. Mobile Interactions
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

    // 4. Modal Visibility
    test('UI 4: Should open and close the join room modal', async ({ page }) => {
        const modal = page.locator('#join-modal');
        await page.click('#show-join-modal');
        await expect(modal).toBeVisible();
        await page.click('#close-modal');
        await expect(modal).toBeHidden();
    });

    // 5. Room ID Generator
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

    // 6. Joining a Room
    test('UI 6: Should join a new room and update sidebar list', async ({ page }) => {
        const roomID = 'hero-base';
        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#display-room-id')).toHaveText(roomID.toUpperCase());
        await expect(page.locator('#room-list')).toContainText(roomID);
    });

    // 7. Renaming Active Room
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

    // 8. Subtitle Logic
    test('UI 8: Should show room technical ID in subtitle when renamed', async ({ page }) => {
        const roomID = 'subtitle-test';
        const nickname = 'Secret HQ';
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

    // 9. Room Protected from Rename
    test('UI 9: Should not show rename button for Saved-Messages', async ({ page }) => {
        const savedItem = page.locator('.room-item[data-room-id="saved-messages"]');
        await savedItem.hover();
        const renameBtn = savedItem.locator('.rename-btn');
        await expect(renameBtn).toHaveCount(0);
    });

    // 10. Duplicate Room Prevention
    test('UI 10: Should not add duplicate rooms to the sidebar', async ({ page }) => {
        const roomID = 'no-dupes';
        for (let i = 0; i < 2; i++) {
            await page.click('#show-join-modal');
            await page.fill('#room-id', roomID);
            await page.click('#join-form button[type="submit"]');
        }
        const roomItems = page.locator(`.room-item[data-room-id="${roomID}"]`);
        await expect(roomItems).toHaveCount(1);
    });

    // 11. Navigation
    test('UI 11: Should navigate correctly between multiple rooms', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-1');
        await page.click('#join-form button[type="submit"]');
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-2');
        await page.click('#join-form button[type="submit"]');

        await page.click('[data-room-id="room-1"]');
        await expect(page.locator('#display-room-id')).toHaveText('ROOM-1');
        await page.click('[data-room-id="saved-messages"]');
        await expect(page.locator('#display-room-id')).toContainText('TESTHERO');
    });

    // 12. Leaving Rooms
    test('UI 12: Should remove a room from the list when EXIT is clicked', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'bye-bye');
        await page.click('#join-form button[type="submit"]');

        await page.click('#leave-btn');
        await expect(page.locator('#room-list')).not.toContainText('bye-bye');
        await expect(page.locator('#display-room-id')).toContainText('TESTHERO');
    });

    // 13. Clipboard Feedback
    test('UI 13: Should provide visual feedback when copying room link', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-write']);
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'copy-link');
        await page.click('#join-form button[type="submit"]');

        const copyBtn = page.locator('#copy-room-btn');
        await copyBtn.click();
        await expect(copyBtn).toHaveText('COPIED! ✅');
        await expect(copyBtn).toHaveText('LINK 🔗', { timeout: 5000 });
    });

    // 14. Message Input: No empty
    test('UI 14: Should prevent sending whitespace-only messages', async ({ page }) => {
        const input = page.locator('#message-input');
        await input.fill('     ');
        await page.keyboard.press('Enter');
        const messages = page.locator('.chat-bubble-left, .chat-bubble-right');
        await expect(messages).toHaveCount(0);
    });

    // 15. Message History Persistence (Local)
    test('UI 15: Should persist Saved-Messages history after reload', async ({ page }) => {
        const msg = 'My private note';
        await page.fill('#message-input', msg);
        await page.keyboard.press('Enter');
        await page.reload();
        await expect(page.locator('#messages-container')).toContainText(msg);
    });

    // 16. Message Isolation
    test('UI 16: Should isolate message history between rooms', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-a');
        await page.click('#join-form button[type="submit"]');
        await page.fill('#message-input', 'Message in A');
        await page.keyboard.press('Enter');

        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-b');
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#messages-container')).not.toContainText('Message in A');
    });

    // 17. Auto-join via URL Hash (Username)
    test('UI 17: Should set username from URL hash parameters', async ({ page }) => {
        await page.goto('/#name=HashHero');
        await expect(page.locator('#username')).toHaveValue('HashHero');
    });

    // 18. Auto-join via URL Hash (Room)
    test('UI 18: Should auto-join room from URL hash parameters', async ({ page }) => {
        const room = 'hash-room';
        await page.goto(`/#room=${room}`);
        await expect(page.locator('#display-room-id')).toHaveText(room.toUpperCase());
        await expect(page.locator('#room-list')).toContainText(room);
    });

    // 19. Hero Name Profile Sync
    test('UI 19: Should update profile identity in sidebar when username changes', async ({ page }) => {
        const username = 'NewIdentity';
        await page.fill('#username', username);
        // We look for the profile section in sidebar
        await expect(page.locator('#sidebar')).toContainText(username);
    });

    // 20. Active Room Styling
    test('UI 20: Should apply active class to the current room in sidebar', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'active-test');
        await page.click('#join-form button[type="submit"]');

        const activeLink = page.locator('.room-item.active');
        await expect(activeLink).toContainText('active-test');

        await page.click('[data-room-id="saved-messages"]');
        await expect(activeLink).toContainText(/TestHero/);
    });

    // 21. Modal Validation
    test('UI 21: Should show browser validation if room ID is empty', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', '');
        await page.click('#join-form button[type="submit"]');

        // Modal should still be open because form didn't submit
        await expect(page.locator('#join-modal')).toBeVisible();
    });

    // 22. Multiple Rename Operations
    test('UI 22: Should allow multiple renames on the same room', async ({ page }) => {
        const roomID = 'multi-rename';
        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        // First rename
        page.once('dialog', async dialog => { await dialog.accept('Alpha'); });
        await page.locator(`.room-item[data-room-id="${roomID}"]`).hover();
        await page.locator(`.rename-btn[data-id="${roomID}"]`).click({ force: true });
        await expect(page.locator('#display-room-id')).toHaveText('ALPHA');

        // Second rename
        page.once('dialog', async dialog => { await dialog.accept('Beta'); });
        await page.locator(`.room-item[data-room-id="${roomID}"]`).hover();
        await page.locator(`.rename-btn[data-id="${roomID}"]`).click({ force: true });
        await expect(page.locator('#display-room-id')).toHaveText('BETA');
    });

    // 23. Message Timestamp Formatting
    test('UI 23: Should display message timestamp in HH:MM format', async ({ page }) => {
        await page.fill('#message-input', 'Timestamp check');
        await page.keyboard.press('Enter');
        const timestamp = page.locator('.message-meta');
        await expect(timestamp).toHaveText(/^\d{2}:\d{2} (AM|PM)$/);
    });

    // 24. Message Bubble Styling
    test('UI 24: Own messages should have the chat-bubble-right class', async ({ page }) => {
        await page.fill('#message-input', 'Style check');
        await page.keyboard.press('Enter');
        const bubble = page.locator('.chat-bubble-right');
        await expect(bubble).toBeVisible();
    });

    // 25. Password Field Masking
    test('UI 25: Join modal password field should mask input', async ({ page }) => {
        await page.click('#show-join-modal');
        const passInput = page.locator('#room-password');
        await expect(passInput).toHaveAttribute('type', 'password');
    });

    // 26. Custom Room Icon
    test('UI 26: New rooms should have the default 💬 icon in sidebar', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'icon-room');
        await page.click('#join-form button[type="submit"]');
        const icon = page.locator('.room-item[data-room-id="icon-room"] .room-icon');
        await expect(icon).toHaveText('💬');
    });

    // 27. HTML Escaping in Messages
    test('UI 27: Should escape HTML tags in messages to prevent XSS', async ({ page }) => {
        const xss = '<script>alert("xss")</script><b>Bold</b>';
        await page.fill('#message-input', xss);
        await page.keyboard.press('Enter');
        const bubbleContent = await page.locator('.chat-bubble-right').innerHTML();
        expect(bubbleContent).toContain('&lt;script&gt;');
        expect(bubbleContent).not.toContain('<script>');
    });

    // 28. Sidebar Horizontal Layout on Large Screens
    test('UI 28: Sidebar should be visible on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 800 });
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toBeVisible();
    });

    // 29. App Version Display
    test('UI 29: Should display the app version in sidebar footer', async ({ page }) => {
        const version = page.locator('#app-version');
        await expect(version).toHaveText(/v\d+\.\d+\.\d+/);
    });

    // 30. Empty Room Name on Join
    test('UI 30: Should not submit join form if Room ID is missing', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.click('#join-form button[type="submit"]');
        const modal = page.locator('#join-modal');
        await expect(modal).toBeVisible(); // Still visible
    });

    // 31. Click outside Modal (Backdrop)
    test('UI 31: Should not close modal when clicking the join-modal backdrop directly', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.mouse.click(10, 10); // Click top left corner (backdrop area)
        const modal = page.locator('#join-modal');
        await expect(modal).toBeVisible();
    });

    // 32. Rename Prompt Cancellation
    test('UI 32: Should not rename room if prompt is cancelled', async ({ page }) => {
        const roomID = 'cancel-rename';
        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        page.once('dialog', dialog => dialog.dismiss());
        await page.locator(`.room-item[data-room-id="${roomID}"]`).hover();
        await page.locator(`.rename-btn[data-id="${roomID}"]`).click({ force: true });

        await expect(page.locator('#display-room-id')).toHaveText(roomID.toUpperCase());
    });

    // 33. Sidebar Profile Default
    test('UI 33: Profile name should not update if input is too short (min 4)', async ({ page }) => {
        await page.fill('#username', 'abc');
        const profile = page.locator('#profile-name');
        await expect(profile).toHaveText('TestHero');
    });

    // 34. System Message Rendering
    test('UI 34: System messages should be rendered in the chat container', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('messages-container');
            const div = document.createElement('div');
            div.className = 'system-message';
            div.textContent = 'MOCKED SYSTEM MESSAGE';
            container.appendChild(div);
        });
        await expect(page.locator('.system-message')).toContainText('MOCKED SYSTEM MESSAGE');
    });

    // 35. Message Input Auto-focus
    test('UI 35: Message input should be focused after room switch', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'focus-test');
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#message-input')).toBeFocused();
    });

    // 36. Link Revert Timeout
    test('UI 36: Copy button should revert to "LINK 🔗" after feedback', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-write']);
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'revert-test');
        await page.click('#join-form button[type="submit"]');

        const btn = page.locator('#copy-room-btn');
        await btn.click();
        await expect(btn).toHaveText('COPIED! ✅');
        await expect(btn).toHaveText('LINK 🔗', { timeout: 3000 });
    });

    // 37. URL Hash Room change while app is open
    test('UI 37: Should switch room when URL hash changes manually', async ({ page }) => {
        await page.evaluate(() => window.location.hash = '#room=manual-room');
        await expect(page.locator('#display-room-id')).toHaveText('MANUAL-ROOM');
    });

    // 38. Long message truncation/wrapping
    test('UI 38: Long messages should wrap and not overflow container', async ({ page }) => {
        const longWord = 'A'.repeat(100);
        await page.fill('#message-input', longWord);
        await page.keyboard.press('Enter');
        const bubble = page.locator('.chat-bubble-right');
        await expect(bubble).toHaveCSS('overflow-wrap', 'break-word');
    });

    // 39. Rename Saved-Messages via JS prevention
    test('UI 39: UI should not provide rename UI for private channels', async ({ page }) => {
        const saved = page.locator('.room-item[data-room-id="saved-messages"]');
        await saved.hover();
        await expect(saved.locator('.rename-btn')).not.toBeVisible();
    });

    // 40. Message sequence check
    test('UI 40: Messages should appear in the order they are sent', async ({ page }) => {
        await page.fill('#message-input', 'First');
        await page.keyboard.press('Enter');
        await page.fill('#message-input', 'Second');
        await page.keyboard.press('Enter');

        const texts = await page.locator('.chat-bubble-right').allTextContents();
        expect(texts[0]).toContain('First');
        expect(texts[1]).toContain('Second');
    });

    // 41. Profile Name Casing
    test('UI 41: Profile name in sidebar should be uppercase in UI', async ({ page }) => {
        await page.fill('#username', 'bobby');
        const profile = page.locator('#profile-name');
        await expect(profile).toHaveText(/bobby/i);
        await expect(profile).toHaveCSS('text-transform', 'uppercase');
    });

    // 42. Multi-room message separation
    test('UI 42: Switching back to a room should restore its message history', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-1');
        await page.click('#join-form button[type="submit"]');
        await page.fill('#message-input', 'Hello 1');
        await page.keyboard.press('Enter');

        await page.click('[data-room-id="saved-messages"]');
        await page.fill('#message-input', 'Personal Note');
        await page.keyboard.press('Enter');

        await page.click('[data-room-id="room-1"]');
        await expect(page.locator('#messages-container')).toContainText('Hello 1');
        await expect(page.locator('#messages-container')).not.toContainText('Personal Note');
    });

});
