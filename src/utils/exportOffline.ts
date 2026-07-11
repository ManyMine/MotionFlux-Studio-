import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { MediaItem, TimelineClip } from '../types';
import { getInterpolatedProperties, makeDistortionCurve, solveCubicBezier, resolveFontFamily, getEasingProgress } from '../utils';

// Helper to draw shape on canvas
const drawShapeOnCanvas = (ctx: CanvasRenderingContext2D, clip: TimelineClip, canvasWidth: number, canvasHeight: number) => {
  ctx.save();
  const w = clip.scale ? clip.scale * canvasWidth * 0.2 : canvasWidth * 0.2;
  const h = w;
  ctx.fillStyle = clip.shapeColor || '#ffffff';
  ctx.strokeStyle = clip.shapeBorderColor || 'transparent';
  ctx.lineWidth = clip.shapeBorderWidth || 0;

  ctx.beginPath();
  if (clip.shapeType === 'circle') {
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  } else if (clip.shapeType === 'square') {
    ctx.rect(-w / 2, -h / 2, w, h);
  } else if (clip.shapeType === 'triangle') {
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
  } else if (clip.shapeType === 'star-5') {
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * w / 2, -Math.sin((18 + i * 72) / 180 * Math.PI) * h / 2);
      ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * w / 4, -Math.sin((54 + i * 72) / 180 * Math.PI) * h / 4);
    }
    ctx.closePath();
  } else if (clip.shapeType === 'star-4') {
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(Math.cos((i * 90) / 180 * Math.PI) * w / 2, -Math.sin((i * 90) / 180 * Math.PI) * h / 2);
      ctx.lineTo(Math.cos((45 + i * 90) / 180 * Math.PI) * w / 4, -Math.sin((45 + i * 90) / 180 * Math.PI) * h / 4);
    }
    ctx.closePath();
  } else if (clip.shapeType === 'oval-custom') {
    ctx.ellipse(0, 0, w / 2, h / 3, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  if (clip.shapeBorderWidth && clip.shapeBorderWidth > 0) ctx.stroke();
  ctx.restore();
};

const seekVideo = (video: HTMLVideoElement, time: number) => {
  return new Promise<void>(resolve => {
    if (Math.abs(video.currentTime - time) < 0.05) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
};

function getFontFamilyFromUrl(url: string, fallback = 'sans-serif'): string {
  try {
    const parts = url.split('family=');
    if (parts.length > 1) {
      const familyPart = parts[1].split('&')[0].split(':')[0];
      return decodeURIComponent(familyPart).replace(/\+/g, ' ');
    }
  } catch (e) {
    console.error(e);
  }
  return fallback;
}

export const exportVideoOffline = async (
  clips: TimelineClip[],
  settings: { fps: number; aspectRatio: string; quality: string; globalAnimationSpeed?: number },
  width: number,
  height: number,
  onProgress: (p: number) => void,
  isCancelled: () => boolean,
  backgroundColor: string = '#000000',
  isTransparent: boolean = false
) => {
  const clipsEndTime = clips.length > 0
    ? Math.max(...clips.map(c => c.startTime + (c.clipEndOffset - c.clipStartOffset)))
    : 5;

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width / 2) * 2;
  canvas.height = Math.floor(height / 2) * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: isTransparent })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Preload media
  const preloaded: { [id: string]: HTMLImageElement | HTMLVideoElement | HTMLAudioElement } = {};
  const dimsCache: { [id: string]: { w: number; h: number } } = {};
  const loadPromises = clips.map(clip => {
    return new Promise<void>((resolve) => {
      if (clip.type === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { preloaded[clip.id] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = clip.dataUrl;
      } else if (clip.type === 'video') {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = clip.dataUrl;
        video.playsInline = true;
        video.muted = true;
        video.onloadeddata = () => { preloaded[clip.id] = video; resolve(); };
        video.onerror = () => resolve();
        video.load();
      } else {
        resolve();
      }
    });
  });
  await Promise.all(loadPromises);

  // 2. Render Audio Offline
  let renderedAudioBuffer: AudioBuffer | null = null;
  const OfflineAudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (OfflineAudioContextClass) {
    try {
      const offlineCtx = new OfflineAudioContextClass(2, Math.ceil(clipsEndTime * 44100) || 44100, 44100);
      const audioBuffers: Record<string, AudioBuffer> = {};
      
      await Promise.all(clips.map(async clip => {
        if (clip.type === 'audio' || clip.type === 'video') {
          try {
            const res = await fetch(clip.dataUrl);
            const buf = await res.arrayBuffer();
            audioBuffers[clip.id] = await offlineCtx.decodeAudioData(buf);
          } catch (e) { console.error(e); }
        }
      }));

      for (const clip of clips) {
        if ((clip.type === 'audio' || clip.type === 'video') && audioBuffers[clip.id]) {
          const src = offlineCtx.createBufferSource();
          src.buffer = audioBuffers[clip.id];
          
          const semitones = clip.audioPitch || 0;
          src.playbackRate.value = Math.pow(2, semitones / 12);
          
          const gain = offlineCtx.createGain();
          const baseVolume = clip.audioVolume !== undefined ? clip.audioVolume / 100 : 1.0;
          
          const startT = clip.startTime;
          const endT = clip.startTime + (clip.clipEndOffset - clip.clipStartOffset);
          
          gain.gain.setValueAtTime(baseVolume, 0); // fallback

          if (clip.audioFadeIn && clip.audioFadeIn > 0) {
            gain.gain.setValueAtTime(0, startT);
            gain.gain.linearRampToValueAtTime(baseVolume, startT + clip.audioFadeIn);
          } else {
            gain.gain.setValueAtTime(baseVolume, startT);
          }
          
          if (clip.audioFadeOut && clip.audioFadeOut > 0) {
            gain.gain.setValueAtTime(baseVolume, endT - clip.audioFadeOut);
            gain.gain.linearRampToValueAtTime(0, endT);
          }

          const bass = offlineCtx.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 200; bass.gain.value = clip.audioBass || 0;
          const treble = offlineCtx.createBiquadFilter(); treble.type = 'highshelf'; treble.frequency.value = 3000; treble.gain.value = clip.audioTreble || 0;
          const lpFreq = clip.audioLowpass !== undefined ? 200 + (clip.audioLowpass / 100) * 19800 : 20000;
          const lowpass = offlineCtx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = lpFreq;

          const distortion = offlineCtx.createWaveShaper();
          if (clip.audioDistortion) distortion.curve = makeDistortionCurve(clip.audioDistortion);
          distortion.oversample = '4x';

          src.connect(bass); bass.connect(treble); treble.connect(lowpass); lowpass.connect(distortion); distortion.connect(gain); gain.connect(offlineCtx.destination);
          
          src.start(startT, clip.clipStartOffset);
          src.stop(endT);
        }
      }
      renderedAudioBuffer = await offlineCtx.startRendering();
    } catch (e) {
      console.error("Audio offline render failed", e);
    }
  }

  // 3. Muxer Setup
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: canvas.width,
      height: canvas.height
    },
    audio: renderedAudioBuffer ? {
      codec: 'aac',
      sampleRate: 44100,
      numberOfChannels: 2
    } : undefined,
    fastStart: 'in-memory'
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => console.error("VideoEncoder error", e)
  });
  videoEncoder.configure({
    codec: 'avc1.420034',
    width: canvas.width,
    height: canvas.height,
    bitrate: 5_000_000,
    framerate: settings.fps
  });

  let audioEncoder: AudioEncoder | null = null;
  if (renderedAudioBuffer) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: e => console.error("AudioEncoder error", e)
    });
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitrate: 128_000
    });

    const sampleRate = renderedAudioBuffer.sampleRate;
    const length = renderedAudioBuffer.length;
    for (let i = 0; i < length; i += sampleRate) {
      const frames = Math.min(sampleRate, length - i);
      const planar = new Float32Array(frames * 2);
      planar.set(renderedAudioBuffer.getChannelData(0).subarray(i, i + frames), 0);
      if (renderedAudioBuffer.numberOfChannels > 1) {
        planar.set(renderedAudioBuffer.getChannelData(1).subarray(i, i + frames), frames);
      } else {
        planar.set(renderedAudioBuffer.getChannelData(0).subarray(i, i + frames), frames); // mono to stereo
      }
      const ad = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: (i / sampleRate) * 1e6,
        data: planar
      });
      audioEncoder.encode(ad);
      ad.close();
    }
  }

  // 4. Render Video Frames
  const totalFrames = Math.ceil(clipsEndTime * settings.fps);
  for (let f = 0; f < totalFrames; f++) {
    if (isCancelled()) {
      muxer.finalize();
      return;
    }
    const t = f / settings.fps;
    
    // Seek videos
    await Promise.all(clips.map(async clip => {
      if (clip.type === 'video') {
        const el = preloaded[clip.id] as HTMLVideoElement;
        if (el && t >= clip.startTime && t < clip.startTime + (clip.clipEndOffset - clip.clipStartOffset)) {
          await seekVideo(el, t - clip.startTime + clip.clipStartOffset);
        }
      }
    }));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    if (!isTransparent) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Save global state for camera transforms
    ctx.save();

    const exportScaleFactor = canvas.height / 720;

    const cameraClip = clips.find(c => c.type === 'camera' && t >= c.startTime && t < (c.startTime + (c.clipEndOffset - c.clipStartOffset)));
    if (cameraClip) {
      const camInterpolated = getInterpolatedProperties(cameraClip, t);
      const camScale = camInterpolated.scale ?? 1.0;
      const camPosX = camInterpolated.posX ?? 0;
      const camPosY = camInterpolated.posY ?? 0;
      const camRotation = camInterpolated.rotation ?? 0;
      const camRotationX = camInterpolated.rotationX ?? 0;
      const camRotationY = camInterpolated.rotationY ?? 0;

      // Unscaled camera translate to match CSS transform hierarchy order exactly
      ctx.translate(canvas.width / 2 - camPosX * exportScaleFactor, canvas.height / 2 - camPosY * exportScaleFactor);
      ctx.scale(camScale, camScale);
      ctx.rotate(-camRotation * Math.PI / 180);

      // Support 3D tilts via 2D scaling as an excellent approximation
      if (camRotationX !== 0) {
        const radX = camRotationX * Math.PI / 180;
        ctx.scale(1, Math.cos(radX));
      }
      if (camRotationY !== 0) {
        const radY = camRotationY * Math.PI / 180;
        ctx.scale(Math.cos(radY), 1);
      }

      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    const activeVisuals = clips
      .filter(c => (c.type === 'image' || c.type === 'video' || c.type === 'shape') && t >= c.startTime && t < (c.startTime + (c.clipEndOffset - c.clipStartOffset)))
      .sort((a, b) => {
        const orderA = a.trackId === 'v2' ? 2 : 1;
        const orderB = b.trackId === 'v2' ? 2 : 1;
        if (orderA !== orderB) return orderA - orderB;
        return a.startTime - b.startTime;
      });

    for (const clip of activeVisuals) {
      const clipDuration = clip.clipEndOffset - clip.clipStartOffset;
      const clipEndTime = clip.startTime + clipDuration;
      const progress = Math.max(0, Math.min(1, ((t - clip.startTime) / clipDuration) * (clip.animationSpeed || 1)));

      const easeProgress = getEasingProgress(progress, clip.easing, clip.bezierPoints);

      const interpolated = getInterpolatedProperties(clip, t);
      let posX = interpolated.posX || 0;
      let posY = interpolated.posY || 0;
      let scale = interpolated.scale || 1;
      let rotation = interpolated.rotation || 0;
      let opacity = interpolated.opacity ?? 1.0;

      // 15 ANIMATIONS MATH (Visuals)
      if (clip.animationType === 'pan-right') {
          posX += easeProgress * 200;
      } else if (clip.animationType === 'pan-left') {
          posX -= easeProgress * 200;
      } else if (clip.animationType === 'pan-up') {
          posY -= easeProgress * 200;
      } else if (clip.animationType === 'pan-down') {
          posY += easeProgress * 200;
      } else if (clip.animationType === 'zoom-in') {
          scale *= 1 + (easeProgress * 0.8);
      } else if (clip.animationType === 'zoom-out') {
          scale *= Math.max(0.1, 1 - easeProgress * 0.6);
      } else if (clip.animationType === 'spin') {
          rotation += easeProgress * 360;
      } else if (clip.animationType === 'wobble') {
          rotation += Math.sin(easeProgress * Math.PI * 4) * 15;
      } else if (clip.animationType === 'heartbeat') {
          scale *= 1 + Math.abs(Math.sin(easeProgress * Math.PI * 3)) * 0.15;
      } else if (clip.animationType === 'zoom-rotate') {
          scale *= 1 + (easeProgress * 0.5);
          rotation += easeProgress * 180;
      } else if (clip.animationType === 'slide-up') {
          posY += (1 - easeProgress) * 400;
      } else if (clip.animationType === 'slide-down') {
          posY -= (1 - easeProgress) * 400;
      } else if (clip.animationType === 'fade-in') {
          opacity = easeProgress;
      } else if (clip.animationType === 'fade-out') {
          opacity = 1 - easeProgress;
      } else if (clip.animationType === 'swing') {
          rotation += Math.sin(easeProgress * Math.PI * 3) * 20;
      } else if (clip.animationType === 'flash') {
          opacity = 0.5 + Math.sin(easeProgress * Math.PI * 6) * 0.5;
      } else if (clip.animationType === 'pulse-rapid') {
          scale *= 1 + Math.abs(Math.sin(easeProgress * Math.PI * 6)) * 0.2;
      } else if (clip.animationType === 'shake-intense') {
          const f = easeProgress * Math.PI * 16;
          posX += Math.sin(f) * 15;
          posY += Math.cos(f * 1.5) * 15;
      } else if (clip.animationType === 'rotate-flip') {
          scale = scale * Math.cos(easeProgress * Math.PI * 2);
      } else if (clip.animationType === 'zoom-shake') {
          scale *= 1 + (easeProgress * 0.4);
          const f = easeProgress * Math.PI * 12;
          posX += Math.sin(f) * 8;
          posY += Math.cos(f * 1.2) * 8;
      } else if (clip.animationType === 'slide-fade-down') {
          posY += (1 - easeProgress) * -200;
          opacity = easeProgress;
      } else if (clip.animationType === 'zoom-in-bounce') {
          const p = easeProgress;
          const bounceScale = p < 0.6 ? p * 1.5 : p < 0.8 ? 1 + (0.8 - p) * 0.5 : 1 + (1.0 - p) * 0.1;
          scale *= bounceScale;
      } else if (clip.animationType === 'shake-small') {
          const f = easeProgress * Math.PI * 12;
          posX += Math.sin(f) * 4;
          posY += Math.cos(f * 1.3) * 4;
      }

      let clipPathRect = null;
      let transitionFilter = '';
      
      // Clip-level Transition In
      if (clip.transitionIn) {
          const inDur = clip.transitionInDuration || 0.5;
          const tIn = t - clip.startTime;
          if (tIn >= 0 && tIn <= inDur) {
              const p = tIn / inDur;
              const easeProgress = -(Math.cos(Math.PI * p) - 1) / 2;
              
              const tInType = clip.transitionIn;
              if (tInType === 'fade' || tInType === 'dissolve') {
                  opacity *= easeProgress;
              } else if (tInType === 'wipe-left') {
                  clipPathRect = { x: 0, y: 0, w: easeProgress * canvas.width, h: canvas.height };
              } else if (tInType === 'wipe-right') {
                  clipPathRect = { x: canvas.width * (1 - easeProgress), y: 0, w: easeProgress * canvas.width, h: canvas.height };
              } else if (tInType === 'wipe-up') {
                  clipPathRect = { x: 0, y: 0, w: canvas.width, h: easeProgress * canvas.height };
              } else if (tInType === 'wipe-down') {
                  clipPathRect = { x: 0, y: canvas.height * (1 - easeProgress), w: canvas.width, h: easeProgress * canvas.height };
              } else if (tInType === 'slide-left') {
                  posX += (1 - easeProgress) * 400;
              } else if (tInType === 'slide-right') {
                  posX -= (1 - easeProgress) * 400;
              } else if (tInType === 'slide-up') {
                  posY += (1 - easeProgress) * 400;
              } else if (tInType === 'slide-down') {
                  posY -= (1 - easeProgress) * 400;
              } else if (tInType === 'push-left') {
                  posX += (1 - easeProgress) * 400;
                  opacity *= easeProgress;
              } else if (tInType === 'push-right') {
                  posX -= (1 - easeProgress) * 400;
                  opacity *= easeProgress;
              } else if (tInType === 'zoom-in') {
                  scale *= Math.max(0.01, easeProgress);
                  opacity *= easeProgress;
              } else if (tInType === 'zoom-out') {
                  scale *= (2 - easeProgress);
                  opacity *= easeProgress;
              } else if (tInType === 'spin') {
                  rotation += (1 - easeProgress) * 360;
              } else if (tInType === 'blur-fade') {
                  opacity *= easeProgress;
              } else if (tInType === 'color-flash-white') {
                  transitionFilter += ` brightness(${1 + (1 - easeProgress) * 3})`;
              } else if (tInType === 'color-flash-black') {
                  transitionFilter += ` brightness(${easeProgress})`;
              }
          }
      }
      
      // Clip-level Transition Out
      if (clip.transitionOut) {
          const outDur = clip.transitionOutDuration || 0.5;
          const tOut = clipEndTime - t;
          if (tOut >= 0 && tOut <= outDur) {
              const p = (t - (clipEndTime - outDur)) / outDur;
              const easeProgress = -(Math.cos(Math.PI * p) - 1) / 2;
              
              const tOutType = clip.transitionOut;
              if (tOutType === 'fade' || tOutType === 'dissolve') {
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'wipe-left') {
                  clipPathRect = { x: easeProgress * canvas.width, y: 0, w: (1 - easeProgress) * canvas.width, h: canvas.height };
              } else if (tOutType === 'wipe-right') {
                  clipPathRect = { x: 0, y: 0, w: (1 - easeProgress) * canvas.width, h: canvas.height };
              } else if (tOutType === 'wipe-up') {
                  clipPathRect = { x: 0, y: easeProgress * canvas.height, w: canvas.width, h: (1 - easeProgress) * canvas.height };
              } else if (tOutType === 'wipe-down') {
                  clipPathRect = { x: 0, y: 0, w: canvas.width, h: (1 - easeProgress) * canvas.height };
              } else if (tOutType === 'slide-left') {
                  posX -= easeProgress * 400;
              } else if (tOutType === 'slide-right') {
                  posX += easeProgress * 400;
              } else if (tOutType === 'slide-up') {
                  posY -= easeProgress * 400;
              } else if (tOutType === 'slide-down') {
                  posY += easeProgress * 400;
              } else if (tOutType === 'push-left') {
                  posX -= easeProgress * 400;
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'push-right') {
                  posX += easeProgress * 400;
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'zoom-in') {
                  scale *= 1 + (easeProgress * 0.5);
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'zoom-out') {
                  scale *= Math.max(0.01, 1 - easeProgress);
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'spin') {
                  rotation -= easeProgress * 360;
              } else if (tOutType === 'blur-fade') {
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'color-flash-white') {
                  transitionFilter += ` brightness(${1 + easeProgress * 3})`;
              } else if (tOutType === 'color-flash-black') {
                  transitionFilter += ` brightness(${1 - easeProgress})`;
              }
          }
      }

      const exportScaleFactor = canvas.height / 720;
      ctx.save();
      
      if (clipPathRect) {
          ctx.beginPath();
          ctx.rect(clipPathRect.x, clipPathRect.y, clipPathRect.w, clipPathRect.h);
          ctx.clip();
      }

      ctx.globalAlpha = opacity;
      if (clip.blendMode && clip.blendMode !== 'normal') {
        ctx.globalCompositeOperation = clip.blendMode as any;
      }
      // Dynamic modifications from effects before scaling / rotating
      if (clip.effect === 'effect-pulse') {
        const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.08;
        scale *= pulse;
      } else if (clip.effect === 'effect-zoom') {
        const zoomPhase = 1 + Math.abs(Math.sin(t * Math.PI * 0.2)) * 0.15;
        scale *= zoomPhase;
      } else if (clip.effect === 'effect-acid-trip') {
        rotation += Math.sin(t * Math.PI) * 4;
      } else if (clip.effect === 'effect-shake') {
        // Simple shake calculation based on time
        const f = t * 60; // Approximate frames (60 fps)
        const shakeX = (Math.sin(f * 13) * 2 + Math.cos(f * 7) * 1) * exportScaleFactor;
        const shakeY = (Math.cos(f * 17) * 2 + Math.sin(f * 11) * 1) * exportScaleFactor;
        const shakeRot = Math.sin(f * 19) * 1;
        posX += shakeX;
        posY += shakeY;
        rotation += shakeRot;
      } else if (clip.effect === 'effect-bounce') {
        posY += Math.sin(t * Math.PI * 2) * -15 * exportScaleFactor; // Simplistic bounce up and down
      } else if (clip.effect === 'effect-glitch') {
        const glitchTime = Math.floor(t * 10);
        if (glitchTime % 3 === 0) {
          posX += (Math.sin(t * 100) * 8) * exportScaleFactor;
          posY += (Math.cos(t * 150) * 4) * exportScaleFactor;
          rotation += Math.sin(t * 50) * 2;
        }
      }

      ctx.translate(canvas.width / 2 + posX * exportScaleFactor, canvas.height / 2 + posY * exportScaleFactor);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.scale(scale, scale);

      let filterString = clip.filter && clip.filter !== 'none' ? clip.filter : '';
      if (clip.effect === 'effect-vintage') filterString += ' sepia(80%) contrast(120%) brightness(90%)';
      else if (clip.effect === 'effect-motion-blur') filterString += ' blur(4px)';
      else if (clip.effect === 'effect-scanline') filterString += ' contrast(1.2) brightness(0.95)';
      else if (clip.effect === 'effect-rgb-split') filterString += ' drop-shadow(4px 0px 0px rgba(255,0,80,0.6)) drop-shadow(-4px 0px 0px rgba(0,255,255,0.6))';
      else if (clip.effect === 'effect-pulse') filterString += ` drop-shadow(0 0 15px rgba(139,92,246,0.6)) brightness(${1 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.15})`;
      else if (clip.effect === 'effect-pixelate') filterString += ' contrast(1.25) saturate(1.4)';
      else if (clip.effect === 'effect-acid-trip') filterString += ` hue-rotate(${Math.round(t * 120) % 360}deg) saturate(2) contrast(1.2)`;
      else if (clip.effect === 'effect-glitch') filterString += ` hue-rotate(${Math.sin(t * 15) * 60}deg) saturate(2) contrast(1.5)`;

      filterString += transitionFilter;

      const cleanFilter = filterString.trim();
      if (cleanFilter && cleanFilter !== 'none') ctx.filter = cleanFilter;

      if (clip.effect === 'effect-pixelate') {
        ctx.imageSmoothingEnabled = false;
      }

      if (clip.type === 'shape') {
        drawShapeOnCanvas(ctx, clip, canvas.width, canvas.height);
        const shapeSize = clip.scale ? clip.scale * canvas.width * 0.2 : canvas.width * 0.2;
        if (clip.effect === 'effect-scanline') {
          ctx.save();
          ctx.fillStyle = Math.sin(t * 60) > 0 ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.25)';
          for (let y = -shapeSize / 2; y < shapeSize / 2; y += 6) {
            ctx.fillRect(-shapeSize / 2, y, shapeSize, 2);
          }
          ctx.restore();
        } else if (clip.effect === 'effect-pixelate') {
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          for (let x = -shapeSize / 2; x < shapeSize / 2; x += 3) {
            ctx.fillRect(x, -shapeSize / 2, 1, shapeSize);
          }
          for (let y = -shapeSize / 2; y < shapeSize / 2; y += 3) {
            ctx.fillRect(-shapeSize / 2, y, shapeSize, 1);
          }
          ctx.restore();
        }
      } else {
        const element = preloaded[clip.id];
        if (element && clip.type !== 'audio') {
          let imgW = 0, imgH = 0;
          if (element instanceof HTMLImageElement) { imgW = element.naturalWidth; imgH = element.naturalHeight; }
          else if (element instanceof HTMLVideoElement) { imgW = element.videoWidth; imgH = element.videoHeight; }
          
          if (imgW > 0 && imgH > 0) {
            const targetAspect = canvas.width / canvas.height;
            const imgAspect = imgW / imgH;
            const mode = clip.scaleMode || 'cover';
            let drawW = canvas.width, drawH = canvas.height;
            if (mode === 'contain') {
              if (imgAspect > targetAspect) { drawW = canvas.width; drawH = canvas.width / imgAspect; }
              else { drawH = canvas.height; drawW = canvas.height * imgAspect; }
            } else {
              if (imgAspect > targetAspect) { drawH = canvas.height; drawW = canvas.height * imgAspect; }
              else { drawW = canvas.width; drawH = canvas.width / imgAspect; }
            }
            ctx.drawImage(element as any, -drawW / 2, -drawH / 2, drawW, drawH);

            // Draw effects overlay on drawn element
            if (clip.effect === 'effect-scanline') {
              ctx.save();
              ctx.fillStyle = Math.sin(t * 60) > 0 ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.25)';
              for (let y = -drawH / 2; y < drawH / 2; y += 6) {
                ctx.fillRect(-drawW / 2, y, drawW, 2);
              }
              ctx.restore();
            } else if (clip.effect === 'effect-pixelate') {
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
              for (let x = -drawW / 2; x < drawW / 2; x += 3) {
                ctx.fillRect(x, -drawH / 2, 1, drawH);
              }
              for (let y = -drawH / 2; y < drawH / 2; y += 3) {
                ctx.fillRect(-drawW / 2, y, drawW, 1);
              }
              ctx.restore();
            }

          } else {
            ctx.drawImage(element as any, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
          }
        }
      }
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    }

    // Draw Text
    const activeTexts = clips.filter(c => c.type === 'text' && t >= c.startTime && t < (c.startTime + (c.clipEndOffset - c.clipStartOffset)));
    for (const textClip of activeTexts) {
      ctx.save();
      const textClipDuration = textClip.clipEndOffset - textClip.clipStartOffset;
      const textProgress = Math.max(0, Math.min(1, ((t - textClip.startTime) / textClipDuration) * (textClip.animationSpeed || 1)));
      let textToDisplay = textClip.textContent || '';
      let textColor = textClip.textColor || '#ffffff';
      let fontName = 'sans-serif';
      if (textClip.customFontUrl) fontName = getFontFamilyFromUrl(textClip.customFontUrl);
      else if (textClip.fontFamily) {
        fontName = resolveFontFamily(textClip.fontFamily);
      }

      const interpolated = getInterpolatedProperties(textClip, t);
      let posX = interpolated.posX || 0;
      let posY = interpolated.posY || 0;
      let textScale = interpolated.scale || 1;
      let textRotation = interpolated.rotation || 0;
      let textOpacity = interpolated.opacity ?? 1.0;

      // Text Animations
      if (textClip.animationType === 'typewriter') {
        const revealProgress = Math.min(1, textProgress / 0.45);
        const charCount = Math.floor(textToDisplay.length * revealProgress);
        textToDisplay = textToDisplay.substring(0, charCount);
      } else if (textClip.animationType === 'slide-fade-up') {
        const animProgress = Math.min(1, textProgress / 0.3);
        const translateY = (1 - animProgress) * 40; 
        posY += translateY;
        textOpacity = animProgress * textOpacity;
      } else if (textClip.animationType === 'zoom-pop') {
        const animProgress = Math.min(1, textProgress / 0.35);
        const pScale = animProgress === 1 ? 1 : Math.sin(-13 * (Math.PI / 2) * (animProgress + 1)) * Math.pow(2, -10 * animProgress) + 1;
        textScale *= pScale;
        textOpacity = Math.min(1, animProgress * 1.5) * textOpacity;
      } else if (textClip.animationType === 'glitch-shake') {
        const f = t * 60;
        const shakeX = Math.sin(f * 1.5) * 6;
        const shakeY = Math.cos(f * 2.2) * 6;
        posX += shakeX;
        posY += shakeY;
        const chars = "01$#@%&*+=_<>/?[]{}█▓▒░";
        const len = textToDisplay.length;
        const revealProgress = Math.min(1, textProgress / 0.6);
        const solvedCount = Math.floor(len * revealProgress);
        let result = "";
        for (let i = 0; i < len; i++) {
          if (i < solvedCount) {
            result += (Math.sin(f + i) > 0.95) ? chars[Math.floor(Math.sin(f + i) * 100) % chars.length] : textToDisplay[i];
          } else {
            const charIdx = Math.abs(Math.floor(Math.sin(f + i) * 100)) % chars.length;
            result += chars[charIdx];
          }
        }
        textToDisplay = result;
        ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = Math.sin(f * 4) * 5;
        textColor = textClip.textColor || '#ffffff';
      } else if (textClip.animationType === 'bounce-entrance') {
        const animProgress = Math.min(1, textProgress / 0.5);
        const n1 = 7.5625, d1 = 2.75;
        let p = 1 - animProgress;
        let ease;
        if (p < 1 / d1) { ease = n1 * p * p; }
        else if (p < 2 / d1) { ease = n1 * (p -= 1.5 / d1) * p + 0.75; }
        else if (p < 2.5 / d1) { ease = n1 * (p -= 2.25 / d1) * p + 0.9375; }
        else { ease = n1 * (p -= 2.625 / d1) * p + 0.984375; }
        posY += ease * -150; 
        textOpacity = Math.min(1, animProgress * 2) * textOpacity;
      } else if (textClip.animationType === 'rotate-drop') {
        const animProgress = Math.min(1, textProgress / 0.35);
        textRotation += (1 - animProgress) * 120;
        textScale *= animProgress;
        textOpacity = animProgress * textOpacity;
      } else if (textClip.animationType === 'rainbow-wave') {
        const hue = (t * 120) % 360;
        textColor = `hsl(${hue}, 90%, 65%)`;
      } else if (textClip.animationType === 'soft-pulse') {
        textScale *= 1 + Math.sin(t * Math.PI * 2) * 0.08;
      } else if (textClip.animationType === 'blur-reveal') {
        const animProgress = Math.min(1, textProgress / 0.4);
        ctx.filter = `blur(${(1 - animProgress) * 20}px)`;
        textOpacity *= animProgress;
      } else if (textClip.animationType === 'letter-stagger') {
        const animProgress = Math.min(1, textProgress / 0.45);
        const letterSpacing = (1 - animProgress) * 15;
        (ctx as any).letterSpacing = `${letterSpacing}px`;
        textOpacity *= animProgress;
      } else if (textClip.animationType === 'slide-left-wipe') {
        const animProgress = Math.min(1, textProgress / 0.35);
        posX += (1 - animProgress) * -80;
        textOpacity *= animProgress;
      } else if (textClip.animationType === 'spiral-in') {
        const animProgress = Math.min(1, textProgress / 0.45);
        textRotation += (1 - animProgress) * 360;
        textScale *= animProgress;
        textOpacity *= animProgress;
      } else if (textClip.animationType === 'flash-bang') {
        const animProgress = Math.min(1, textProgress / 0.3);
        ctx.filter = `brightness(${1 + (1 - animProgress) * 5}) blur(${(1 - animProgress) * 10}px)`;
        textScale *= (1 + (1 - animProgress) * 0.5);
        textOpacity *= animProgress;
      } else if (textClip.animationType === 'swing-pendulum') {
        textRotation += Math.sin(t * Math.PI * 2.5) * 15;
      } else if (textClip.animationType === 'zoom-wobble') {
        textScale *= 1 + Math.sin(t * Math.PI * 4) * 0.1;
        textRotation += Math.cos(t * Math.PI * 5) * 5;
      } else if (textClip.animationType === 'slide-bounce-right') {
        const animProgress = Math.min(1, textProgress / 0.5);
        const n1 = 7.5625, d1 = 2.75;
        let p = 1 - animProgress;
        let ease;
        if (p < 1 / d1) { ease = n1 * p * p; }
        else if (p < 2 / d1) { ease = n1 * (p -= 1.5 / d1) * p + 0.75; }
        else if (p < 2.5 / d1) { ease = n1 * (p -= 2.25 / d1) * p + 0.9375; }
        else { ease = n1 * (p -= 2.625 / d1) * p + 0.984375; }
        posX += ease * -100;
        textOpacity = Math.min(1, animProgress * 2) * textOpacity;
      } else if (textClip.animationType === 'blur-in-out') {
        let fadeProgress = 1;
        let blurProgress = 0;
        if (textProgress < 0.2) {
            fadeProgress = textProgress / 0.2;
            blurProgress = (1 - fadeProgress) * 20;
        } else if (textProgress > 0.8) {
            fadeProgress = (1 - textProgress) / 0.2;
            blurProgress = (1 - fadeProgress) * 20;
        }
        textOpacity *= fadeProgress;
        if (blurProgress > 0) {
            ctx.filter = `blur(${blurProgress}px)`;
        }
      }

      // Special FX dynamic transformations on Text Layer
      if (textClip.effect === 'effect-pulse') {
        const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.08;
        textScale *= pulse;
      } else if (textClip.effect === 'effect-zoom') {
        const zoomPhase = 1 + Math.abs(Math.sin(t * Math.PI * 0.2)) * 0.15;
        textScale *= zoomPhase;
      } else if (textClip.effect === 'effect-acid-trip') {
        textRotation += Math.sin(t * Math.PI) * 4;
      } else if (textClip.effect === 'effect-shake') {
        const f = t * 60;
        const shakeX = (Math.sin(f * 13) * 2 + Math.cos(f * 7) * 1);
        const shakeY = (Math.cos(f * 17) * 2 + Math.sin(f * 11) * 1);
        const shakeRot = Math.sin(f * 19) * 1;
        posX += shakeX;
        posY += shakeY;
        textRotation += shakeRot;
      } else if (textClip.effect === 'effect-bounce') {
        posY += Math.sin(t * Math.PI * 2) * -15;
      } else if (textClip.effect === 'effect-glitch') {
        const glitchTime = Math.floor(t * 10);
        if (glitchTime % 3 === 0) {
          posX += Math.sin(t * 100) * 8;
          posY += Math.cos(t * 150) * 4;
          textRotation += Math.sin(t * 50) * 2;
        }
      }

      ctx.globalAlpha = textOpacity;
      if (textClip.blendMode && textClip.blendMode !== 'normal') {
        ctx.globalCompositeOperation = textClip.blendMode as any;
      }
      
      let textFilterString = '';
      if (textClip.effect === 'effect-vintage') textFilterString += ' sepia(80%) contrast(120%) brightness(90%)';
      else if (textClip.effect === 'effect-motion-blur') textFilterString += ' blur(4px)';
      else if (textClip.effect === 'effect-scanline') textFilterString += ' contrast(1.2) brightness(0.95)';
      else if (textClip.effect === 'effect-rgb-split') textFilterString += ' drop-shadow(4px 0px 0px rgba(255,0,80,0.6)) drop-shadow(-4px 0px 0px rgba(0,255,255,0.6))';
      else if (textClip.effect === 'effect-pulse') textFilterString += ` drop-shadow(0 0 15px rgba(139,92,246,0.6)) brightness(${1 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.15})`;
      else if (textClip.effect === 'effect-pixelate') textFilterString += ' contrast(1.25) saturate(1.4)';
      else if (textClip.effect === 'effect-acid-trip') textFilterString += ` hue-rotate(${Math.round(t * 120) % 360}deg) saturate(2) contrast(1.2)`;
      else if (textClip.effect === 'effect-glitch') textFilterString += ` hue-rotate(${Math.sin(t * 15) * 60}deg) saturate(2) contrast(1.5)`;

      if (textFilterString) {
        ctx.filter = textFilterString.trim();
      }

      const exportScaleFactor = canvas.height / 720;
      ctx.translate(canvas.width / 2 + posX * exportScaleFactor, canvas.height / 2 + posY * exportScaleFactor);
      ctx.rotate(textRotation * Math.PI / 180);
      ctx.scale(textScale, textScale);
      ctx.fillStyle = textColor;
      ctx.font = `bold ${Math.round(canvas.width * 0.08)}px "${fontName}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (textClip.animationType !== 'glitch-shake') {
        const shadowEnabled = textClip.textShadowEnabled ?? true;
        if (shadowEnabled) {
          ctx.shadowColor = textClip.textShadowColor || 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = textClip.textShadowBlur !== undefined ? textClip.textShadowBlur : 6;
          ctx.shadowOffsetX = (textClip.textShadowOffsetX !== undefined ? textClip.textShadowOffsetX : 2) * exportScaleFactor;
          ctx.shadowOffsetY = (textClip.textShadowOffsetY !== undefined ? textClip.textShadowOffsetY : 2) * exportScaleFactor;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }
      
      const lines = textToDisplay.split('\n');
      const lineHeight = Math.round(canvas.width * 0.08) * 1.2;
      const startY = -(lines.length - 1) * lineHeight / 2;

      if (textClip.animationType === 'glitch-shake') {
        const f = t * 60;
        const cyanOffset = Math.sin(f * 4) * 5 * exportScaleFactor;
        const magentaOffset = Math.cos(f * 3) * -5 * exportScaleFactor;
        
        // Draw Cyan background offset text shadow
        ctx.save();
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = textOpacity * 0.75;
        lines.forEach((line, i) => {
          ctx.fillText(line, cyanOffset, startY + i * lineHeight);
        });
        ctx.restore();

        // Draw Magenta background offset text shadow
        ctx.save();
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = textOpacity * 0.75;
        lines.forEach((line, i) => {
          ctx.fillText(line, magentaOffset, startY + i * lineHeight);
        });
        ctx.restore();
      }

      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineHeight);
      });
      ctx.restore();
    }

    ctx.restore(); // Restore global camera transforms

    const frame = new VideoFrame(canvas, { timestamp: (f * 1e6) / settings.fps });
    videoEncoder.encode(frame);
    frame.close();
    
    onProgress(Math.round((f / totalFrames) * 100));
    
    // Yield to main thread
    if (f % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  await videoEncoder.flush();
  if (audioEncoder) await audioEncoder.flush();
  muxer.finalize();
  
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `motionflux-export-${Date.now()}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
};
