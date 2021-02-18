import {from, fromEvent, interval, Observable} from 'rxjs';
import {catchError, concatMap, debounceTime, map, mergeMap, tap, timeout} from 'rxjs/operators';
import {P2PMesh} from './p2p-mesh';

interface Fetcher {
  fetchResource(resource: string): Observable<ArrayBuffer>;
}


export class CDNFetcher implements Fetcher {
  constructor(private readonly cdnBaseUrl: string) { }

  fetchResource(resourcePath: string): Observable<ArrayBuffer> {
    return from(fetch(this.cdnBaseUrl + '/' + resourcePath, {method: 'GET'}))
      .pipe(mergeMap(r => r.arrayBuffer()),
            tap(() => console.info(`fetched ${resourcePath} from CDN`)));
  }
}

export class P2PFetcher implements Fetcher {
  private readonly p2p: P2PMesh;

  constructor(private readonly signalingServerAddr: string, cache: Map<string, ArrayBuffer>) {
    this.p2p = new P2PMesh(signalingServerAddr, cache);
  }

  fetchResource(resourcePath: string): Observable<ArrayBuffer> {
    return this.p2p.wantResource(resourcePath)
      .pipe(tap(() => console.info(`fetched ${resourcePath} from P2P!!!!!!!!!`)));
  }

  get peerId(): string {
    return this.p2p.clientId!;
  }
}

const SEGMENT_COUNT = 245;

export class VideoLoader {

  private readonly segmentCache = new Map<string, ArrayBuffer>();
  private currentSegment: number = 0;
  private readonly cdnFetcher: Fetcher = new CDNFetcher(this.videourl);
  private readonly p2pFetcher: P2PFetcher = new P2PFetcher('ws://localhost:8080/ws', this.segmentCache);
  private readonly segmentTemplate = 'seg-$Number$.m4f';
  private readonly initSegment = 'init.mp4';
  private fetching = false;

  constructor(ms: MediaSource, private readonly videourl: string) {
    ms.onsourceopen = async () => {
      const sb = ms.addSourceBuffer('video/mp4; codecs="avc1.4d401f');

      // Fetch init segment
      this.fetchInit(sb);
    }
  }

  private fetchInit(sb: SourceBuffer): void {
    this.cdnFetcher.fetchResource(this.initSegment)
      .subscribe(b => {
        sb.appendBuffer(new Uint8Array(b));
        // sb.onupdateend = () => this.fetchNextSegment(sb);
        fromEvent(sb, 'updateend')
          .pipe(concatMap(() => interval(1500)), debounceTime(700))
          .subscribe(() => {
            this.fetchNextSegment(sb);
          });
      })
  }

  private fetchNextSegment(sb: SourceBuffer) {
    if (this.currentSegment < SEGMENT_COUNT
       && !this.fetching) {
      this.fetching = true;

      const segment = this.segmentTemplate.replace('$Number$', (++this.currentSegment).toString());
      console.log('fecthing ', segment);
      const start = new Date().toISOString();
      this.p2pFetcher.fetchResource(segment)
        .pipe(map(r => ['P2P', r] as [string, ArrayBuffer]), timeout(2000),
              catchError(err =>
                this.cdnFetcher.fetchResource(segment).pipe(map(r => ['CDN', r] as [string, ArrayBuffer]))
              ))
        .subscribe(([method, b]) => {
          const endTime = new Date().toISOString();
          this.fetching = false;
          sb.appendBuffer(new Uint8Array(b));
          this.segmentCache.set(segment, b);
          VideoLoader.sendMetric(this.p2pFetcher.peerId, method, start, endTime, segment)
        }, err => {
          console.error("erro", err)
          this.fetching = false;
        })
    }
  }

  private static sendMetric(peerId: string, method: string, startTime: string, endTime: string, segment: string) {
    const body = {peerId, method, startTime, endTime, segment};
    fetch('http://localhost:8080/metrics',
      {method: 'post', body: JSON.stringify(body)}).then();
  }
}
