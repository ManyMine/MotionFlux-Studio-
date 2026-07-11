import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export function solveCubicBezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  // Binary search to find t for given x
  let tMin = 0;
  let tMax = 1;
  let t = 0.5;
  
  for (let i = 0; i < 12; i++) {
    const currentX = 3 * Math.pow(1 - t, 2) * t * x1 + 3 * (1 - t) * Math.pow(t, 2) * x2 + Math.pow(t, 3);
    if (Math.abs(currentX - x) < 0.001) {
      break;
    }
    if (currentX < x) {
      tMin = t;
    } else {
      tMax = t;
    }
    t = (tMin + tMax) / 2;
  }
  
  // Calculate y for the found t
  return 3 * Math.pow(1 - t, 2) * t * y1 + 3 * (1 - t) * Math.pow(t, 2) * y2 + Math.pow(t, 3);
}

export function getInterpolatedProperties(clip: any, currentTime: number) {
  const duration = clip.clipEndOffset - clip.clipStartOffset;
  
  // Default values
  const defaultVal = {
    scale: clip.scale ?? 1.0,
    rotation: clip.rotation || 0,
    rotationX: clip.rotationX || 0,
    rotationY: clip.rotationY || 0,
    posX: clip.posX || 0,
    posY: clip.posY || 0,
    opacity: clip.opacity ?? 1.0
  };

  if (duration <= 0) {
    return defaultVal;
  }

  const tClip = currentTime - clip.startTime;
  const speed = clip.animationSpeed !== undefined ? clip.animationSpeed : 1.0;
  const progressPercent = (tClip / duration) * 100 * speed;

  if (!clip.keyframes || clip.keyframes.length === 0) {
    return defaultVal;
  }

  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time);

  // If progress is before the first keyframe
  if (progressPercent <= kfs[0].time) {
    const first = kfs[0];
    return {
      scale: first.scale ?? defaultVal.scale,
      rotation: first.rotation ?? defaultVal.rotation,
      rotationX: (first as any).rotationX ?? defaultVal.rotationX,
      rotationY: (first as any).rotationY ?? defaultVal.rotationY,
      posX: first.posX ?? defaultVal.posX,
      posY: first.posY ?? defaultVal.posY,
      opacity: first.opacity ?? defaultVal.opacity
    };
  }

  // If progress is after the last keyframe
  if (progressPercent >= kfs[kfs.length - 1].time) {
    const last = kfs[kfs.length - 1];
    return {
      scale: last.scale ?? defaultVal.scale,
      rotation: last.rotation ?? defaultVal.rotation,
      rotationX: (last as any).rotationX ?? defaultVal.rotationX,
      rotationY: (last as any).rotationY ?? defaultVal.rotationY,
      posX: last.posX ?? defaultVal.posX,
      posY: last.posY ?? defaultVal.posY,
      opacity: last.opacity ?? defaultVal.opacity
    };
  }

  // Find the two keyframes to interpolate between
  let prev = kfs[0];
  let next = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (progressPercent >= kfs[i].time && progressPercent <= kfs[i + 1].time) {
      prev = kfs[i];
      next = kfs[i + 1];
      break;
    }
  }

  const range = next.time - prev.time;
  const rawProgress = range > 0 ? (progressPercent - prev.time) / range : 0;
  
  // Use keyframe-specific easing if available, otherwise clip easing
  const easingToUse = prev.easing || clip.easing;
  
  const kfProgress = getEasingProgress(rawProgress, easingToUse, clip.bezierPoints);

  const prevScale = prev.scale ?? defaultVal.scale;
  const nextScale = next.scale ?? defaultVal.scale;
  const prevRotation = prev.rotation ?? defaultVal.rotation;
  const nextRotation = next.rotation ?? defaultVal.rotation;
  const prevRotationX = (prev as any).rotationX ?? defaultVal.rotationX;
  const nextRotationX = (next as any).rotationX ?? defaultVal.rotationX;
  const prevRotationY = (prev as any).rotationY ?? defaultVal.rotationY;
  const nextRotationY = (next as any).rotationY ?? defaultVal.rotationY;
  const prevX = prev.posX ?? defaultVal.posX;
  const nextX = next.posX ?? defaultVal.posX;
  const prevY = prev.posY ?? defaultVal.posY;
  const nextY = next.posY ?? defaultVal.posY;
  const prevOpacity = prev.opacity ?? defaultVal.opacity;
  const nextOpacity = next.opacity ?? defaultVal.opacity;

  return {
    scale: prevScale + (nextScale - prevScale) * kfProgress,
    rotation: prevRotation + (nextRotation - prevRotation) * kfProgress,
    rotationX: prevRotationX + (nextRotationX - prevRotationX) * kfProgress,
    rotationY: prevRotationY + (nextRotationY - prevRotationY) * kfProgress,
    posX: prevX + (nextX - prevX) * kfProgress,
    posY: prevY + (nextY - prevY) * kfProgress,
    opacity: prevOpacity + (nextOpacity - prevOpacity) * kfProgress
  };
}

