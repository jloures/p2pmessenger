import { test, expect } from '@playwright/test';

test.describe('p2pmessenger Unit Tests (Logic & Utilities)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('Utility: escapeHtml should sanitize sensitive characters', async ({ page }) => {
        const sanitized = await page.evaluate(() => {
            return window.utils.escapeHtml('<script>alert("XSS & fun")</script>');
        });
        expect(sanitized).toBe('&lt;script&gt;alert(&quot;XSS &amp; fun&quot;)&lt;/script&gt;');
    });

    test('Utility: generateRoomId should follow room-xxxx format', async ({ page }) => {
        const roomId = await page.evaluate(() => window.utils.generateRoomId());
        expect(roomId).toMatch(/^room-[a-z0-9]{7}$/);
    });

    test('Utility: validateHandle should enforce length limits', async ({ page }) => {
        const isValidShort = await page.evaluate(() => window.utils.validateHandle('A'));
        const isValidGood = await page.evaluate(() => window.utils.validateHandle('Hero'));
        const isValidLong = await page.evaluate(() => window.utils.validateHandle('ThisNameIsDefinitelyWayTooLongForThisApp'));

        expect(isValidShort).toBe(false);
        expect(isValidGood).toBe(true);
        expect(isValidLong).toBe(false);
    });

    test('Utility: validateRoomId should enforce length limits', async ({ page }) => {
        const isValidShort = await page.evaluate(() => window.utils.validateRoomId('rm'));
        const isValidGood = await page.evaluate(() => window.utils.validateRoomId('secret-room'));

        expect(isValidShort).toBe(false);
        expect(isValidGood).toBe(true);
    });

    test('Utility: parseHashParams should extract room and password', async ({ page }) => {
        const params = await page.evaluate(() => {
            return window.utils.parseHashParams('#room=test-room&pass=123&name=Alice');
        });
        expect(params.room).toBe('test-room');
        expect(params.pass).toBe('123');
        expect(params.name).toBe('Alice');
    });

    test('Utility: getInitials should return up to 2 characters', async ({ page }) => {
        const initials = await page.evaluate(() => window.utils.getInitials('Captain Amazing'));
        const initialsSingle = await page.evaluate(() => window.utils.getInitials('Hero'));

        expect(initials).toBe('CA');
        expect(initialsSingle).toBe('H');
    });

    test('Utility: truncate should shorten long text', async ({ page }) => {
        const longText = 'This is a very long message that needs to be shortened for the UI';
        const truncated = await page.evaluate((text) => window.utils.truncate(text, 10), longText);
        expect(truncated).toBe('This is a ...');
    });

    test('Utility: isSystemMessage should detect handshake events', async ({ page }) => {
        const isSys = await page.evaluate(() => window.utils.isSystemMessage({ type: 'handshake' }));
        const isNotSys = await page.evaluate(() => window.utils.isSystemMessage({ type: 'chat', text: 'hi' }));

        expect(isSys).toBe(true);
        expect(isNotSys).toBe(false);
    });

    test('Utility: sanitizeRoomName should format correctly', async ({ page }) => {
        const sanitized = await page.evaluate(() => window.utils.sanitizeRoomName('My Room ID!'));
        expect(sanitized).toBe('my-room-id-');
    });

    test('Utility: formatTime should return HH:MM format', async ({ page }) => {
        const time = await page.evaluate(() => {
            const date = new Date('2025-01-01T12:30:00');
            return window.utils.formatTime(date.getTime());
        });
        // Check for HH:MM format (handling local time variations like AM/PM or leading zeros)
        expect(time).toMatch(/\d{1,2}:\d{2}/);
    });

});
