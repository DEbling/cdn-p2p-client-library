import { WSAnswerMessage, WSICECandidate, WSMessage, WSOfferMessage } from "./types";
import { withTimeout } from "./utils";

const CONFIGURATION = {
  iceServers: [{ urls: "stun:stun.1.google.com:19302" }]
};

export class Connection {
  private readonly ws: WebSocket;
  isConnected = false;
  clientId?: string;
  private rtcConn?: RTCPeerConnection;
  private dataCh?: RTCDataChannel;

  private fetchedResource: ArrayBuffer | null = null;
  private resourceWanting: string | null = null;

  private readonly peers = new Map<string, [RTCPeerConnection, RTCDataChannel | null]>();

  private storage: ArrayBuffer[] = [];

  constructor(serverAddr: string) {
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
    dataCh.binaryType = 'arraybuffer';

    if (dataCh) {
      dataCh.onmessage = (ev: Event) => console.log('msg', ev);
      dataCh.onopen = (ev: Event) => console.error('open', ev);
      dataCh.onclose = (ev: Event) => console.log('close', ev);
    } else {
      console.error('erro ao criar data channel')
    }

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

  private async handleOffer(msg: WSOfferMessage): Promise<void> {
    const rtcConn = new RTCPeerConnection(CONFIGURATION);
    await rtcConn.setRemoteDescription(new RTCSessionDescription(msg.offer));
    const answer = await rtcConn.createAnswer();
    await rtcConn.setLocalDescription(answer);
    console.debug('WEBRTC: answer sended');
    rtcConn.onconnectionstatechange = ev => console.error('Connection changed!', ev)
    rtcConn.ondatachannel = (event) => {
      console.debug('WEBRTC: datachannel estabelecido');
      const recvCh = event.channel;
      recvCh.onmessage = (ev: Event) => console.log('msg', ev);
      recvCh.onopen = (ev: Event) => console.error('open', ev);
      recvCh.onclose = (ev: Event) => console.log('close', ev);
      recvCh.send('teste');
      this.peers.set(msg.fromId, [rtcConn, recvCh]);
    };

    this.peers.set(msg.fromId, [rtcConn, null]);

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


  private sendP2P(msg: any): void {
    this.dataCh!.send(msg);
  }

  storeResource(r: ArrayBuffer) {
    this.storage.push(r);
  }

  // fetchResource(res: string): Promise<ArrayBuffer> {
  //   // this.sendP2P(JSON.stringify({kind: 'Want', res: res}));
  //   // const p = new Promise((res, rej) => {
  //   //   this.ev.
  //   // })
  // }
}
