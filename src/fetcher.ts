import { fromEvent, interval } from "rxjs";
import { debounceTime, throttle } from "rxjs/operators";

interface Fetcher {
  fetchResource(resource: string): Promise<ArrayBuffer>;
}


export class CDNFetcher implements Fetcher {
  constructor(private readonly cdnBaseUrl: string) { }

  async fetchResource(resourcePath: string): Promise<ArrayBuffer> {
    const r = await fetch(this.cdnBaseUrl + '/' + resourcePath, {method: 'GET'})
    return await r.arrayBuffer()
  }
}

const SEGMENT_COUNT = 245;

export class VideoLoader {

  private currentSegment: number = 0;
  private readonly cdnFetcher: Fetcher = new CDNFetcher('http://www.bok.net/dash/tears_of_steel/cleartext/video/6');
  private readonly segmentTemplate = 'seg-$Number$.m4f';
  private readonly initSegment = 'init.mp4';

  constructor(ms: MediaSource) {
    ms.onsourceopen = async () => {
      const sb = ms.addSourceBuffer('video/mp4; codecs="avc1.4d401f');

      // Fetch init segment
      this.fetchInit(sb);
    }
  }

  private async fetchInit(sb: SourceBuffer): Promise<void> {
    const b = await this.cdnFetcher.fetchResource(this.initSegment);
    sb.appendBuffer(new Uint8Array(b));
    // sb.onupdateend = () => this.fetchNextSegment(sb);
    fromEvent(sb, 'updateend')
      .pipe(debounceTime(700))
      .subscribe(ev => {
        this.fetchNextSegment(sb);
      });
  }

  private async fetchNextSegment(sb: SourceBuffer) {
    if (this.currentSegment < SEGMENT_COUNT) {
      const b = await this.cdnFetcher.fetchResource(this.segmentTemplate.replace('$Number$', (++this.currentSegment).toString()));
      sb.appendBuffer(new Uint8Array(b));

    }
  }
}
