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

        for (let i = 0; i < 20; i++) {
            const msg = getRandomString(Math.floor(Math.random() * 200));
            await page.fill('#message-input', msg);
            await page.keyboard.press('Enter');
        }

        const count = await page.locator('.chat-bubble-right').count();
        expect(count).toBeGreaterThan(0);
    });

    test('Fuzz: Huge Message Payload', async ({ page }) => {
        await page.fill('#username', 'GigantoFuzzer');

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

        for (const str of unicodeStrings) {
            await page.fill('#message-input', str);
            await page.keyboard.press('Enter');
            await expect(page.locator('#messages-container')).toBeVisible();
        }
    });

});
