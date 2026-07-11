import React, { useEffect, useRef, useState } from 'react';
import { TimelineClip } from '../types';
import { Play, Pause, Square } from 'lucide-react';
import { formatTime, solveCubicBezier, getInterpolatedProperties, makeDistortionCurve, resolveFontFamily } from '../utils';

interface PreviewCanvasProps {
  clips: TimelineClip[];
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
  settings: {
    aspectRatio: '9/16' | '16/9' | '1/1' | '4/3' | '21/9' | '4/5' | '3/2';
    quality: '720p' | '1080p' | '4K';
    fps: number;
    globalAnimationSpeed?: number;
  };
  isAntiLagEnabled?: boolean;
  theme?: 'padrão' | 'nostalgia';
  backgroundColor?: string;
  markers?: number[];
  onToggleMarker?: (time: number) => void;
  onSeek?: (time: number) => void;
  duration?: number;
}

function getFontFamilyFromUrl(url: string, fallback: string): string {
  try {
    const match = url.match(/family=([^&:]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
  } catch (e) {
    console.error("Erro ao ler família de fontes:", e);
  }
  return fallback;
}

function renderShapeSvg(clip: any) {
  const fill = clip.shapeColor || '#4f46e5';
  const stroke = clip.shapeBorderColor || '#ffffff';
  const strokeWidth = clip.shapeBorderWidth !== undefined ? clip.shapeBorderWidth : 2;

  switch (clip.shapeType) {
    case 'circle':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <circle cx="50" cy="50" r="45" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    case 'square':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <rect x="10" y="10" width="80" height="80" rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    case 'triangle':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <polygon points="50,10 90,90 10,90" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    case 'star-4':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <polygon points="50,10 62,38 90,50 62,62 50,90 38,62 10,50 38,38" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    case 'star-5':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <polygon points="50,10 63,38 93,38 69,57 78,87 50,70 22,87 31,57 7,38 37,38" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    case 'oval-custom':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <ellipse cx="50" cy="50" rx="45" ry="25" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2 max-w-[80%] max-h-[80%]">
          <circle cx="50" cy="50" r="45" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
  }
}

function SyncMedia({ clip, currentTime, isPlaying, style, className, isAntiLagEnabled }: any) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);
  const lowpassNodeRef = useRef<BiquadFilterNode | null>(null);
  const distortionNodeRef = useRef<WaveShaperNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainNodeRef = useRef<GainNode | null>(null);
  const chorusDelayNodeRef = useRef<DelayNode | null>(null);
  const chorusLfoNodeRef = useRef<OscillatorNode | null>(null);
  const chorusLfoGainNodeRef = useRef<GainNode | null>(null);
  const lfoNodeRef = useRef<OscillatorNode | null>(null);
  const lfoGainNodeRef = useRef<GainNode | null>(null);

  const hasFilters = (clip.audioBass && clip.audioBass !== 0) || 
                     (clip.audioTreble && clip.audioTreble !== 0) || 
                     (clip.audioPitch && clip.audioPitch !== 0) ||
                     (clip.audioLowpass !== undefined && clip.audioLowpass !== 100) ||
                     (clip.audioReverb && clip.audioReverb !== 0) ||
                     (clip.audioDistortion && clip.audioDistortion !== 0) ||
                     (clip.audioTremolo && clip.audioTremolo !== 0) ||
                     (clip.audioPhaser && clip.audioPhaser !== 0);

  useEffect(() => {
    if (!mediaRef.current) return;
    const el = mediaRef.current;
    
    const expectedTime = currentTime - clip.startTime + clip.clipStartOffset;
    
    let shouldSeek = false;
    if (!isPlaying) {
      // Precise seek when scrubbing
      shouldSeek = Math.abs(el.currentTime - expectedTime) > 0.08;
    } else {
      if (el.paused) {
        // Precise seek when starting playback so we begin at the correct frame/sample
        shouldSeek = true;
      } else {
        // Continuous playback: only seek on huge drift (e.g. > 1.2 seconds) to avoid stuttering
        shouldSeek = Math.abs(el.currentTime - expectedTime) > 1.2;
      }
    }

    if (shouldSeek) {
      const duration = el.duration || 999;
      el.currentTime = Math.max(0, Math.min(duration, expectedTime));
    }

    if (isPlaying && el.paused) {
      el.play().catch(e => console.log("Autoplay prevented:", e));
    } else if (!isPlaying && !el.paused) {
      el.pause();
    }
  }, [currentTime, isPlaying, clip.startTime, clip.clipStartOffset]);

  useEffect(() => {
    if (!mediaRef.current) return;
    const el = mediaRef.current;

    // Only set crossOrigin if we actually need Web Audio (to avoid silent CORS issues)
    if (hasFilters) {
      el.crossOrigin = "anonymous";
    }

    if (hasFilters && !audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        try {
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;

          const src = ctx.createMediaElementSource(el);
          sourceNodeRef.current = src;

          const gain = ctx.createGain();
          gain.gain.value = (clip.audioVolume !== undefined ? clip.audioVolume / 100 : 1.0);
          gainNodeRef.current = gain;

          if (isAntiLagEnabled) {
            // Anti-lag direct path
            src.connect(gain);
            gain.connect(ctx.destination);
          } else {
            const bass = ctx.createBiquadFilter();
            bass.type = 'lowshelf';
            bass.frequency.value = 200;
            bass.gain.value = clip.audioBass || 0;
            bassNodeRef.current = bass;

            const treble = ctx.createBiquadFilter();
            treble.type = 'highshelf';
            treble.frequency.value = 3000;
            treble.gain.value = clip.audioTreble || 0;
            trebleNodeRef.current = treble;

            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            const lpFreq = clip.audioLowpass !== undefined ? 200 + (clip.audioLowpass / 100) * 19800 : 20000;
            lowpass.frequency.value = lpFreq;
            lowpassNodeRef.current = lowpass;

            const distortion = ctx.createWaveShaper();
            if (clip.audioDistortion && clip.audioDistortion > 0) {
              distortion.curve = makeDistortionCurve(clip.audioDistortion);
            } else {
              distortion.curve = null;
            }
            distortion.oversample = '4x';
            distortionNodeRef.current = distortion;

            const delay = ctx.createDelay(1.0);
            delay.delayTime.value = 0.3;
            delayNodeRef.current = delay;

            const delayGain = ctx.createGain();
            delayGain.gain.value = (clip.audioReverb || 0) / 100 * 0.5;
            delayGainNodeRef.current = delayGain;

            const chorusDelay = ctx.createDelay(0.1);
            chorusDelay.delayTime.value = 0.03;
            chorusDelayNodeRef.current = chorusDelay;

            const chorusLfo = ctx.createOscillator();
            chorusLfo.frequency.value = 1.5;
            chorusLfoNodeRef.current = chorusLfo;

            const chorusLfoGain = ctx.createGain();
            chorusLfoGain.gain.value = (clip.audioPhaser || 0) / 100 * 0.005;
            chorusLfoGainNodeRef.current = chorusLfoGain;

            const lfo = ctx.createOscillator();
            lfo.frequency.value = 5;
            lfoNodeRef.current = lfo;

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = (clip.audioTremolo || 0) / 100 * 0.8;
            lfoGainNodeRef.current = lfoGain;

            // Wire Chorus LFO
            chorusLfo.connect(chorusLfoGain);
            chorusLfoGain.connect(chorusDelay.delayTime);
            chorusLfo.start();

            // Wire Tremolo LFO
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            lfo.start();

            // Connections
            src.connect(bass);
            bass.connect(treble);
            treble.connect(lowpass);
            lowpass.connect(distortion);
            
            // Connect clean path to gain
            distortion.connect(gain);

            // Connect Delay path
            distortion.connect(delay);
            delay.connect(delayGain);
            delayGain.connect(delay);
            delayGain.connect(gain);

            // Connect Chorus/Phaser path
            distortion.connect(chorusDelay);
            chorusDelay.connect(gain);

            gain.connect(ctx.destination);
          }

          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
        } catch (e) {
          console.warn("Web Audio context init failed or already wired:", e);
        }
      }
    }

    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          sourceNodeRef.current?.disconnect();
          bassNodeRef.current?.disconnect();
          trebleNodeRef.current?.disconnect();
          lowpassNodeRef.current?.disconnect();
          distortionNodeRef.current?.disconnect();
          delayNodeRef.current?.disconnect();
          delayGainNodeRef.current?.disconnect();
          chorusDelayNodeRef.current?.disconnect();
          chorusLfoNodeRef.current?.stop();
          chorusLfoNodeRef.current?.disconnect();
          chorusLfoGainNodeRef.current?.disconnect();
          lfoNodeRef.current?.stop();
          lfoNodeRef.current?.disconnect();
          lfoGainNodeRef.current?.disconnect();
          gainNodeRef.current?.disconnect();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [clip.id, hasFilters]);

  useEffect(() => {
    if (audioCtxRef.current && isPlaying && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(e => console.log(e));
    }

    const el = mediaRef.current;
    if (!el) return;

    const semitones = clip.audioPitch || 0;
    const rate = Math.pow(2, semitones / 12);
    el.playbackRate = rate;
    el.preservesPitch = false;

    const duration = clip.clipEndOffset - clip.clipStartOffset;
    const tClip = currentTime - clip.startTime;

    let volMultiplier = 1.0;
    if (clip.audioFadeIn && clip.audioFadeIn > 0 && tClip < clip.audioFadeIn) {
      volMultiplier *= Math.max(0, Math.min(1, tClip / clip.audioFadeIn));
    }
    if (clip.audioFadeOut && clip.audioFadeOut > 0 && (duration - tClip) < clip.audioFadeOut) {
      volMultiplier *= Math.max(0, Math.min(1, (duration - tClip) / clip.audioFadeOut));
    }

    const baseVolume = clip.audioVolume !== undefined ? clip.audioVolume / 100 : 1.0;
    const targetVolume = baseVolume * volMultiplier;

    if (gainNodeRef.current && audioCtxRef.current && hasFilters) {
      gainNodeRef.current.gain.setValueAtTime(targetVolume, audioCtxRef.current.currentTime);
    } else {
      el.volume = Math.max(0, Math.min(1, targetVolume));
    }

    if (bassNodeRef.current && audioCtxRef.current && hasFilters) {
      bassNodeRef.current.gain.setValueAtTime(clip.audioBass || 0, audioCtxRef.current.currentTime);
    }
    if (trebleNodeRef.current && audioCtxRef.current && hasFilters) {
      trebleNodeRef.current.gain.setValueAtTime(clip.audioTreble || 0, audioCtxRef.current.currentTime);
    }
    if (lowpassNodeRef.current && audioCtxRef.current && hasFilters) {
      const lpFreq = clip.audioLowpass !== undefined ? 200 + (clip.audioLowpass / 100) * 19800 : 20000;
      lowpassNodeRef.current.frequency.setValueAtTime(lpFreq, audioCtxRef.current.currentTime);
    }
    if (distortionNodeRef.current && audioCtxRef.current && hasFilters) {
      if (clip.audioDistortion && clip.audioDistortion > 0) {
        distortionNodeRef.current.curve = makeDistortionCurve(clip.audioDistortion);
      } else {
        distortionNodeRef.current.curve = null;
      }
    }
    if (delayGainNodeRef.current && audioCtxRef.current && hasFilters) {
      delayGainNodeRef.current.gain.setValueAtTime((clip.audioReverb || 0) / 100 * 0.5, audioCtxRef.current.currentTime);
    }
    if (chorusLfoGainNodeRef.current && audioCtxRef.current && hasFilters) {
      chorusLfoGainNodeRef.current.gain.setValueAtTime((clip.audioPhaser || 0) / 100 * 0.005, audioCtxRef.current.currentTime);
    }
    if (lfoGainNodeRef.current && audioCtxRef.current && hasFilters) {
      lfoGainNodeRef.current.gain.setValueAtTime((clip.audioTremolo || 0) / 100 * 0.8, audioCtxRef.current.currentTime);
    }
  }, [
    currentTime, 
    isPlaying, 
    clip.audioVolume, 
    clip.audioFadeIn, 
    clip.audioFadeOut, 
    clip.audioPitch, 
    clip.audioBass, 
    clip.audioTreble, 
    clip.audioLowpass,
    clip.audioReverb,
    clip.audioDistortion,
    clip.audioTremolo,
    clip.audioPhaser,
    hasFilters
  ]);

  if (clip.type === 'video') {
    return (
      <video 
        ref={mediaRef as any}
        src={clip.dataUrl} 
        className={className}
        style={style}
        playsInline
      />
    );
  } else if (clip.type === 'audio') {
    return <audio ref={mediaRef as any} src={clip.dataUrl} className="hidden" />;
  }
  return null;
}

