import { test, expect } from '@playwright/test';

test.describe('P2P Messenger Functional Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('messenger instance should be initialized on window', async ({ page }) => {
        const isMessengerDefined = await page.evaluate(() => typeof window.messenger !== 'undefined');
        expect(isMessengerDefined).toBe(true);
    });

    test('should handle message state correctly without UI verification', async ({ page }) => {
        await page.fill('#username', 'FunctionalUser');
        await page.fill('#room-id', 'functional-test');
        await page.click('button[type="submit"]');

        // Wait for chat view to be active
        await expect(page.locator('#chat-view')).toBeVisible();

        const messageData = await page.evaluate(() => {
            const msg = window.messenger.sendMessage('Hello logic!');
            return msg;
        });

        expect(messageData.text).toBe('Hello logic!');
        expect(messageData.sender).toBe('FunctionalUser');
        expect(messageData.timestamp).toBeGreaterThan(0);
    });

    test('should track peer count accurately in state', async ({ browser }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        const roomName = `peer-logic-${Math.random().toString(36).substring(7)}`;

        // Alice joins
        await pageA.goto('/');
        await pageA.evaluate((rn) => {
            window.messenger.join(rn, 'Alice');
        }, roomName);

        // Bob joins
        await pageB.goto('/');
        await pageB.evaluate((rn) => {
            window.messenger.join(rn, 'Bob');
        }, roomName);

        // Verify peer count in State for Alice (should see herself + Bob = 2)
        await expect.poll(async () => {
            return await pageA.evaluate(() => window.messenger.getPeerCount());
        }, { timeout: 30000 }).toBe(2);

        // Verify peer count in State for Bob (should see herself + Alice = 2)
        await expect.poll(async () => {
            return await pageB.evaluate(() => window.messenger.getPeerCount());
        }, { timeout: 30000 }).toBe(2);

        await contextA.close();
        await contextB.close();
    });

    test('should process incoming messages through the messenger callback', async ({ browser }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        const roomName = `msg-logic-${Math.random().toString(36).substring(7)}`;

        // Setup Alice to listen for messages
        await pageA.goto('/');
        await pageA.evaluate((rn) => {
            window.receivedMessages = [];
            window.messenger.onMessage = (data) => window.receivedMessages.push(data);
            window.messenger.join(rn, 'Alice');
        }, roomName);

        // Bob joins and sends message
        await pageB.goto('/');
        await pageB.evaluate(async (rn) => {
            window.messenger.join(rn, 'Bob');
        }, roomName);

        // Wait for Bob to see 2 peers before sending
        await expect.poll(async () => {
            return await pageB.evaluate(() => window.messenger.getPeerCount());
        }, { timeout: 30000 }).toBe(2);

        await pageB.evaluate(() => {
            window.messenger.sendMessage('Logic Test Message');
        });

        // Check if Alice's state received the message
        await expect.poll(async () => {
            return await pageA.evaluate(() => window.receivedMessages.length);
        }, { timeout: 30000 }).toBeGreaterThan(0);

        const received = await pageA.evaluate(() => window.receivedMessages[0]);
        expect(received.text).toBe('Logic Test Message');
        expect(received.sender).toBe('Bob');

        await contextA.close();
        await contextB.close();
    });
});
