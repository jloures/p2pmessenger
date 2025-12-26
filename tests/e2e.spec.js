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
        await alicePage.click('#show-join-modal');
        await alicePage.fill('#room-id', roomName);
        await alicePage.click('#join-form button[type="submit"]');

        // Alice is in
        await expect(alicePage.locator('#display-room-id')).toHaveText(roomName.toUpperCase());
        await expect(alicePage.locator('#peer-count')).toContainText('1 HERO ONLINE', { timeout: 30000 });

        // 2. Alice copies the link
        await alicePage.click('#copy-room-btn');
        const shareLink = await alicePage.evaluate(() => navigator.clipboard.readText());
        expect(shareLink).toContain(`#room=${roomName}`);

        // 3. Bob joins using the share link
        const bobContext = await browser.newContext();
        const bobPage = await bobContext.newPage();
        await bobPage.goto(`${shareLink}&name=Bob`);

        await expect(bobPage.locator('#display-room-id')).toHaveText(roomName.toUpperCase());
        await bobPage.fill('#username', 'Bob');

        // 4. Verification of Connection
        await expect(alicePage.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 45000 });
        await expect(bobPage.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 45000 });

        // 5. Chat Exchange
        await alicePage.fill('#message-input', 'Hey Bob, is this secure?');
        await alicePage.keyboard.press('Enter');

        await expect(bobPage.locator('.chat-bubble-left')).toContainText('Hey Bob, is this secure?', { timeout: 15000 });

        await bobPage.fill('#message-input', 'Totally! No servers involved. 🚀');
        await bobPage.keyboard.press('Enter');

        await expect(alicePage.locator('.chat-bubble-left')).toContainText('Totally! No servers involved.', { timeout: 15000 });

        // 6. Leaving the Room
        await bobPage.click('#leave-btn');
        // Bob should be back in Saved Messages
        await expect(bobPage.locator('#display-room-id')).toContainText('SAVED-MESSAGES');

        // Alice should see Bob left
        await expect(alicePage.locator('#peer-count')).toContainText('1 HERO ONLINE', { timeout: 30000 });
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
        await pageA.click('#show-join-modal');
        await pageA.fill('#room-id', roomName);
        await pageA.fill('#room-password', 'password-A');
        await pageA.click('#join-form button[type="submit"]');

        // Bob joins same room with password 'B'
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        await pageB.fill('#username', 'Bob');
        await pageB.click('#show-join-modal');
        await pageB.fill('#room-id', roomName);
        await pageB.fill('#room-password', 'password-B');
        await pageB.click('#join-form button[type="submit"]');

        // They should NEVER see each other
        await pageA.waitForTimeout(10000);

        await expect(pageA.locator('#peer-count')).toContainText('1 HERO ONLINE');
        await expect(pageB.locator('#peer-count')).toContainText('1 HERO ONLINE');

        await contextA.close();
        await contextB.close();
    });
});
