import { joinRoom } from 'https://esm.sh/trystero@0.22.0/torrent';

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

    join(roomName, handle, password = null) {
        this.myHandle = handle;
        const config = { appId: this.appId };
        if (password) config.password = password;

        this.room = joinRoom(config, roomName);

        const [sendMsg, getMsg] = this.room.makeAction('chat');
        this.sendAction = sendMsg;

        getMsg((data, peerId) => {
            if (data.type === 'handshake') {
                this.peers.set(peerId, data.sender);
                this.notifySystem(`${data.sender} joined.`);
                this.sendAction({ type: 'handshake-reply', sender: this.myHandle });
                this.notifyPeers();
                return;
            }
            if (data.type === 'handshake-reply') {
                this.peers.set(peerId, data.sender);
                this.notifySystem(`Connected to ${data.sender}.`);
                this.notifyPeers();
                return;
            }
            if (this.onMessage) this.onMessage(data, peerId);
        });

        this.room.onPeerJoin(peerId => {
            this.notifySystem(`Peer found, shaking hands...`);
            if (this.sendAction) {
                this.sendAction({ type: 'handshake', sender: this.myHandle });
            }
        });

        this.room.onPeerLeave(peerId => {
            const handle = this.peers.get(peerId) || 'A peer';
            this.peers.delete(peerId);
            this.notifyPeers();
            this.notifySystem(`${handle} left.`);
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
