import {VideoLoader} from "./fetcher";

export class MediaSourceFactory {

  constructor() { }

  public createMediaSourceUrl(videoUrl: string): string {
    const ms = new MediaSource();
    new VideoLoader(ms, videoUrl);
    return URL.createObjectURL(ms);
  }

}
