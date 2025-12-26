import { test, expect } from '@playwright/test';

test.describe('P2P Messenger UI Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the join view on start', async ({ page }) => {
        await expect(page.locator('#join-view')).toBeVisible();
        await expect(page.locator('h1').first()).toHaveText('P2PMESSENGER!');
    });

    test('should generate a random room ID when dice is clicked', async ({ page }) => {
        const roomIdInput = page.locator('#room-id');
        const diceBtn = page.locator('#gen-room-btn');

        const initialValue = await roomIdInput.inputValue();
        await diceBtn.click();

        const newValue = await roomIdInput.inputValue();
        expect(newValue).not.toBe(initialValue);
        expect(newValue).toMatch(/^room-/);
    });

    test('should transition to chat view after joining', async ({ page }) => {
        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'test-room');
        await page.click('button[type="submit"]');

        await expect(page.locator('#chat-view')).toBeVisible();
        await expect(page.locator('#join-view')).toBeHidden();
        await expect(page.locator('#display-room-id')).toHaveText('#TEST-ROOM');
    });

    test('should copy room link to clipboard', async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'share-room');
        await page.click('button[type="submit"]');

        await page.click('#copy-room-btn');

        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('#room=share-room');
    });

    test('should show disconnect button and reload on click', async ({ page }) => {
        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'test-room');
        await page.click('button[type="submit"]');

        await expect(page.locator('#leave-btn')).toBeVisible();

        // Clicking leave should reset to join view (via reload)
        await page.click('#leave-btn');
        await expect(page.locator('#join-view')).toBeVisible();
    });

    test('should auto-fill fields from URL hash parameters', async ({ page }) => {
        await page.goto('/#room=secret-base&pass=1234&name=AgentX');

        await expect(page.locator('#room-id')).toHaveValue('secret-base');
        await expect(page.locator('#room-password')).toHaveValue('1234');
        await expect(page.locator('#username')).toHaveValue('AgentX');
    });

    test('should prevent sending empty messages', async ({ page }) => {
        await page.fill('#username', 'TestUser');
        await page.fill('#room-id', 'test-room');
        await page.click('button[type="submit"]');

        const messageInput = page.locator('#message-input');
        await messageInput.fill('   ');
        await page.keyboard.press('Enter');

        // There should be no user messages yet (only the system message)
        const messages = page.locator('[class^="chat-bubble-"]');
        await expect(messages).toHaveCount(0);
    });

    test('should simulate a two-user interaction', async ({ browser }) => {
        // Session A
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await pageA.goto('/');
        await pageA.fill('#username', 'Alice');
        await pageA.fill('#room-id', 'p2p-test-room');
        await pageA.click('button[type="submit"]');

        // Session B
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        await pageB.fill('#username', 'Bob');
        await pageB.fill('#room-id', 'p2p-test-room');
        await pageB.click('button[type="submit"]');

        // Both should reach chat view
        await expect(pageA.locator('#chat-view')).toBeVisible();
        await expect(pageB.locator('#chat-view')).toBeVisible();

        // Wait for both to see "2 HEROES ONLINE" (themselves + the other)
        await expect(pageA.locator('#peer-count')).toHaveText('2 HEROES ONLINE', { timeout: 30000 });
        await expect(pageB.locator('#peer-count')).toHaveText('2 HEROES ONLINE', { timeout: 30000 });

        // Alice sends a message
        await pageA.fill('#message-input', 'Hello from Alice');
        await pageA.keyboard.press('Enter');

        // Verify Bob sees it (Alice's message should appear in Bob's view as a peer message)
        await expect(pageB.locator('.chat-bubble-left')).toContainText('Hello from Alice', { timeout: 30000 });

        // Bob replies
        await pageB.fill('#message-input', 'Hi Alice, I am Bob');
        await pageB.keyboard.press('Enter');

        // Verify Alice sees it
        await expect(pageA.locator('.chat-bubble-left')).toContainText('Hi Alice, I am Bob', { timeout: 30000 });

        await contextA.close();
        await contextB.close();
    });
});
