import { test, expect } from '@playwright/test';

test.describe('P2P Messenger Functional Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('P2PMessenger class should be available on window', async ({ page }) => {
        const isClassDefined = await page.evaluate(() => typeof window.P2PMessenger !== 'undefined');
        expect(isClassDefined).toBe(true);
    });

    test('should handle message state correctly using a new messenger instance', async ({ page }) => {
        const messageData = await page.evaluate(() => {
            const m = new window.P2PMessenger('test-app');
            m.myHandle = 'FunctionalUser';
            const msg = m.sendMessage('Hello logic!');
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

        await pageA.goto('/');
        await pageB.goto('/');

        // Initialize and join Alice
        await pageA.evaluate((rn) => {
            window.testMessenger = new window.P2PMessenger('test-app');
            window.testMessenger.join(rn, 'Alice');
        }, roomName);

        // Initialize and join Bob
        await pageB.evaluate((rn) => {
            window.testMessenger = new window.P2PMessenger('test-app');
            window.testMessenger.join(rn, 'Bob');
        }, roomName);

        // Verify peer count for Alice
        await expect.poll(async () => {
            return await pageA.evaluate(() => window.testMessenger.getPeerCount());
        }, { timeout: 30000 }).toBe(2);

        // Verify peer count for Bob
        await expect.poll(async () => {
            return await pageB.evaluate(() => window.testMessenger.getPeerCount());
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

        await pageA.goto('/');
        await pageB.goto('/');

        // Setup Alice
        await pageA.evaluate((rn) => {
            window.receivedMessages = [];
            window.testMessenger = new window.P2PMessenger('test-app');
            window.testMessenger.onMessage = (data) => window.receivedMessages.push(data);
            window.testMessenger.join(rn, 'Alice');
        }, roomName);

        // Bob joins and sends
        await pageB.evaluate(async (rn) => {
            window.testMessenger = new window.P2PMessenger('test-app');
            window.testMessenger.join(rn, 'Bob');
        }, roomName);

        // Wait for connection
        await expect.poll(async () => {
            return await pageB.evaluate(() => window.testMessenger.getPeerCount());
        }, { timeout: 30000 }).toBe(2);

        await pageB.evaluate(() => {
            window.testMessenger.sendMessage('Logic Test Message');
        });

        // Check Alice
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
