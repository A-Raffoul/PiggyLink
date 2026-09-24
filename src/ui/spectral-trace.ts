// Adapted from claude-frontend's mockup/demo.html: one curve can be wrapped
// into an orb or unrolled into a frequency trace.
export function drawSpectralTrace(
  context: CanvasRenderingContext2D,
  levels: Float32Array,
  width: number,
  height: number,
  morph: number,
): void {
  const size = Math.min(width, height);
  const baseline = height - 5;
  const path = new Path2D();
  for (let index = 0; index < levels.length; index++) {
    const fraction = index / (levels.length - 1);
    const value = levels[index]!;
    const angle = fraction * Math.PI * 2 - Math.PI / 2;
    const radius = size * (0.27 + value * 0.2);
    const roundX = width / 2 + Math.cos(angle) * radius;
    const roundY = height / 2 + Math.sin(angle) * radius;
    const flatX = fraction * width;
    const flatY = baseline - value * (height - 15);
    const x = roundX + (flatX - roundX) * morph;
    const y = roundY + (flatY - roundY) * morph;
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  if (morph === 0) path.closePath();
  context.save();
  // CSS supplies the crisp trace color, including the browser's forced colors.
  context.strokeStyle = getComputedStyle(context.canvas).color;
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowBlur = 0;
  context.stroke(path);
  context.restore();
}