export function PreviewCanvas({ clips, currentTime, isPlaying, onPlayPause, onStop, onUpdateClip, settings, isAntiLagEnabled, theme = 'padrão', backgroundColor = '#000000', markers = [], onToggleMarker, onSeek, duration = 15 }: PreviewCanvasProps) {
  
  const [draggingClip, setDraggingClip] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(360);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.height > 0) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scaleFactor = containerHeight / 720;
  
  // Unified ref for both mouse and touch drag state
  const dragRef = React.useRef<{
    initialX: number;
    initialY: number;
    initialClipPosX: number;
    initialClipPosY: number;
    initialClipScale: number;
    initialClipRotation: number;
    initialKeyframes: any[] | null;
    isMultiTouch: boolean;
    initialDistance: number;
    initialAngle: number;
  } | null>(null);

  const handleMouseDown = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    setDraggingClip(clipId);
    dragRef.current = {
      initialX: e.clientX,
      initialY: e.clientY,
      initialClipPosX: clip.posX || 0,
      initialClipPosY: clip.posY || 0,
      initialClipScale: clip.scale ?? 1,
      initialClipRotation: clip.rotation || 0,
      initialKeyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
      isMultiTouch: false,
      initialDistance: 0,
      initialAngle: 0
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingClip && dragRef.current && !dragRef.current.isMultiTouch) {
      const state = dragRef.current;
      const deltaX = e.clientX - state.initialX;
      const deltaY = e.clientY - state.initialY;
      
      const deltaXRef = deltaX / scaleFactor;
      const deltaYRef = deltaY / scaleFactor;
      
      const newPosX = state.initialClipPosX + deltaXRef;
      const newPosY = state.initialClipPosY + deltaYRef;
      
      const updates: any = { posX: newPosX, posY: newPosY };

      if (state.initialKeyframes && state.initialKeyframes.length > 0) {
        updates.keyframes = state.initialKeyframes.map((kf: any) => ({
          ...kf,
          posX: (kf.posX || 0) + deltaXRef,
          posY: (kf.posY || 0) + deltaYRef
        }));
      }

      onUpdateClip(draggingClip, updates);
    }
  };

  const handleMouseUp = () => {
    setDraggingClip(null);
    dragRef.current = null;
  };

  const handleTouchStart = (clipId: string, e: React.TouchEvent) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    setDraggingClip(clipId);

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragRef.current = {
        initialX: touch.clientX,
        initialY: touch.clientY,
        initialClipPosX: clip.posX || 0,
        initialClipPosY: clip.posY || 0,
        initialClipScale: clip.scale ?? 1,
        initialClipRotation: clip.rotation || 0,
        initialKeyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
        isMultiTouch: false,
        initialDistance: 0,
        initialAngle: 0
      };
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      dragRef.current = {
        initialX: centerX,
        initialY: centerY,
        initialClipPosX: clip.posX || 0,
        initialClipPosY: clip.posY || 0,
        initialClipScale: clip.scale ?? 1,
        initialClipRotation: clip.rotation || 0,
        initialKeyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
        isMultiTouch: true,
        initialDistance: dist,
        initialAngle: angle
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingClip || !dragRef.current) return;
    e.preventDefault();
    const state = dragRef.current;

    if (e.touches.length === 1 && !state.isMultiTouch) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.initialX;
      const deltaY = touch.clientY - state.initialY;
      
      const deltaXRef = deltaX / scaleFactor;
      const deltaYRef = deltaY / scaleFactor;
      
      const newPosX = state.initialClipPosX + deltaXRef;
      const newPosY = state.initialClipPosY + deltaYRef;

      const updates: any = { posX: newPosX, posY: newPosY };

      if (state.initialKeyframes && state.initialKeyframes.length > 0) {
        updates.keyframes = state.initialKeyframes.map((kf: any) => ({
          ...kf,
          posX: (kf.posX || 0) + deltaXRef,
          posY: (kf.posY || 0) + deltaYRef
        }));
      }

      onUpdateClip(draggingClip, updates);
      
    } else if (e.touches.length === 2 && state.isMultiTouch) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const multiTouchScaleFactor = dist / state.initialDistance;
      let angleDiff = angle - state.initialAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      const rotationDiff = angleDiff * (180 / Math.PI);

      const moveX = centerX - state.initialX;
      const moveY = centerY - state.initialY;
      
      const moveXRef = moveX / scaleFactor;
      const moveYRef = moveY / scaleFactor;

      const newScale = parseFloat(Math.max(0.1, Math.min(10, state.initialClipScale * multiTouchScaleFactor)).toFixed(3));
      const newRotation = Math.round((state.initialClipRotation + rotationDiff) % 360);
      const newPosX = Math.round(state.initialClipPosX + moveXRef);
      const newPosY = Math.round(state.initialClipPosY + moveYRef);

      const updates: any = { 
        scale: newScale,
        rotation: newRotation,
        posX: newPosX,
        posY: newPosY
      };

      if (state.initialKeyframes && state.initialKeyframes.length > 0) {
        updates.keyframes = state.initialKeyframes.map((kf: any) => ({
          ...kf,
          scale: (kf.scale || 1) * multiTouchScaleFactor,
          rotation: (kf.rotation || 0) + rotationDiff,
          posX: (kf.posX || 0) + moveXRef,
          posY: (kf.posY || 0) + moveYRef
        }));
      }

      onUpdateClip(draggingClip, updates);
    }
  };

  // Sort: V1 rendered first, V2 Overlay rendered on top of V1
  const videoClips = clips
    .filter(c => c.type === 'video' || c.type === 'image' || c.type === 'shape')
    .sort((a, b) => {
      const orderA = a.trackId === 'v2' ? 2 : 1;
      const orderB = b.trackId === 'v2' ? 2 : 1;
      if (orderA !== orderB) return orderA - orderB;
      return a.startTime - b.startTime;
    });
  
  const activeVisuals = videoClips.map((clip, index) => {
     const duration = clip.clipEndOffset - clip.clipStartOffset;
     const endTime = clip.startTime + duration;
     const nextClip = videoClips[index + 1];
     const prevClip = videoClips[index - 1];

     let visualStart = clip.startTime;
     let visualEnd = endTime;
     
     let style: React.CSSProperties = { filter: isAntiLagEnabled ? undefined : clip.filter };
     let transitionActive = false;

     const interpolated = getInterpolatedProperties(clip, currentTime);
     console.log("Interpolated:", clip.id, interpolated);
     let posX = interpolated.posX;
     let posY = interpolated.posY;
     let scale = interpolated.scale;
     let rotation = interpolated.rotation;
     let opacity = 1;

     if (clip.animationType) {
         const clipDuration = clip.clipEndOffset - clip.clipStartOffset;
         const globalSpeed = settings.globalAnimationSpeed !== undefined ? settings.globalAnimationSpeed : 1.0;
         const speed = (clip.animationSpeed !== undefined ? clip.animationSpeed : 1.0) * globalSpeed;
         const rawProgress = ((currentTime - clip.startTime) / clipDuration) * speed;
         const progress = Math.max(0, Math.min(1, rawProgress));

         let easeProgress = progress;
         
         // 15 EASING FUNCTIONS
         if (clip.easing === 'ease-in') {
             easeProgress = progress * progress;
         } else if (clip.easing === 'ease-out') {
             easeProgress = progress * (2 - progress);
         } else if (clip.easing === 'ease-in-out') {
             easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
         } else if (clip.easing === 'sine-in-out') {
             easeProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
         } else if (clip.easing === 'ease-in-sine') {
             easeProgress = 1 - Math.cos((progress * Math.PI) / 2);
         } else if (clip.easing === 'ease-out-sine') {
             easeProgress = Math.sin((progress * Math.PI) / 2);
         } else if (clip.easing === 'ease-in-back') {
             const c1 = 1.70158;
             const c3 = c1 + 1;
             easeProgress = c3 * progress * progress * progress - c1 * progress * progress;
         } else if (clip.easing === 'ease-out-back') {
             const c1 = 1.70158;
             const c3 = c1 + 1;
             const p = progress - 1;
             easeProgress = 1 + c3 * p * p * p + c1 * p * p;
         } else if (clip.easing === 'ease-in-out-back') {
             const c1 = 1.70158;
             const c2 = c1 * 1.525;
             const p = progress * 2;
             if (p < 1) {
                 easeProgress = (p * p * ((c2 + 1) * p - c2)) / 2;
             } else {
                 const p2 = p - 2;
                 easeProgress = (p2 * p2 * ((c2 + 1) * p2 + c2) + 2) / 2;
             }
         } else if (clip.easing === 'ease-in-out-cubic') {
             easeProgress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
         } else if (clip.easing === 'elastic') {
             if (progress === 0) easeProgress = 0;
             else if (progress === 1) easeProgress = 1;
             else {
                 easeProgress = Math.sin(-13 * (Math.PI / 2) * (progress + 1)) * Math.pow(2, -10 * progress) + 1;
             }
         } else if (clip.easing === 'bounce') {
             const n1 = 7.5625, d1 = 2.75;
             let p = progress;
             if (p < 1 / d1) { easeProgress = n1 * p * p; }
             else if (p < 2 / d1) { easeProgress = n1 * (p -= 1.5 / d1) * p + 0.75; }
             else if (p < 2.5 / d1) { easeProgress = n1 * (p -= 2.25 / d1) * p + 0.9375; }
             else { easeProgress = n1 * (p -= 2.625 / d1) * p + 0.984375; }
         } else if (clip.easing === 'bounce-twice') {
             easeProgress = Math.abs(Math.sin(progress * Math.PI * 2.5)) * (1 - progress) + progress;
         } else if (clip.easing === 'custom-bezier') {
             const pts = clip.bezierPoints || [0.25, 0.1, 0.25, 1.0];
             easeProgress = solveCubicBezier(progress, pts[0], pts[1], pts[2], pts[3]);
         }

         // 15 ANIMATIONS MATH
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
             const bounceScale = p < 0.6 
               ? p * 1.5 
               : p < 0.8 
                 ? 1 + (0.8 - p) * 0.5 
                 : 1 + (1.0 - p) * 0.1;
             scale *= bounceScale;
         } else if (clip.animationType === 'shake-small') {
             const f = easeProgress * Math.PI * 12;
             posX += Math.sin(f) * 4;
             posY += Math.cos(f * 1.3) * 4;
         }
     }

     // Clip-level Transition In
     if (clip.transitionIn) {
         const inDur = clip.transitionInDuration || 0.5;
         const tIn = currentTime - clip.startTime;
         if (tIn >= 0 && tIn <= inDur) {
             const progress = tIn / inDur;
             const easeProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
             
             const tInType = clip.transitionIn;
             if (tInType === 'fade' || tInType === 'dissolve') {
                 opacity *= easeProgress;
             } else if (tInType === 'wipe-left') {
                 style.clipPath = `inset(0 ${(1 - easeProgress) * 100}% 0 0)`;
             } else if (tInType === 'wipe-right') {
                 style.clipPath = `inset(0 0 0 ${(1 - easeProgress) * 100}%)`;
             } else if (tInType === 'wipe-up') {
                 style.clipPath = `inset(0 0 ${(1 - easeProgress) * 100}% 0)`;
             } else if (tInType === 'wipe-down') {
                 style.clipPath = `inset(${(1 - easeProgress) * 100}% 0 0 0)`;
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
                 scale *= easeProgress;
                 opacity *= easeProgress;
             } else if (tInType === 'zoom-out') {
                 scale *= (2 - easeProgress);
                 opacity *= easeProgress;
             } else if (tInType === 'spin') {
                 rotation += (1 - easeProgress) * 360;
             } else if (tInType === 'blur-fade') {
                 opacity *= easeProgress;
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} blur(${(1 - easeProgress) * 15}px)`.trim();
                 }
             } else if (tInType === 'color-flash-white') {
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} brightness(${1 + (1 - easeProgress) * 3})`.trim();
                 }
             } else if (tInType === 'color-flash-black') {
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} brightness(${easeProgress})`.trim();
                 }
             }
         }
     }

     // Clip-level Transition Out
     if (clip.transitionOut) {
         const outDur = clip.transitionOutDuration || 0.5;
         const tOut = endTime - currentTime;
         if (tOut >= 0 && tOut <= outDur) {
             const progress = (currentTime - (endTime - outDur)) / outDur;
             const easeProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
             
             const tOutType = clip.transitionOut;
             if (tOutType === 'fade' || tOutType === 'dissolve') {
                 opacity *= (1 - easeProgress);
             } else if (tOutType === 'wipe-left') {
                 style.clipPath = `inset(0 0 0 ${easeProgress * 100}%)`;
              } else if (tOutType === 'wipe-right') {
                  style.clipPath = `inset(0 ${easeProgress * 100}% 0 0)`;
              } else if (tOutType === 'wipe-up') {
                  style.clipPath = `inset(${easeProgress * 100}% 0 0 0)`;
              } else if (tOutType === 'wipe-down') {
                  style.clipPath = `inset(0 0 ${easeProgress * 100}% 0)`;
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
                 scale *= (1 - easeProgress);
                 opacity *= (1 - easeProgress);
             } else if (tOutType === 'zoom-out') {
                 scale *= (1 + easeProgress);
                 opacity *= (1 - easeProgress);
              } else if (tOutType === 'spin') {
                  rotation += easeProgress * 360;
             } else if (tOutType === 'blur-fade') {
                 opacity *= (1 - easeProgress);
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} blur(${easeProgress * 15}px)`.trim();
                 }
             } else if (tOutType === 'color-flash-white') {
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} brightness(${1 + easeProgress * 3})`.trim();
                 }
             } else if (tOutType === 'color-flash-black') {
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} brightness(${1 - easeProgress})`.trim();
                 }
             }
         }
     }

     let baseTransform = `translate(${posX * scaleFactor}px, ${posY * scaleFactor}px) scale(${scale}) rotate(${rotation}deg)`;
     style.transform = baseTransform;
     style.opacity = opacity;
     style.filter = clip.filter || undefined;
     if (clip.blendMode && clip.blendMode !== 'normal') {
         style.mixBlendMode = clip.blendMode as any;
     }
     if (clip.chromaKeyEnabled) {
         style.filter = `${style.filter || ''} url(#chroma-${clip.id})`.trim();
     }

     // From prev transition
     if (prevClip && prevClip.transitionNext && Math.abs(prevClip.startTime + (prevClip.clipEndOffset - prevClip.clipStartOffset) - clip.startTime) < 0.1) {
         visualStart -= 0.5;
         const progress = (currentTime - visualStart) / 1.0;
         if (progress >= 0 && progress <= 1) {
             transitionActive = true;
             const tNext = prevClip.transitionNext;
             if (tNext === 'fade' || tNext === 'dissolve') {
                 style.opacity = progress * opacity;
             } else if (tNext === 'slide-left') {
                 style.transform = `${baseTransform} translateX(${(1 - progress) * 100}%)`;
             } else if (tNext === 'slide-right') {
                 style.transform = `${baseTransform} translateX(-${(1 - progress) * 100}%)`;
             } else if (tNext === 'slide-up') {
                 style.transform = `${baseTransform} translateY(${(1 - progress) * 100}%)`;
             } else if (tNext === 'slide-down') {
                 style.transform = `${baseTransform} translateY(-${(1 - progress) * 100}%)`;
             } else if (tNext === 'zoom') {
                 style.transform = `${baseTransform} scale(${progress})`;
                 style.opacity = progress * opacity;
             } else if (tNext === 'spin') {
                 style.transform = `${baseTransform} rotate(${(1 - progress) * 360}deg)`;
             } else if (tNext === 'wipe-left') {
                 style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
             } else if (tNext === 'wipe-right') {
                 style.clipPath = `inset(0 0 0 ${(1 - progress) * 100}%)`;
             } else if (tNext === 'color-flash-white') {
                 style.filter = `${style.filter || ''} brightness(${1 + (1 - progress) * 3})`;
             } else if (tNext === 'color-flash-black') {
                 style.filter = `${style.filter || ''} brightness(${progress})`;
             } else if (tNext === 'ripple') {
                 style.transform = `${baseTransform} scale(${1 + Math.sin(progress * Math.PI) * 0.15})`;
             } else if (tNext === 'blur-fade') {
                 style.opacity = progress * opacity;
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} blur(${(1 - progress) * 15}px)`;
                 }
             } else if (tNext === 'rotate-zoom') {
                 style.transform = `${baseTransform} scale(${progress}) rotate(${(1 - progress) * 180}deg)`;
                 style.opacity = progress * opacity;
             } else if (tNext === 'slide-up-fade') {
                 style.transform = `${baseTransform} translateY(${(1 - progress) * 60}px)`;
                 style.opacity = progress * opacity;
             } else if (tNext === 'slide-down-fade') {
                 style.transform = `${baseTransform} translateY(-${(1 - progress) * 60}px)`;
                 style.opacity = progress * opacity;
             } else if (tNext === 'squeeze-left') {
                 style.transform = `${baseTransform} scaleX(${progress})`;
             } else if (tNext === 'skew-slide') {
                 style.transform = `${baseTransform} translateX(${(1 - progress) * 100}%) skewX(${(1 - progress) * 20}deg)`;
             }
         }
     }

     // To next transition
     if (clip.transitionNext && nextClip && Math.abs(endTime - nextClip.startTime) < 0.1) {
         visualEnd += 0.5;
         const progress = (currentTime - (endTime - 0.5)) / 1.0;
         if (progress >= 0 && progress <= 1) {
             transitionActive = true;
             const tNext = clip.transitionNext;
             if (tNext === 'fade' || tNext === 'dissolve') {
                 style.opacity = (1 - progress) * opacity;
             } else if (tNext === 'slide-left') {
                 style.transform = `${baseTransform} translateX(-${progress * 100}%)`;
             } else if (tNext === 'slide-right') {
                 style.transform = `${baseTransform} translateX(${progress * 100}%)`;
             } else if (tNext === 'slide-up') {
                 style.transform = `${baseTransform} translateY(-${progress * 100}%)`;
             } else if (tNext === 'slide-down') {
                 style.transform = `${baseTransform} translateY(${progress * 100}%)`;
             } else if (tNext === 'zoom') {
                 style.transform = `${baseTransform} scale(${1 - progress})`;
                 style.opacity = (1 - progress) * opacity;
             } else if (tNext === 'spin') {
                 style.transform = `${baseTransform} rotate(${progress * 360}deg)`;
             } else if (tNext === 'wipe-left') {
                 style.clipPath = `inset(0 0 0 ${progress * 100}%)`;
             } else if (tNext === 'wipe-right') {
                 style.clipPath = `inset(0 ${progress * 100}% 0 0)`;
             } else if (tNext === 'color-flash-white') {
                 style.filter = `${style.filter || ''} brightness(${1 + progress * 3})`;
             } else if (tNext === 'color-flash-black') {
                 style.filter = `${style.filter || ''} brightness(${1 - progress})`;
             } else if (tNext === 'ripple') {
                 style.transform = `${baseTransform} scale(${1 + Math.sin(progress * Math.PI) * 0.15})`;
             } else if (tNext === 'blur-fade') {
                 style.opacity = (1 - progress) * opacity;
                 if (!isAntiLagEnabled) {
                     style.filter = `${style.filter || ''} blur(${progress * 15}px)`;
                 }
             } else if (tNext === 'rotate-zoom') {
                 style.transform = `${baseTransform} scale(${1 - progress}) rotate(${progress * 180}deg)`;
                 style.opacity = (1 - progress) * opacity;
             } else if (tNext === 'slide-up-fade') {
                 style.transform = `${baseTransform} translateY(-${progress * 60}px)`;
                 style.opacity = (1 - progress) * opacity;
             } else if (tNext === 'slide-down-fade') {
                 style.transform = `${baseTransform} translateY(${progress * 60}px)`;
                 style.opacity = (1 - progress) * opacity;
             } else if (tNext === 'squeeze-left') {
                 style.transform = `${baseTransform} scaleX(${1 - progress})`;
             } else if (tNext === 'skew-slide') {
                 style.transform = `${baseTransform} translateX(-${progress * 100}%) skewX(${-progress * 20}deg)`;
             }
         }
     }

     if (currentTime >= visualStart && currentTime < visualEnd) {
         return { clip, style, transitionActive };
     }
     return null;
  }).filter(Boolean) as { clip: TimelineClip, style: React.CSSProperties, transitionActive: boolean }[];

  const activeTextClips = clips.filter(clip => {
    return clip.type === 'text' && 
           currentTime >= clip.startTime && 
           currentTime < (clip.startTime + (clip.clipEndOffset - clip.clipStartOffset));
  });

  const activeAudioClips = clips.filter(clip => {
    return clip.type === 'audio' && 
           currentTime >= clip.startTime && 
           currentTime < (clip.startTime + (clip.clipEndOffset - clip.clipStartOffset));
  });

  const cameraClip = clips.find(c => c.type === 'camera' && currentTime >= c.startTime && currentTime < (c.startTime + (c.clipEndOffset - c.clipStartOffset)));
  
  let cameraStyle: React.CSSProperties = {};
  if (cameraClip) {
    const camInterpolated = getInterpolatedProperties(cameraClip, currentTime);
    const camScale = camInterpolated.scale ?? 1.0;
    const camPosX = camInterpolated.posX ?? 0;
    const camPosY = camInterpolated.posY ?? 0;
    const camRotation = camInterpolated.rotation ?? 0;
    const camRotationX = camInterpolated.rotationX ?? 0;
    const camRotationY = camInterpolated.rotationY ?? 0;

    cameraStyle = {
      transform: `perspective(1000px) translate3d(${-camPosX}px, ${-camPosY}px, 0px) scale(${camScale}) rotateZ(${-camRotation}deg) rotateX(${-camRotationX}deg) rotateY(${-camRotationY}deg)`,
      transformOrigin: 'center center',
      transition: 'transform 0.05s linear',
      width: '100%',
      height: '100%',
      position: 'absolute',
      inset: 0,
    };
  }

  return (
    <div 
      className="w-full h-full flex flex-col overflow-hidden relative select-none" 
      style={{ backgroundColor: backgroundColor || 'black' }}
      onMouseMove={handleMouseMove} 
      onMouseUp={() => setDraggingClip(null)} 
      onMouseLeave={() => setDraggingClip(null)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setDraggingClip(null)}
    >
      {/* SVG Chroma Key Filters definition */}
      <svg className="absolute w-0 h-0 pointer-events-none" style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {clips.map(clip => {
            if (!clip.chromaKeyEnabled) return null;
            const color = clip.chromaKeyColor || '#00ff00';
            const sim = clip.chromaKeySimilarity !== undefined ? clip.chromaKeySimilarity : 0.3;
            
            let r = 0, g = 255, b = 0;
            try {
              r = parseInt(color.slice(1, 3), 16);
              g = parseInt(color.slice(3, 5), 16);
              b = parseInt(color.slice(5, 7), 16);
            } catch(e) {}
            
            const max = Math.max(r, g, b);
            let matrixValues = "";
            if (max === g) {
              matrixValues = `-1 2 -1 0 ${-sim}`;
            } else if (max === r) {
              matrixValues = `2 -1 -1 0 ${-sim}`;
            } else {
              matrixValues = `-1 -1 2 0 ${-sim}`;
            }

            return (
              <filter id={`chroma-${clip.id}`} key={clip.id} colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${matrixValues}`} result="mask" />
                <feComponentTransfer in="mask" result="invertedMask">
                  <feFuncA type="linear" slope="-1" intercept="1" />
                </feComponentTransfer>
                <feComposite operator="in" in="SourceGraphic" in2="invertedMask" />
              </filter>
            );
          })}
        </defs>
      </svg>

      <main className="flex-1 relative bg-black flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden min-h-0">
        
        {/* Dynamic Aspect Ratio Canvas */}
        <div 
          ref={containerRef}
          style={{ aspectRatio: settings.aspectRatio, touchAction: 'none', backgroundColor: backgroundColor || '#0a0a0a' }} 
          className="h-full max-h-full max-w-full rounded-lg shadow-2xl relative flex flex-col overflow-hidden ring-1 ring-white/10"
        >
          {/* CAMERA VIEWPORT WRAPPER */}
          <div style={cameraStyle} className="w-full h-full absolute inset-0 overflow-hidden pointer-events-auto">
            {activeVisuals.length > 0 ? (
              activeVisuals.map(({ clip, style }, idx) => (
              <div 
                key={clip.id} 
                className="absolute inset-0 flex items-center justify-center overflow-hidden cursor-move" 
                style={{ zIndex: idx }} 
                onMouseDown={() => setDraggingClip(clip.id)}
                onTouchStart={(e) => handleTouchStart(clip.id, e)}
              >
                {clip.type === 'image' ? (
                  <div className="w-full h-full relative" style={style}>
                    <img 
                      src={clip.dataUrl} 
                      className={`w-full h-full ${clip.scaleMode === 'contain' ? 'object-contain' : 'object-cover'} ${clip.effect || ''}`}
                      alt={clip.name}
                      draggable={false}
                    />
                    {clip.effect === 'effect-scanline' && <div className="absolute inset-0 pointer-events-none bg-scanline-overlay" />}
                    {clip.effect === 'effect-pixelate' && <div className="absolute inset-0 pointer-events-none bg-pixelate-overlay" />}
                  </div>
                                ) : clip.type === 'video' ? (
                  <div className="w-full h-full relative" style={style}>
                    <SyncMedia 
                      clip={clip}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      className={`w-full h-full ${clip.scaleMode === 'contain' ? 'object-contain' : 'object-cover'} ${clip.effect || ''}`}
                      isAntiLagEnabled={isAntiLagEnabled}
                    />
                    {clip.effect === 'effect-scanline' && <div className="absolute inset-0 pointer-events-none bg-scanline-overlay" />}
                    {clip.effect === 'effect-pixelate' && <div className="absolute inset-0 pointer-events-none bg-pixelate-overlay" />}
                  </div>
                ) : clip.type === 'shape' ? (
                  <div 
                    className={`w-full h-full flex items-center justify-center relative ${clip.effect || ''}`}
                    style={style}
                  >
                    {renderShapeSvg(clip)}
                    {clip.effect === 'effect-scanline' && <div className="absolute inset-0 pointer-events-none bg-scanline-overlay max-w-[80%] max-h-[80%] mx-auto my-auto rounded-xl" />}
                    {clip.effect === 'effect-pixelate' && <div className="absolute inset-0 pointer-events-none bg-pixelate-overlay max-w-[80%] max-h-[80%] mx-auto my-auto rounded-xl" />}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/30 text-sm">
              <p className="text-xs tracking-widest font-mono">CANVAS</p>
            </div>
          )}

          {/* Text Layer Overlay */}
          {activeTextClips.map(clip => {
            const fontName = clip.customFontUrl ? getFontFamilyFromUrl(clip.customFontUrl, 'sans-serif') : undefined;
            const isUserFont = clip.fontFamily && clip.fontFamily.startsWith('UserFont-');
            
            const clipDuration = clip.clipEndOffset - clip.clipStartOffset;
            const globalSpeed = settings.globalAnimationSpeed !== undefined ? settings.globalAnimationSpeed : 1.0;
            const speed = (clip.animationSpeed !== undefined ? clip.animationSpeed : 1.0) * globalSpeed;
            const rawProgress = ((currentTime - clip.startTime) / clipDuration) * speed;
            const progress = Math.max(0, Math.min(1, rawProgress));

            let textToDisplay = clip.textContent || '';
            const shadowEnabled = clip.textShadowEnabled ?? true;
            const shadowColor = clip.textShadowColor || 'rgba(0,0,0,0.9)';
            const shadowBlur = clip.textShadowBlur !== undefined ? clip.textShadowBlur : 6;
            const shadowX = clip.textShadowOffsetX !== undefined ? clip.textShadowOffsetX : 2;
            const shadowY = clip.textShadowOffsetY !== undefined ? clip.textShadowOffsetY : 2;
            
            const dynamicShadow = shadowEnabled 
              ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}`
              : 'none';

            let textStyle: React.CSSProperties = {
              color: clip.textColor || '#ffffff',
              textShadow: dynamicShadow,
              fontFamily: isUserFont ? clip.fontFamily : (fontName ? `"${fontName}"` : `"${resolveFontFamily(clip.fontFamily)}"`),
              transition: 'transform 0.05s linear, opacity 0.05s linear',
            };

            const interpolated = getInterpolatedProperties(clip, currentTime);
            let posX = interpolated.posX;
            let posY = interpolated.posY;
            let scale = interpolated.scale;
            let rotation = interpolated.rotation;
            let opacity = interpolated.opacity;

            // Apply text animations dynamically based on progress
            if (clip.animationType === 'typewriter') {
              const revealProgress = Math.min(1, progress / 0.45);
              const charCount = Math.floor(textToDisplay.length * revealProgress);
              textToDisplay = textToDisplay.substring(0, charCount);
            } else if (clip.animationType === 'slide-fade-up') {
              const animProgress = Math.min(1, progress / 0.3);
              const translateY = (1 - animProgress) * 40; // Slide up from 40px below
              posY += translateY;
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'zoom-pop') {
              const animProgress = Math.min(1, progress / 0.35);
              // Elastic bounce equation
              const pScale = animProgress === 1 ? 1 : Math.sin(-13 * (Math.PI / 2) * (animProgress + 1)) * Math.pow(2, -10 * animProgress) + 1;
              scale *= pScale;
              textStyle.opacity = Math.min(1, animProgress * 1.5) * opacity;
            } else if (clip.animationType === 'glitch-shake') {
              const f = currentTime * 60;
              const shakeX = Math.sin(f * 1.5) * 6;
              const shakeY = Math.cos(f * 2.2) * 6;
              posX += shakeX;
              posY += shakeY;

              const chars = "01$#@%&*+=_<>/?[]{}█▓▒░";
              const len = textToDisplay.length;
              const revealProgress = Math.min(1, progress / 0.6);
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
              textStyle.textShadow = `${Math.sin(f * 4) * 5}px 0 #00ffff, ${Math.cos(f * 3) * -5}px 0 #ff0055, 0 0 10px rgba(0, 240, 255, 0.5)`;
              textStyle.color = clip.textColor || '#ffffff';
            } else if (clip.animationType === 'bounce-entrance') {
              const animProgress = Math.min(1, progress / 0.5);
              const n1 = 7.5625, d1 = 2.75;
              let p = 1 - animProgress;
              let ease;
              if (p < 1 / d1) { ease = n1 * p * p; }
              else if (p < 2 / d1) { ease = n1 * (p -= 1.5 / d1) * p + 0.75; }
              else if (p < 2.5 / d1) { ease = n1 * (p -= 2.25 / d1) * p + 0.9375; }
              else { ease = n1 * (p -= 2.625 / d1) * p + 0.984375; }
              const translateY = ease * -150; // Drop 150px
              posY += translateY;
              textStyle.opacity = Math.min(1, animProgress * 2) * opacity;
            } else if (clip.animationType === 'rotate-drop') {
              const animProgress = Math.min(1, progress / 0.35);
              const rRotation = (1 - animProgress) * 120; // Rotate 120 deg
              rotation += rRotation;
              scale *= animProgress;
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'rainbow-wave') {
              const hue = (currentTime * 120) % 360;
              textStyle.color = `hsl(${hue}, 90%, 65%)`;
            } else if (clip.animationType === 'soft-pulse') {
              const pulse = 1 + Math.sin(currentTime * Math.PI * 2) * 0.08;
              scale *= pulse;
            } else if (clip.animationType === 'blur-reveal') {
              const animProgress = Math.min(1, progress / 0.4);
              if (!isAntiLagEnabled) {
                const blurAmt = (1 - animProgress) * 20;
                textStyle.filter = (textStyle.filter || '') + ` blur(${blurAmt}px)`;
              }
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'letter-stagger') {
              const animProgress = Math.min(1, progress / 0.45);
              const letterSpacing = (1 - animProgress) * 15;
              textStyle.letterSpacing = `${letterSpacing}px`;
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'slide-left-wipe') {
              const animProgress = Math.min(1, progress / 0.35);
              const translateX = (1 - animProgress) * -80;
              posX += translateX;
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'spiral-in') {
              const animProgress = Math.min(1, progress / 0.45);
              const spiralRotation = (1 - animProgress) * 360;
              rotation += spiralRotation;
              scale *= animProgress;
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'flash-bang') {
              const animProgress = Math.min(1, progress / 0.3);
              if (!isAntiLagEnabled) {
                  textStyle.filter = (textStyle.filter || '') + ` brightness(${1 + (1 - animProgress) * 5}) blur(${(1 - animProgress) * 10}px)`;
              }
              scale *= (1 + (1 - animProgress) * 0.5);
              textStyle.opacity = animProgress * opacity;
            } else if (clip.animationType === 'swing-pendulum') {
              const swing = Math.sin(currentTime * Math.PI * 2.5) * 15; // Swing up to 15 degrees
              rotation += swing;
            } else if (clip.animationType === 'zoom-wobble') {
              const pScale = 1 + Math.sin(currentTime * Math.PI * 4) * 0.1;
              const pRot = Math.cos(currentTime * Math.PI * 5) * 5;
              scale *= pScale;
              rotation += pRot;
            } else if (clip.animationType === 'slide-bounce-right') {
              const animProgress = Math.min(1, progress / 0.5);
              const n1 = 7.5625, d1 = 2.75;
              let p = 1 - animProgress;
              let ease;
              if (p < 1 / d1) { ease = n1 * p * p; }
              else if (p < 2 / d1) { ease = n1 * (p -= 1.5 / d1) * p + 0.75; }
              else if (p < 2.5 / d1) { ease = n1 * (p -= 2.25 / d1) * p + 0.9375; }
              else { ease = n1 * (p -= 2.625 / d1) * p + 0.984375; }
              const translateX = ease * -100;
              posX += translateX;
              textStyle.opacity = Math.min(1, animProgress * 2) * opacity;
            } else if (clip.animationType === 'blur-in-out') {
              // Fade in for first 20%, fade out for last 20%
              let fadeProgress = 1;
              let blurProgress = 0;
              if (progress < 0.2) {
                  fadeProgress = progress / 0.2;
                  blurProgress = (1 - fadeProgress) * 20;
              } else if (progress > 0.8) {
                  fadeProgress = (1 - progress) / 0.2;
                  blurProgress = (1 - fadeProgress) * 20;
              }
              textStyle.opacity = fadeProgress * opacity;
              if (!isAntiLagEnabled && blurProgress > 0) {
                  textStyle.filter = (textStyle.filter || '') + ` blur(${blurProgress}px)`;
              }
            }

            // Apply base opacity if not overwritten by animation
            if (textStyle.opacity === undefined) {
                textStyle.opacity = opacity;
            }

            textStyle.transform = `translate(${posX * scaleFactor}px, ${posY * scaleFactor}px) scale(${scale}) rotate(${rotation}deg)`;
            if (clip.filter && !isAntiLagEnabled) {
              textStyle.filter = clip.filter;
            }

            const fontClassName = (!fontName && !isUserFont) ? (clip.fontFamily || 'font-sans') : '';

            return (
              <div 
                key={clip.id} 
                className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-40"
              >
                {clip.customFontUrl && (
                  <link rel="stylesheet" href={clip.customFontUrl} />
                )}
                <span 
                  className={`text-3xl md:text-4xl text-center break-words select-none pointer-events-auto cursor-move active:scale-105 transition-transform duration-100 ${fontClassName} ${clip.effect || ''}`}
                  style={textStyle}
                  onMouseDown={() => setDraggingClip(clip.id)}
                  onTouchStart={(e) => handleTouchStart(clip.id, e)}
                >
                  {textToDisplay}
                </span>
              </div>
            );
          })}
          </div>

          {/* CAMERA VIEWFINDER OVERLAY */}
          {cameraClip && (
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-emerald-500 z-40 flex flex-col justify-between p-3">
              {/* White viewport corner notches */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white" />
              
              {/* Viewfinder indicators */}
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[9px] font-bold text-emerald-400 font-mono tracking-wider">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>CÂMERA ATIVA</span>
                </div>
                <div className="bg-black/60 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[9px] font-bold text-white font-mono tracking-wider font-semibold">
                  ZOOM: {cameraClip.scale?.toFixed(1) ?? '1.0'}x
                </div>
              </div>
              
              <div className="flex justify-between items-end w-full">
                <div className="text-[9px] font-bold text-white/70 font-mono bg-black/40 px-1.5 py-0.5 rounded">
                  PAN: {Math.round(cameraClip.posX || 0)}px, {Math.round(cameraClip.posY || 0)}px
                </div>
                <div className="text-[9px] font-bold text-emerald-400 font-mono tracking-widest bg-black/40 px-1.5 py-0.5 rounded">
                  {settings.aspectRatio}
                </div>
              </div>
            </div>
          )}

          {/* Hidden Audio Elements */}
          {activeAudioClips.map(clip => (
            <SyncMedia 
              key={clip.id}
              clip={clip}
              currentTime={currentTime}
              isPlaying={isPlaying}
              isAntiLagEnabled={isAntiLagEnabled}
            />
          ))}

          {/* HUD Overlay (Subtle) */}
          {theme !== 'nostalgia' && (
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-50">
              <div className="px-3 py-1.5 rounded-md bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white shadow-lg">
                {formatTime(currentTime)}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Transport Controls */}
      {theme !== 'nostalgia' && (
        <div className="h-14 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-center gap-4 shrink-0 relative z-50 px-4">
          <button onClick={onStop} className="p-2 text-slate-400 hover:text-white transition-colors group" title="Parar">
            <Square className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
          </button>
          
          <button 
            onClick={onPlayPause}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:scale-105"
            title={isPlaying ? "Pausar" : "Iniciar"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Botão de Marcar Tempo (Símbolo de quadrado verde) */}
          <button 
            onClick={() => onToggleMarker?.(currentTime)}
            className="p-2 border border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-950/20 rounded text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Marcar Tempo (Adicionar/Remover Marcador)"
          >
            <div className="w-3.5 h-3.5 bg-emerald-500 rounded-sm shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Marcar</span>
          </button>

          {/* Botão de Ir para o Final da Timeline */}
          <button 
            onClick={() => onSeek?.(duration)}
            className="p-2 border border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-950/20 rounded text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
            title="Ir para o Final da Timeline"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Ir para o Final</span>
            <span className="text-xs font-mono font-bold">▶|</span>
          </button>

          {/* Ir para o tempo de marcadores */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded px-1.5 py-1">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onSeek?.(parseFloat(e.target.value));
                  e.target.value = "";
                }
              }}
              className="bg-transparent text-slate-300 text-[10px] focus:outline-none cursor-pointer font-mono font-bold"
            >
              <option value="" className="bg-[#101010] text-slate-400">Ir para o tempo...</option>
              {markers.map((m, idx) => (
                <option key={idx} value={m} className="bg-[#101010] text-white">
                  Marcador {idx + 1}: {formatTime(m)}
                </option>
              ))}
              {markers.length === 0 && (
                <option disabled className="bg-[#101010] text-slate-600">Sem marcadores</option>
              )}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
