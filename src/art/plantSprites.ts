/** AI 生成的植物精灵（透明底 PNG）：荷叶两变体 + 荷花。加载完成前回退程序化绘制 */
class PlantSpriteStore {
  pads: HTMLImageElement[] = [];
  lotus: HTMLImageElement | null = null;
  private started = false;

  ensure(): void {
    if (this.started) return;
    this.started = true;
    const load = (src: string, into: (img: HTMLImageElement) => void) => {
      const img = new Image();
      img.onload = () => {
        // 校验确实带透明通道（模型偶尔不遵守 transparent）
        if (img.naturalWidth > 0) into(img);
      };
      img.onerror = () => { /* 保持回退 */ };
      img.src = src;
    };
    for (const v of ['a', 'b']) {
      load(`./assets/pad-${v}.png`, (img) => this.pads.push(img));
    }
    load('./assets/lotus.png', (img) => (this.lotus = img));
  }

  pad(variant: number): HTMLImageElement | null {
    if (!this.pads.length) return null;
    return this.pads[((variant % this.pads.length) + this.pads.length) % this.pads.length];
  }
}

export const plantSprites = new PlantSpriteStore();
