import { parse } from "mpd-parser";
import { Connection } from "./connection";
import { MediaSourceFactory } from "./media-source-factory";
import { createMediaSourceUrl } from "./p2pmediasource";
import { WSMessage } from "./types";

const SERVER_ADDR = "ws://localhost:8080/ws"

const VIDEO_URL = 'http://localhost:8080/init.mp4';


const video: HTMLVideoElement = document.querySelector('video')!;

const mediaSourceFactory = new MediaSourceFactory(SERVER_ADDR);

video.src = mediaSourceFactory.createMediaSourceUrl(VIDEO_URL);
video.autoplay = true;
