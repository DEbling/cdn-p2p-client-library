// import { Connection } from "./connection";

// const SEGMENT_NUMBER = 13;


// export class MediaSourceFactory {
//   // private readonly conn: Connection;

//   constructor(private readonly signalingServerAddr: string) {
//     // this.conn = new Connection(this.signalingServerAddr);
//   }

//   public createMediaSourceUrl(videoUrl: string): string {
//     const ms = new MediaSource();

//     ms.onsourceopen = () => {
//       const sb = ms.addSourceBuffer('video/mp4; codecs="avc1.4d401f,mp4a.40.2');

//       const nextSegmentFn = this.makeNextSegmentFn(sb);
//       sb.onupdateend = nextSegmentFn;

//       // Fetch init segment
//       this.fetchChunk(sb, videoUrl);
//     }

//     return URL.createObjectURL(ms);
//   }

//    private async fetchChunk(sb: SourceBuffer, url: string): Promise<void> {
//     const r = await fetch(url, {method: 'GET'})
//     const buffer = await  r.arrayBuffer()
//     sb.appendBuffer(new Uint8Array(buffer));
//   }

//   private makeNextSegmentFn(sb: SourceBuffer) {
//     let i = 1;
//     return () => {
//       if (i < SEGMENT_NUMBER) {
//         this.fetchChunk(sb, `http://localhost:3000/seg-${i}.m4s`)
//         i++;
//       }
//     }
//   }

// }


import { Connection } from "./connection";
import { VideoLoader } from "./fetcher";

export class MediaSourceFactory {
  private readonly conn: Connection;

  constructor(private readonly signalingServerAddr: string) {
    this.conn = new Connection(this.signalingServerAddr);
  }

  public createMediaSourceUrl(videoUrl: string): string {
    const ms = new MediaSource();
    new VideoLoader(ms);
    return URL.createObjectURL(ms);
  }

}
