import { test, expect } from '@playwright/test';

const getRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=-[]{};:\|,.<>/?`~ \n\u200B\uD83D\uDE00';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

test.describe('p2pmessenger Fuzz Testing (UI Resilience & Input Handling)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'FuzzHero');
            await page.click('#identity-form button');
        }
    });

    // --- Existing Tests (1-7) ---

    test('Fuzz: Random Username Characters', async ({ page }) => {
        const fuzzName = getRandomString(50);
        await page.fill('#username', fuzzName);
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Random Room ID Characters in Modal', async ({ page }) => {
        await page.click('#show-join-modal');
        const fuzzRoom = getRandomString(50);
        await page.fill('#room-id', fuzzRoom);
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Random Password Strings', async ({ page }) => {
        await page.click('#show-join-modal');
        const fuzzPass = getRandomString(100);
        await page.fill('#room-id', 'fuzz-room');
        await page.fill('#room-password', fuzzPass);
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Mass Random Messaging', async ({ page }) => {
        await page.fill('#username', 'SpeedyFuzzer');

        for (let i = 0; i < 10; i++) {
            const msg = getRandomString(Math.floor(Math.random() * 200));
            await page.fill('#message-input', msg);
            await page.keyboard.press('Enter');
        }

        const count = await page.locator('.chat-bubble-right').count();
        expect(count).toBeGreaterThan(0);
    });

    test('Fuzz: Huge Message Payload', async ({ page }) => {
        await page.fill('#username', 'GigantoFuzzer');
        const hugeMsg = 'A'.repeat(5000);
        await page.fill('#message-input', hugeMsg);
        await page.keyboard.press('Enter');
        await expect(page.locator('.chat-bubble-right').last()).toContainText('AAAA');
    });

    test('Fuzz: Malformed URL Hashes', async ({ page }) => {
        const malformedHashes = ['#room=&&&name===', '#?????????', '#room=t#room=d', '#name=<script>alert(1)</script>'];
        for (const hash of malformedHashes) {
            await page.goto('/' + hash);
            await expect(page.locator('#app')).toBeVisible();
        }
    });

    test('Fuzz: Unicode and Emoji Stress', async ({ page }) => {
        const unicodeStrings = ['こんにちは', '🚀🔥💎💥', '﷽', 'Z̷A̷L̷G̷O̷'];
        for (const str of unicodeStrings) {
            await page.fill('#message-input', str);
            await page.keyboard.press('Enter');
            await expect(page.locator('#messages-container')).toBeVisible();
        }
    });

    // --- New Fuzz Tests (8-17) ---

    test('Fuzz: Rapid Room Switching Stress', async ({ page }) => {
        // Create 5 rooms
        for (let i = 0; i < 5; i++) {
            await page.click('#show-join-modal');
            await page.fill('#room-id', `stress-room-${i}`);
            await page.click('#join-form button[type="submit"]');
        }

        // Rapidly click between tags in sidebar
        const roomItems = page.locator('.room-item');
        for (let i = 0; i < 15; i++) {
            const index = i % 6; // 5 created + 1 default
            await roomItems.nth(index).click();
        }
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Malformed Rename Inputs', async ({ page }) => {
        const roomID = 'rename-fuzz';
        await page.click('#show-join-modal');
        await page.fill('#room-id', roomID);
        await page.click('#join-form button[type="submit"]');

        const weirdNames = ['   ', '\n\n', 'A'.repeat(500), '<b>Bold</b>', '"); alert(1); ("'];
        for (const name of weirdNames) {
            page.once('dialog', d => d.accept(name));
            await page.locator(`.room-item[data-room-id="${roomID}"]`).hover();
            await page.locator(`.rename-btn[data-id="${roomID}"]`).click({ force: true });
        }
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Maximum Room Count Stress', async ({ page }) => {
        // Create 25 rooms to check sidebar layout stability
        for (let i = 0; i < 25; i++) {
            await page.click('#show-join-modal');
            await page.fill('#room-id', `mega-room-${i}`);
            await page.click('#join-form button[type="submit"]');
        }
        const count = await page.locator('.room-item').count();
        expect(count).toBeGreaterThanOrEqual(26);
    });

    test('Fuzz: Corrupt LocalStorage Recovery', async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('p2p_rooms', 'not-json-at-all');
            window.localStorage.setItem('p2p_messages', '{"valid": "but-wrong-shape"}');
        });
        await page.reload();
        // App should still load default Saved-Messages
        await expect(page.locator('#display-room-id')).toContainText('FUZZHERO');
    });

    test('Fuzz: Rapid Navigation (Back/Forward)', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'nav-room-1');
        await page.click('#join-form button[type="submit"]');

        await page.click('[data-room-id="saved-messages"]');

        for (let i = 0; i < 5; i++) {
            await page.goBack();
            await page.goForward();
        }
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Mixed RTL/LTR Layout Resilience', async ({ page }) => {
        const mixedText = 'Hello ‮This is reversed‬ and regular and السلام عليكم';
        await page.fill('#message-input', mixedText);
        await page.keyboard.press('Enter');
        const bubble = page.locator('.chat-bubble-right').last();
        await expect(bubble).toBeVisible();
    });

    test('Fuzz: Rapid Mobile Viewport Resizing', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'resize-room');
        await page.click('#join-form button[type="submit"]');

        const sizes = [
            { width: 375, height: 667 }, // iPhone
            { width: 1024, height: 1366 }, // iPad
            { width: 1920, height: 1080 } // Desktop
        ];

        for (const size of sizes) {
            await page.setViewportSize(size);
            await expect(page.locator('#app')).toBeVisible();
        }
    });

    test('Fuzz: Invalid Password Key Chars', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'key-room');
        await page.fill('#room-password', '\x00\x01\x1F\x7F'); // Control chars
        await page.click('#join-form button[type="submit"]');
        await expect(page.locator('#display-room-id')).toContainText('KEY-ROOM');
    });

    test('Fuzz: Rapid Modal Open/Close', async ({ page }) => {
        for (let i = 0; i < 10; i++) {
            await page.click('#show-join-modal');
            await page.click('#close-modal');
        }
        await expect(page.locator('#join-modal')).toBeHidden();
    });

    test('Fuzz: Binary-like String Messaging', async ({ page }) => {
        // Random "binary" data as strings
        const binaryString = String.fromCharCode(...Array.from({ length: 100 }, () => Math.floor(Math.random() * 256)));
        await page.fill('#message-input', binaryString);
        await page.keyboard.press('Enter');
        await expect(page.locator('.chat-bubble-right').last()).toBeVisible();
    });

});
