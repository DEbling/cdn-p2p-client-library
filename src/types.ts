export interface WSSuccessMessage {
  kind: 'connect';
  clientId: string; // uuid
};

export interface WSOfferMessage {
  kind: 'offer';
  offer: RTCSessionDescriptionInit;
  fromId: string; // uuid
};

export interface WSAnswerMessage {
  kind: 'answer';
  answer: RTCSessionDescriptionInit;
  fromId: string; // uuid
  toId: string; // uuid
};

export interface WSUserConnectedMessage {
  kind: 'user-connected';
  clientId: string;
};

export interface WSErrorMessage {
  kind: 'error';
  message: string;
};

export interface WSICECandidate {
  kind: 'new-ice-candidate';
  candidate: RTCIceCandidate;
  toId: string;
  fromId: string;
}


export type WSMessage =
  WSSuccessMessage
  | WSOfferMessage
  | WSAnswerMessage
  | WSUserConnectedMessage
  | WSErrorMessage
  | WSICECandidate;
