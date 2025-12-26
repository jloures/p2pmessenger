# 🌌 p2pmessenger

**p2pmessenger** is a serverless, private, and purely peer-to-peer (P2P) messenger. It allows people to meet online and chat in real-time without a central server, ensuring high privacy and low latency.

[Preview here](https://jloures.github.io/p2pmessenger/)

## ✨ Features

- **Purely P2P**: No central server. Message relaying happens directly between browsers using WebRTC.
- **End-to-End Encryption (E2EE)**: Optional secret keys provide AES-256 encryption, ensuring only intended recipients can read messages.
- **Premium Aesthetics**: A stunning Glassmorphism design with animated background orbs and smooth transitions.
- **Mobile Optimized**: Fully responsive design with dynamic viewport handling for iPhone and Android.
- **Zero Configuration**: No account needed. Just pick a handle, a frequency (room), and a key.
- **Shareable Links**: Generate instant links that auto-fill the frequency and secret key for your peers.

## 🛠 Tech Stack

- **[Trystero](https://github.com/dmotz/trystero)**: P2P infrastructure using BitTorrent, IPFS, and Gun.
- **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling.
- **Vanilla JS & CSS**: Lightweight and high-performance implementation.

## 🚀 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd p2pmessenger
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the dev server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

### Deployment

The app is ready for any static hosting provider.

1. **Build the production assets**:
   ```bash
   npm run build
   ```
2. **Deploy the `dist/` folder**:
   Upload the contents of the `dist/` folder to your favorite host (e.g., GitHub Pages, Cloudflare Pages, S3).

## 🧪 How to Chat

1. Open the app in two different tabs or devices.
2. Enter the same **Frequency** (e.g., `secret-cave`).
3. (Optional) Enter the same **Secret Key** for encryption.
4. Click **Initialize Link**.
5. Once the system message "Connected to [Name]" appears, you are chatting directly!

## 🛡 Security

- All WebRTC traffic is encrypted via DTLS/SRTP.
- When a **Secret Key** is used, messages are encrypted at the application layer using AES-GCM before being transmitted.
- **p2pmessenger** never sees, stores, or touches your messages.

---
Built with ❤️ for a more private web.