export function getEasingProgress(progress: number, easing?: string, bezierPoints?: number[]): number {
  if (easing === 'ease-in') {
    return progress * progress;
  } else if (easing === 'ease-out') {
    return progress * (2 - progress);
  } else if (easing === 'ease-in-out') {
    return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
  } else if (easing === 'sine-in-out') {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  } else if (easing === 'ease-in-sine') {
    return 1 - Math.cos((progress * Math.PI) / 2);
  } else if (easing === 'ease-out-sine') {
    return Math.sin((progress * Math.PI) / 2);
  } else if (easing === 'ease-in-back') {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * progress * progress * progress - c1 * progress * progress;
  } else if (easing === 'ease-out-back') {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const p = progress - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  } else if (easing === 'ease-in-out-back') {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    const p = progress * 2;
    if (p < 1) {
      return (p * p * ((c2 + 1) * p - c2)) / 2;
    } else {
      const p2 = p - 2;
      return (p2 * p2 * ((c2 + 1) * p2 + c2) + 2) / 2;
    }
  } else if (easing === 'ease-in-out-cubic') {
    return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  } else if (easing === 'elastic') {
    if (progress === 0) return 0;
    if (progress === 1) return 1;
    return Math.sin(-13 * (Math.PI / 2) * (progress + 1)) * Math.pow(2, -10 * progress) + 1;
  } else if (easing === 'bounce') {
    const n1 = 7.5625, d1 = 2.75;
    let p = progress;
    if (p < 1 / d1) { return n1 * p * p; }
    else if (p < 2 / d1) { return n1 * (p -= 1.5 / d1) * p + 0.75; }
    else if (p < 2.5 / d1) { return n1 * (p -= 2.25 / d1) * p + 0.9375; }
    else { return n1 * (p -= 2.625 / d1) * p + 0.984375; }
  } else if (easing === 'bounce-twice') {
    return Math.abs(Math.sin(progress * Math.PI * 2.5)) * (1 - progress) + progress;
  } else if (easing === 'custom-bezier') {
    const pts = bezierPoints || [0.25, 0.1, 0.25, 1.0];
    return solveCubicBezier(progress, pts[0], pts[1], pts[2], pts[3]);
  }
  return progress;
}

export function setupTouchDragScroll(container: HTMLDivElement) {
  let isDragging = false;
  let startY = 0;
  let startX = 0;
  let initialScrollTop = 0;
  let initialScrollLeft = 0;
  let hasMoved = false;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
      return;
    }

    const touch = e.touches[0];
    isDragging = true;
    hasMoved = false;
    startY = touch.clientY;
    startX = touch.clientX;
    initialScrollTop = container.scrollTop;
    initialScrollLeft = container.scrollLeft;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - startY;
    const deltaX = touch.clientX - startX;
    
    if (Math.abs(deltaY) > 6 || Math.abs(deltaX) > 6) {
      hasMoved = true;
      container.scrollTop = initialScrollTop - deltaY;
      container.scrollLeft = initialScrollLeft - deltaX;
      
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    isDragging = false;
    if (hasMoved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  container.addEventListener('touchstart', handleTouchStart, { passive: false });
  container.addEventListener('touchmove', handleTouchMove, { passive: false });
  container.addEventListener('touchend', handleTouchEnd, { passive: false });

  return () => {
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchmove', handleTouchMove);
    container.removeEventListener('touchend', handleTouchEnd);
  };
}

export function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export function resolveFontFamily(fontValue?: string): string {
  if (!fontValue) return 'sans-serif';
  
  // Clean prefix if any
  const clean = fontValue.toLowerCase().replace('font-', '').trim();
  
  switch (clean) {
    case 'sans':
    case 'inter':
      return 'Inter';
    case 'mono':
    case 'jetbrains':
    case 'jetbrains mono':
      return 'JetBrains Mono';
    case 'bebas':
    case 'bebas neue':
      return 'Bebas Neue';
    case 'pacifico':
      return 'Pacifico';
    case 'oswald':
      return 'Oswald';
    case 'roboto':
      return 'Roboto';
    case 'open sans':
      return 'Open Sans';
    case 'lato':
      return 'Lato';
    case 'montserrat':
      return 'Montserrat';
    case 'playfair display':
      return 'Playfair Display';
    case 'merriweather':
      return 'Merriweather';
    case 'nunito':
      return 'Nunito';
    case 'raleway':
      return 'Raleway';
    case 'poppins':
      return 'Poppins';
    case 'ubuntu':
      return 'Ubuntu';
    case 'mukta':
      return 'Mukta';
    case 'lora':
      return 'Lora';
    case 'rubik':
      return 'Rubik';
    case 'noto sans':
      return 'Noto Sans';
    case 'work sans':
      return 'Work Sans';
    case 'fira sans':
      return 'Fira Sans';
    case 'quicksand':
      return 'Quicksand';
    case 'karla':
      return 'Karla';
    case 'inconsolata':
      return 'Inconsolata';
    case 'josefin sans':
      return 'Josefin Sans';
    case 'anton':
      return 'Anton';
    case 'cinzel':
      return 'Cinzel';
    case 'lobster':
      return 'Lobster';
    case 'creepster':
      return 'Creepster';
    default:
      // If it starts with UserFont-, return it as is
      if (fontValue.startsWith('UserFont-')) {
        return fontValue;
      }
      // Otherwise capitalize words as a sensible fallback for google fonts
      return fontValue.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
