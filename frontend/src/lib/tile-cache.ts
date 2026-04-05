export class TileCache {
  private readonly maxEntries: number;

  private readonly entries = new Map<string, Promise<HTMLImageElement>>();

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  load(src: string): Promise<HTMLImageElement> {
    const existing = this.entries.get(src);
    if (existing) {
      this.touch(src, existing);
      return existing;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => {
        this.entries.delete(src);
        reject(new Error(`Failed to load tile ${src}`));
      };
      image.src = src;
    });

    this.touch(src, promise);
    this.trim();
    return promise;
  }

  private touch(key: string, value: Promise<HTMLImageElement>): void {
    this.entries.delete(key);
    this.entries.set(key, value);
  }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }
}

export const timelineTileCache = new TileCache();
