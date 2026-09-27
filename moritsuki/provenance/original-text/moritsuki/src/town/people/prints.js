// 服のプリント（キャンバスに描く）: 夏海の前掛けの白抜きの屋号
import { canvasTex } from '../assets/build.js';

const MINCHO = '"Zen Old Mincho", "Yu Mincho", serif';

export function canvasPrint(kind) {
  if (kind === 'apron') {
    // 512 px = 0.3 m 四方（前掛けの y 0.9 〜 0.6、x -0.15 〜 0.15）
    return canvasTex('people-apron', 512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const ink = 'rgba(246,243,234,1)';
      // 丸に波の紋
      g.save();
      g.translate(w / 2, 118);
      g.strokeStyle = ink; g.lineWidth = 9;
      g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.clip();
      g.fillStyle = ink;
      for (let k = 0; k < 3; k++) {
        const y0 = -8 + k * 22;
        g.beginPath();
        g.moveTo(-70, 80);
        for (let x = -70; x <= 70; x += 3) g.lineTo(x, y0 - Math.max(0, Math.sin((x + k * 23) / 14)) * 16 * (1 - k * 0.2));
        g.lineTo(70, 80); g.closePath();
        g.globalAlpha = 1; g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.moveTo(-70, 80);
        for (let x = -70; x <= 70; x += 3) g.lineTo(x, y0 + 7 - Math.max(0, Math.sin((x + k * 23) / 14)) * 16 * (1 - k * 0.2));
        g.lineTo(70, 80); g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      g.restore();
      // 屋号
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 138px ${MINCHO}`;
      g.fillText('みなと', w / 2, 296);
      g.font = `700 34px ${MINCHO}`;
      g.fillText('定 食 処', w / 2, 400);
      // 染めのかすれ
      g.globalCompositeOperation = 'destination-out';
      let s = 7;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 1400; k++) { g.globalAlpha = 0.15 + r() * 0.35; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }, [`900 138px ${MINCHO}`, `700 34px ${MINCHO}`]);
  }
  throw new Error('unknown print ' + kind);
}
