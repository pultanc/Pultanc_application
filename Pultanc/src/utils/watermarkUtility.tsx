import React from 'react';

export interface VideoWatermarkOverlayProps {
  creatorHandle?: string;
  creatorName?: string;
  className?: string;
  position?: 'bottom-right' | 'top-right' | 'top-left' | 'bottom-left' | 'floating';
  showPoweredBy?: boolean;
}

/**
 * Clean, non-intrusive watermarking overlay utility for video components
 * Displays creator username / handle persistently during video playback.
 */
export const VideoWatermarkOverlay: React.FC<VideoWatermarkOverlayProps> = ({
  creatorHandle,
  creatorName,
  className = '',
  position = 'bottom-right',
  showPoweredBy = true
}) => {
  const raw = (creatorHandle || creatorName || 'creator').trim();
  const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;

  const positionClasses = {
    'bottom-right': 'bottom-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'top-right': 'top-3 right-3',
    'top-left': 'top-3 left-3',
    'floating': 'bottom-6 right-4'
  }[position];

  return (
    <div
      className={`absolute ${positionClasses} pointer-events-none select-none z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white shadow-md transition-opacity duration-300 ${className}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      <span className="font-mono text-[10px] sm:text-xs font-bold text-white tracking-wide drop-shadow-sm">
        {cleanHandle}
      </span>
      {showPoweredBy && (
        <span className="text-[9px] sm:text-[10px] font-medium text-red-400 pl-1 border-l border-white/20">
          pultanc
        </span>
      )}
    </div>
  );
};

export interface CanvasWatermarkOptions {
  creatorHandle?: string;
  creatorName?: string;
  showPoweredBy?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  scale?: number;
}

/**
 * Canvas frame watermarking utility that burns the creator's handle/username
 * directly onto video frame export canvases so it persists across downloaded/generated
 * clips and climers.
 */
export function drawCanvasWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: CanvasWatermarkOptions = {}
) {
  const {
    creatorHandle,
    creatorName,
    showPoweredBy = true,
    position = 'bottom-right',
    scale = 1
  } = options;

  const raw = (creatorHandle || creatorName || 'creator').trim();
  const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
  const s = Math.max(0.5, scale);

  ctx.save();
  const fontSize = Math.round(13 * s);
  ctx.font = `bold ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

  const handleWidth = ctx.measureText(cleanHandle).width;
  const brandText = showPoweredBy ? ' • pultanc' : '';
  const brandWidth = showPoweredBy ? ctx.measureText(brandText).width : 0;

  const dotSize = Math.round(5 * s);
  const padX = Math.round(12 * s);
  const padY = Math.round(7 * s);
  const badgeWidth = padX * 2 + dotSize + Math.round(6 * s) + handleWidth + brandWidth;
  const badgeHeight = fontSize + padY * 2;

  let x = width - badgeWidth - Math.round(16 * s);
  let y = height - badgeHeight - Math.round(16 * s);

  if (position === 'bottom-left') {
    x = Math.round(16 * s);
  } else if (position === 'top-right') {
    y = Math.round(16 * s);
  } else if (position === 'top-left') {
    x = Math.round(16 * s);
    y = Math.round(16 * s);
  }

  // Draw pill background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  const radius = Math.round(8 * s);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + badgeWidth, y, x + badgeWidth, y + badgeHeight, radius);
  ctx.arcTo(x + badgeWidth, y + badgeHeight, x, y + badgeHeight, radius);
  ctx.arcTo(x, y + badgeHeight, x, y, radius);
  ctx.arcTo(x, y, x + badgeWidth, y, radius);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  // Red accent dot
  const dotX = x + padX + dotSize / 2;
  const dotY = y + badgeHeight / 2;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Creator handle text
  const textX = dotX + dotSize / 2 + Math.round(6 * s);
  const textY = y + badgeHeight / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cleanHandle, textX, textY);

  // Powered by pultanc text
  if (showPoweredBy) {
    ctx.fillStyle = '#f87171';
    ctx.fillText(brandText, textX + handleWidth, textY);
  }

  ctx.restore();
}
