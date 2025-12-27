import { joinRoom } from 'https://esm.sh/trystero@0.22.0/nostr';

export class P2PMessenger {
    constructor(appId) {
        this.appId = appId;
        this.room = null;
        this.sendAction = null;
        this.peers = new Map();
        this.onMessage = null;
        this.onPeerUpdate = null;
        this.onSystemMessage = null;
        this.myHandle = '';
    }

    join(roomName, handle, password = null, topic = null) {
        this.myHandle = handle;
        const config = {
            appId: this.appId,
            relays: [
                'wss://relay.damus.io',
                'wss://relay.snort.social',
                'wss://eden.nostr.land',
                'wss://relay.ostr.com',
                'wss://relay.one'
            ],
            rtcConfig: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        };
        if (password) config.password = password;

        this.room = joinRoom(config, topic || roomName);

        const [sendMsg, getMsg] = this.room.makeAction('chat');
        this.sendAction = sendMsg;

        getMsg((data, peerId) => {
            console.log('Received data from', peerId, data);
            if (data.type === 'handshake') {
                this.peers.set(peerId, data.sender);
                this.notifySystem(`${data.sender} JOINED THE HERO COMPASS.`);
                this.sendAction({ type: 'handshake-reply', sender: this.myHandle });
                this.notifyPeers();
                return;
            }
            if (data.type === 'handshake-reply') {
                this.peers.set(peerId, data.sender);
                this.notifySystem(`CONNECTED TO ${data.sender}!`);
                this.notifyPeers();
                return;
            }
            if (this.onMessage) this.onMessage(data, peerId);
        });

        this.room.onPeerJoin(peerId => {
            console.log('Peer found in room:', peerId);
            this.notifySystem(`PEER FOUND, CONNECTING...`);
            if (this.sendAction) {
                this.sendAction({ type: 'handshake', sender: this.myHandle });
            }
        });

        this.room.onPeerLeave(peerId => {
            console.log('Peer left room:', peerId);
            const handle = this.peers.get(peerId) || 'A PEER';
            this.peers.delete(peerId);
            this.notifyPeers();
            this.notifySystem(`${handle} LEFT THE JOURNEY.`);
        });
    }

    sendMessage(text) {
        const message = {
            text,
            sender: this.myHandle,
            timestamp: Date.now()
        };
        if (this.sendAction) {
            this.sendAction(message);
        }
        return message;
    }

    leave() {
        if (this.room) {
            this.room.leave();
        }
    }

    getPeerCount() {
        return this.peers.size + 1;
    }

    notifySystem(msg) {
        if (this.onSystemMessage) this.onSystemMessage(msg);
    }

    notifyPeers() {
        if (this.onPeerUpdate) this.onPeerUpdate(this.getPeerCount());
    }
}
