/** 小生物的即时绘制函数：体积小、形态简单，直接矢量画，不做贴图缓存 */

export function drawMinnow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, panicK: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const L = size * 3.2, W = size * 1.1;
  // 尾摆
  const wag = Math.sin(performance.now() * 0.02 + x) * 0.35;
  ctx.rotate(wag * 0.2);
  const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
  const bright = 200 + Math.round(panicK * 40);
  g.addColorStop(0, `rgba(160,186,186,0.8)`);
  g.addColorStop(0.5, `rgba(${bright},${bright + 8},${bright},0.92)`);
  g.addColorStop(1, `rgba(198,214,210,0.9)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, L / 2, W, 0, 0, Math.PI * 2);
  ctx.fill();
  // 尾鳍
  ctx.beginPath();
  ctx.moveTo(-L / 2 + 1, 0);
  ctx.lineTo(-L / 2 - W * 1.5, -W * 0.9);
  ctx.lineTo(-L / 2 - W * 1.5, W * 0.9);
  ctx.closePath();
  ctx.fillStyle = 'rgba(178,198,194,0.72)';
  ctx.fill();
  // 眼
  ctx.fillStyle = 'rgba(20,32,30,0.85)';
  ctx.beginPath();
  ctx.arc(L * 0.32, 0, Math.max(0.7, size * 0.16), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSnail(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, s: number, variant: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // 触角探头
  ctx.strokeStyle = 'rgba(96,118,92,0.8)';
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -s * 0.25); ctx.lineTo(s * 1.05, -s * 0.35);
  ctx.moveTo(s * 0.5, s * 0.25); ctx.lineTo(s * 1.05, s * 0.35);
  ctx.stroke();
  // 身体
  ctx.fillStyle = 'rgba(110,132,100,0.85)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.95, s * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // 螺壳（螺旋）
  const shell = ['#8a6f4e', '#6f7a52', '#7a5f6e'][variant % 3];
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(-s * 0.1, 0, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(52,44,32,0.55)';
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.arc(-s * 0.1, 0, s * 0.32, 0.4, 4.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-s * 0.1, 0, s * 0.16, 2.4, 6.6);
  ctx.stroke();
  ctx.restore();
}

export function drawShrimp(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = 'rgba(200,222,214,0.5)';
  ctx.fillStyle = 'rgba(196,220,208,0.42)';
  ctx.lineWidth = s * 0.14;
  // 分节的半透明身体（弯月形）
  ctx.beginPath();
  ctx.moveTo(s * 0.9, 0);
  ctx.quadraticCurveTo(s * 0.3, -s * 0.55, -s * 0.5, -s * 0.15);
  ctx.quadraticCurveTo(-s * 0.85, 0.05, -s * 0.95, 0.3);
  ctx.stroke();
  // 步足
  for (let i = 0; i < 4; i++) {
    const px = s * (0.35 - i * 0.28);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px - s * 0.1, s * 0.32);
    ctx.stroke();
  }
  // 长须
  ctx.beginPath();
  ctx.moveTo(s * 0.85, -s * 0.06); ctx.lineTo(s * 1.6, -s * 0.4);
  ctx.moveTo(s * 0.85, s * 0.06); ctx.lineTo(s * 1.55, s * 0.28);
  ctx.stroke();
  // 尾扇
  ctx.fillStyle = 'rgba(210,230,220,0.4)';
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, s * 0.28);
  ctx.lineTo(-s * 1.25, s * 0.18);
  ctx.lineTo(-s * 1.05, s * 0.5);
  ctx.closePath();
  ctx.fill();
  // 眼
  ctx.fillStyle = 'rgba(24,32,28,0.8)';
  ctx.beginPath();
  ctx.arc(s * 0.72, -s * 0.08, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = 'rgba(226,244,240,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,252,250,0.6)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

export function drawStrider(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  // 四条撑水的长腿 + 中足
  ctx.strokeStyle = 'rgba(40,54,50,0.72)';
  ctx.lineWidth = Math.max(0.8, s * 0.09);
  const leg = (dx: number, spread: number) => {
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx + s * 0.9, s * spread);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx + s * 0.9, -s * spread);
    ctx.stroke();
  };
  leg(-s * 0.5, 1.15);
  leg(0, 1.35);
  leg(s * 0.35, 0.95);
  // 身体与头
  ctx.strokeStyle = 'rgba(48,62,56,0.9)';
  ctx.lineWidth = s * 0.22;
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, 0);
  ctx.lineTo(s * 0.55, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(44,58,52,0.9)';
  ctx.beginPath();
  ctx.arc(s * 0.68, 0, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // 水面压痕
  ctx.strokeStyle = 'rgba(244,250,240,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 1.4, s * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
