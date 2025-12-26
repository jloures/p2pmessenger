import { test, expect } from '@playwright/test';

test.describe('P2P Messenger End-to-End Journeys', () => {

    test('Complete User Journey: Create -> Share -> Chat -> Leave', async ({ browser }) => {
        // 1. Alice creates a room
        const aliceContext = await browser.newContext();
        await aliceContext.grantPermissions(['clipboard-read', 'clipboard-write']);
        const alicePage = await aliceContext.newPage();
        await alicePage.goto('/');

        const roomName = `e2e-room-${Math.random().toString(36).substring(7)}`;
        await alicePage.fill('#username', 'Alice');
        await alicePage.fill('#room-id', roomName);
        await alicePage.click('button[type="submit"]');

        // Alice is in
        await expect(alicePage.locator('#chat-view')).toBeVisible();
        await expect(alicePage.locator('#peer-count')).toHaveText('1 Peer');

        // 2. Alice copies the link
        await alicePage.click('#copy-room-btn');
        const shareLink = await alicePage.evaluate(() => navigator.clipboard.readText());
        expect(shareLink).toContain(`#room=${roomName}`);

        // 3. Bob joins using the share link
        const bobContext = await browser.newContext();
        const bobPage = await bobContext.newPage();
        await bobPage.goto(shareLink);

        // Bob should see room ID pre-filled
        await expect(bobPage.locator('#room-id')).toHaveValue(roomName);
        await bobPage.fill('#username', 'Bob');
        await bobPage.click('button[type="submit"]');

        // 4. Verification of Connection
        await expect(alicePage.locator('#peer-count')).toHaveText('2 Peers', { timeout: 30000 });
        await expect(bobPage.locator('#peer-count')).toHaveText('2 Peers', { timeout: 30000 });

        // 5. Encrypted Chat Exchange
        await alicePage.fill('#message-input', 'Hey Bob, is this secure?');
        await alicePage.keyboard.press('Enter');

        await expect(bobPage.locator('.chat-bubble-left')).toContainText('Hey Bob, is this secure?', { timeout: 10000 });

        await bobPage.fill('#message-input', 'Totally! No servers involved. 🚀');
        await bobPage.keyboard.press('Enter');

        await expect(alicePage.locator('.chat-bubble-left')).toContainText('Totally! No servers involved.', { timeout: 10000 });

        // 6. Leaving the Room
        await bobPage.click('#leave-btn');
        await expect(bobPage.locator('#join-view')).toBeVisible();

        // Alice should see Bob left
        await expect(alicePage.locator('#peer-count')).toHaveText('1 Peer', { timeout: 30000 });

        // Check for the system message anywhere in the container
        await expect(alicePage.locator('#messages-container')).toContainText('BOB LEFT', { timeout: 15000 });

        await aliceContext.close();
        await bobContext.close();
    });

    test('E2EE Security: Peers with different keys should not connect', async ({ browser }) => {
        const roomName = `secure-room-${Math.random().toString(36).substring(7)}`;

        // Alice joins with password 'A'
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await pageA.goto('/');
        await pageA.fill('#username', 'Alice');
        await pageA.fill('#room-id', roomName);
        await pageA.fill('#room-password', 'password-A');
        await pageA.click('button[type="submit"]');

        // Bob joins same room with password 'B'
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        await pageB.fill('#username', 'Bob');
        await pageB.fill('#room-id', roomName);
        await pageB.fill('#room-password', 'password-B');
        await pageB.click('button[type="submit"]');

        // They should NEVER see each other
        // We wait 10 seconds to ensure no background connection happens
        await pageA.waitForTimeout(10000);

        const alicePeerCount = await pageA.locator('#peer-count').textContent();
        const bobPeerCount = await pageB.locator('#peer-count').textContent();

        expect(alicePeerCount).toBe('1 Peer');
        expect(bobPeerCount).toBe('1 Peer');

        await contextA.close();
        await contextB.close();
    });

    test('Scalability: 3-Way Mesh Connection', async ({ browser }) => {
        const roomName = `mesh-room-${Math.random().toString(36).substring(7)}`;
        const users = ['Alice', 'Bob', 'Charlie'];
        const pages = [];

        for (const name of users) {
            const context = await browser.newContext();
            const page = await context.newPage();
            await page.goto('/');
            await page.fill('#username', name);
            await page.fill('#room-id', roomName);
            await page.click('button[type="submit"]');
            pages.push(page);
        }

        // Every user should eventually see "3 Peers"
        for (const page of pages) {
            await expect(page.locator('#peer-count')).toHaveText('3 Peers', { timeout: 60000 });
        }

        // Alice sends one message
        await pages[0].fill('#message-input', 'Hello everyone!');
        await pages[0].keyboard.press('Enter');

        // Both Bob and Charlie should receive it
        await expect(pages[1].locator('.chat-bubble-left')).toContainText('Hello everyone!', { timeout: 15000 });
        await expect(pages[2].locator('.chat-bubble-left')).toContainText('Hello everyone!', { timeout: 15000 });

        for (const page of pages) {
            await page.context().close();
        }
    });
});
