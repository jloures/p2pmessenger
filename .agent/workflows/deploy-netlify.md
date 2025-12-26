---
description: Deploy the P2P Messenger to Netlify
---

This workflow helps you deploy your static P2P messenger to Netlify.

1. Build the production assets
// turbo
run: npm run build

2. Initialize Netlify deployment (interactive)
Instruction: You will need to run this command yourself to authenticate with your Netlify account.
run: npx netlify deploy --dir=dist

3. Deploy to production
Instruction: Once you are happy with the draft, run this to go live.
run: npx netlify deploy --dir=dist --prod
