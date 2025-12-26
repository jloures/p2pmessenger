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
    });

    test('Fuzz: Random Username Characters', async ({ page }) => {
        const fuzzName = getRandomString(50);
        await page.fill('#username', fuzzName);
        await page.fill('#room-id', 'fuzz-room');
        await page.click('button[type="submit"]');
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Random Room ID Characters', async ({ page }) => {
        const fuzzRoom = getRandomString(50);
        await page.fill('#username', 'Fuzzer');
        await page.fill('#room-id', fuzzRoom);
        await page.click('button[type="submit"]');
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Random Password Strings', async ({ page }) => {
        const fuzzPass = getRandomString(100);
        await page.fill('#username', 'Fuzzer');
        await page.fill('#room-id', 'fuzz-room');
        await page.fill('#room-password', fuzzPass);
        await page.click('button[type="submit"]');
        await expect(page.locator('#app')).toBeVisible();
    });

    test('Fuzz: Mass Random Messaging', async ({ page }) => {
        await page.fill('#username', 'SpeedyFuzzer');
        await page.fill('#room-id', 'perf-room');
        await page.click('button[type="submit"]');

        for (let i = 0; i < 20; i++) {
            const msg = getRandomString(Math.floor(Math.random() * 200));
            await page.fill('#message-input', msg);
            await page.keyboard.press('Enter');
        }

        const count = await page.locator('.chat-bubble-right').count();
        expect(count).toBeGreaterThan(0);
    });

    test('Fuzz: URL Hash Parameter Injection', async ({ page }) => {
        const urlSafeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~';
        const getUrlSafeString = (len) => Array.from({ length: len }, () => urlSafeChars[Math.floor(Math.random() * urlSafeChars.length)]).join('');

        const weirdHash = `#room=${getUrlSafeString(50)}&name=${getUrlSafeString(50)}&pass=${getUrlSafeString(50)}`;
        await page.goto('/' + weirdHash);

        await expect(page.locator('#app')).toBeVisible();
        const roomVal = await page.inputValue('#room-id');
        expect(roomVal).toBeDefined();
    });

    test('Fuzz: Huge Message Payload', async ({ page }) => {
        await page.fill('#username', 'GigantoFuzzer');
        await page.fill('#room-id', 'big-room');
        await page.click('button[type="submit"]');

        const hugeMsg = 'A'.repeat(5000); // 5KB string
        await page.fill('#message-input', hugeMsg);
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right').last()).toContainText('AAAA');
    });

    test('Fuzz: Malformed URL Hashes', async ({ page }) => {
        const malformedHashes = [
            '#room=&&&name===',
            '#?????????',
            '#room=test#room=doublerhash',
            '#name=<script>alert(1)</script>',
            '# ' + 'A'.repeat(1000)
        ];

        for (const hash of malformedHashes) {
            await page.goto('/' + hash);
            await expect(page.locator('#app')).toBeVisible();
        }
    });

    test('Fuzz: Rapid View Switching (Fake Clicks)', async ({ page }) => {
        await page.fill('#username', 'ClickerFuzzer');
        await page.fill('#room-id', 'click-room');
        await page.click('button[type="submit"]');

        for (let i = 0; i < 10; i++) {
            await page.click('#copy-room-btn');
            if (i % 2 === 0) {
                await page.fill('#message-input', 'spam');
                await page.keyboard.press('Enter');
            }
        }
        await expect(page.locator('#chat-view')).toBeVisible();
    });

    test('Fuzz: Empty/Whitespace Fields Interaction', async ({ page }) => {
        const whitespace = [' ', '  ', '\n', '\t', ' \n '];
        for (const ws of whitespace) {
            await page.fill('#username', ws);
            await page.fill('#room-id', ws);
            await page.click('button[type="submit"]');
            await expect(page.locator('#app')).toBeVisible();
        }
    });

    test('Fuzz: Unicode and Emoji Stress', async ({ page }) => {
        const unicodeStrings = [
            'こんにちは',
            '🚀🔥💎💥',
            '﷽',
            'Z̷A̷L̷G̷O̷',
            '‮Reverse Text‬',
            '\x00\x01\x02\x03'
        ];

        await page.fill('#username', 'EmojiFuzzer');
        await page.fill('#room-id', 'unicode-room');
        await page.click('button[type="submit"]');

        for (const str of unicodeStrings) {
            await page.fill('#message-input', str);
            await page.keyboard.press('Enter');
            await expect(page.locator('#messages-container')).toBeVisible();
        }
    });

});
