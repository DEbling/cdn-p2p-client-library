import {WSAnswerMessage, WSICECandidate, WSMessage, WSOfferMessage} from "./types";
import {arrayBufferToBase64} from "./utils";
import {fromEvent, merge, NEVER, Observable} from "rxjs";
import {filter, map, take} from "rxjs/operators";

const CONFIGURATION = {
  iceServers: [{ urls: "stun:stun.1.google.com:19302" }]
};

interface P2PWantMessage {
  kind: 'WANT';
  resource: string;
}

interface P2PProvideMessage {
  kind: 'PROVIDE';
  resource: string;
  data: string;
}

type P2PMessage = P2PWantMessage | P2PProvideMessage;

export class P2PMesh {
  private readonly ws: WebSocket;
  isConnected = false;
  clientId?: string;
  private rtcConn?: RTCPeerConnection;
  private dataCh?: RTCDataChannel;

  private fetchedResource: ArrayBuffer | null = null;
  private resourceWanting: string | null = null;

  // [peerid, msg]
  private p2pMessages: Observable<[string, P2PMessage]> = NEVER;

  private readonly peers = new Map<string, [RTCPeerConnection, RTCDataChannel | null]>();


  constructor(serverAddr: string, private storage: Map<string, ArrayBuffer>) {
    this.ws = new WebSocket(serverAddr);

    this.ws.onmessage = (msg: MessageEvent<string>) => {
      const data: WSMessage = JSON.parse(msg.data);
      console.log('Received ', data);
      this.wsMessageHandler(data);
    }
  }

  private async wsMessageHandler(msg: WSMessage): Promise<void> {
    switch (msg.kind) {
      case 'connect': {
        this.isConnected = true;
        this.clientId = msg.clientId;
        console.warn('Connectado com id ', this.clientId);
        break;
      };
      case 'user-connected': {
        await this.connectToUser(msg.clientId);
        break;
      };
      case 'offer': {
        await this.handleOffer(msg);
        break;
      };
      case 'answer': {
        await this.handleAnswer(msg);
        break;
      };
      case 'new-ice-candidate': {
        await this.handleIceCadidate(msg);
        break;
      };
      default: {
        console.error('WSHandler: msg não esperada', msg);
      }
    }
  }

  private sendWsMsg = (msg: object) => this.ws.send(JSON.stringify(msg));


  private async connectToUser(id: string): Promise<void> {
    console.debug('RTCPeerConnection created')

    const rtcConn = new RTCPeerConnection(CONFIGURATION);
    const dataCh = rtcConn.createDataChannel('msgChannel');
    // dataCh.binaryType = 'arraybuffer';

    if (dataCh) {
      const onMsg = (fromEvent(dataCh, 'message') as Observable<MessageEvent<any>>)
                      .pipe(map(me => [id, JSON.parse(me.data)] as [string, P2PMessage]));
      onMsg.subscribe(m => this.handleWantMsg(m));
      this.p2pMessages = merge(this.p2pMessages, onMsg);
      dataCh.onopen = (ev: Event) => console.error('open', ev);
      dataCh.onerror = (ev: Event) => console.error('DATACHANNEL ERROR', ev);
      dataCh.onclose = (ev: Event) => console.log('close', ev);
    } else {
      console.error('erro ao criar data channel')
    }

    rtcConn.onnegotiationneeded = async () => {
      rtcConn.onicecandidate = ev => {
        console.debug('new candidate ', ev);
        if (ev.candidate) {
          this.sendWsMsg({kind: 'new-ice-candidate',
                          candidate: ev.candidate!,
                          toId: id,
                          fromId: this.clientId})
        }
      };

      const offer = await rtcConn.createOffer();
      await rtcConn.setLocalDescription(offer);
      console.debug('WEBRTC: offer created')
      this.sendWsMsg({kind: 'offer',
                      offer: offer,
                      to: id,
                      fromId: this.clientId})
      this.peers.set(id, [rtcConn, dataCh]);

    }

  }

  private async handleOffer(msg: WSOfferMessage): Promise<void> {
    const rtcConn = new RTCPeerConnection(CONFIGURATION);
    this.peers.set(msg.fromId, [rtcConn, null]);
    await rtcConn.setRemoteDescription(new RTCSessionDescription(msg.offer));
    const answer = await rtcConn.createAnswer();
    await rtcConn.setLocalDescription(answer);

    rtcConn.onconnectionstatechange = ev => console.error('Connection changed!', ev)

    rtcConn.ondatachannel = (event) => {
      console.debug('WEBRTC: datachannel estabelecido');
      const recvCh = event.channel;
      const onMsg = (fromEvent(recvCh, 'message') as Observable<MessageEvent<any>>)
                      .pipe(map(me => [msg.fromId, JSON.parse(me.data)] as [string, P2PMessage]));

      onMsg.subscribe(m => this.handleWantMsg(m));
      this.p2pMessages = merge(this.p2pMessages, onMsg);
      recvCh.onopen    = (ev: Event) => console.error('open', ev);
      recvCh.onerror = (ev: Event) => console.error('DATACHANNEL ERROR', ev);
      recvCh.onclose   = (ev: Event) => console.log('close', ev);
      this.peers.set(msg.fromId, [rtcConn, recvCh]);
    };

    this.sendWsMsg({kind: 'answer',
                    answer: answer,
                    fromId: this.clientId,
                    toId: msg.fromId});
  }

  private async handleAnswer(msg: WSAnswerMessage): Promise<void> {
    if (msg.toId === this.clientId) {
      const rtcConn = this.peers.get(msg.fromId)![0];
      await rtcConn.setRemoteDescription(new RTCSessionDescription(msg.answer));
      const data = this.peers.get(msg.fromId)![1];
    }
  }

  private async handleIceCadidate(msg: WSICECandidate): Promise<void> {
    if (msg.toId === this.clientId) {
      const rtcConn = this.peers.get(msg.fromId)![0];
      rtcConn.addIceCandidate(msg.candidate);
    }
  }


  private broadcastMsg(msg: any): void {
    for (const conChTuple of this.peers.values()) {
      const dataCh = conChTuple[1];
      const conn = conChTuple[0];
      if (conn.connectionState === 'connected'
        && dataCh && dataCh.readyState === 'open') {
        dataCh.send(msg);
      }
    }
  }

  private sendToPeer(peerId: string, msg: any): void {
    const tup = this.peers.get(peerId);
    if (tup && tup[1]) {
      const dataCh = tup[1];
      dataCh.send(msg);
    }
  }

  storeResource(resource: string, data: ArrayBuffer): void {
    this.storage.set(resource, data);
  }

  handleWantMsg([peerId, msg]: [string, P2PMessage]): void {
    if (msg.kind === 'WANT') {
      const data = this.storage.get(msg.resource);
      console.log('storage ', this.storage);
      if (data) {
        const m = {kind: 'PROVIDE',
                   resource: msg.resource,
                   data: arrayBufferToBase64(data)
                  };
        this.sendToPeer(peerId, JSON.stringify(m));
      }
    }
  }

  wantResource(res: string): Observable<ArrayBuffer> {
    this.broadcastMsg(JSON.stringify({kind: 'WANT', resource: res}));
    console.error('enviadno want ', res)
    return this.p2pMessages.pipe(filter(([_, m]) => m.kind === 'PROVIDE' && m.resource === res),
                                 take(1),
                                 map(m => {
                                   const res = m[1] as P2PProvideMessage;
                                   return Uint8Array.from(atob(res.data), c => c.charCodeAt(0));
                                 }));
  }
}
