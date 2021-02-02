const SEGMENT_NUMBER = 13;

async function fetchChunk(sb: SourceBuffer, url: string): Promise<void> {
  const r = await fetch(url, {method: 'GET'})
  const buffer = await  r.arrayBuffer()
  sb.appendBuffer(new Uint8Array(buffer));
}

function fetchVideoChunk(sb: SourceBuffer) {
  let i = 0;
  return () => {
    if (i < SEGMENT_NUMBER) {
      fetchChunk(sb, `http://localhost:3000/seg-${i}.m4s`)
      i++;
    }
  }
}

function onOpen(this: MediaSource): void {
  const sb = this.addSourceBuffer('video/mp4; codecs="avc1.4d401f');
  const nextSegmentFn = fetchVideoChunk(sb)
  sb.addEventListener('updateend', nextSegmentFn);
  nextSegmentFn();
  fetchChunk(sb, 'http://localhost:3000/init.mp4');
}


export function createMediaSourceUrl(): string {
  const ms = new MediaSource();
  ms.addEventListener('sourceopen', onOpen)
  return URL.createObjectURL(ms);
}
