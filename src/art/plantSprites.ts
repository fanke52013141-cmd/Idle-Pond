/** AI 生成的植物精灵（透明底 PNG）：荷叶两变体 + 荷花三态。加载完成前回退程序化绘制 */
class PlantSpriteStore {
  pads: HTMLImageElement[] = [];
  lotus: HTMLImageElement | null = null;      // 盛放
  lotusHalf: HTMLImageElement | null = null;  // 半开
  lotusBud: HTMLImageElement | null = null;   // 花苞
  minnows: HTMLImageElement[] = [];
  shrimp: HTMLImageElement | null = null;
  snails: HTMLImageElement[] = [];
  strider: HTMLImageElement | null = null;
  pellet: HTMLImageElement | null = null;
  droplet: HTMLImageElement | null = null;
  turtles: HTMLImageElement[] = [];
  private started = false;

  ensure(): void {
    if (this.started) return;
    this.started = true;
    const load = (src: string, into: (img: HTMLImageElement) => void) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0) into(img);
      };
      img.onerror = () => { /* 保持回退 */ };
      img.src = src;
    };
    for (const v of ['a', 'b']) load(`./assets/pad-${v}.png`, (img) => this.pads.push(img));
    load('./assets/lotus.png', (img) => (this.lotus = img));
    load('./assets/lotus-half.png', (img) => (this.lotusHalf = img));
    load('./assets/lotus-bud.png', (img) => (this.lotusBud = img));
    for (const v of ['a', 'b']) load(`./assets/minnow-${v}.png`, (img) => this.minnows.push(img));
    load('./assets/shrimp.png', (img) => (this.shrimp = img));
    for (const v of ['a', 'b']) load(`./assets/snail-${v}.png`, (img) => this.snails.push(img));
    load('./assets/strider.png', (img) => (this.strider = img));
    load('./assets/pellet.png', (img) => (this.pellet = img));
    load('./assets/droplet.png', (img) => (this.droplet = img));
    for (const v of ['a', 'b']) load(`./assets/turtle-${v}.png`, (img) => this.turtles.push(img));
  }

  turtle(variant: number): HTMLImageElement | null {
    if (!this.turtles.length) return null;
    return this.turtles[((variant % this.turtles.length) + this.turtles.length) % this.turtles.length];
  }

  pad(variant: number): HTMLImageElement | null {
    if (!this.pads.length) return null;
    return this.pads[((variant % this.pads.length) + this.pads.length) % this.pads.length];
  }

  minnow(variant: number): HTMLImageElement | null {
    if (!this.minnows.length) return null;
    return this.minnows[((variant % this.minnows.length) + this.minnows.length) % this.minnows.length];
  }

  snail(variant: number): HTMLImageElement | null {
    if (!this.snails.length) return null;
    return this.snails[((variant % this.snails.length) + this.snails.length) % this.snails.length];
  }
}

export const plantSprites = new PlantSpriteStore();
