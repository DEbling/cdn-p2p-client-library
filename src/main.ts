import {MediaSourceFactory} from "./media-source-factory";

const VIDEO_URL = 'http://localhost:8080/testvideo';

const video: HTMLVideoElement = document.querySelector('video')!;

const mediaSourceFactory = new MediaSourceFactory();

video.src = mediaSourceFactory.createMediaSourceUrl(VIDEO_URL);
video.autoplay = true;
