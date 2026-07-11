export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text' | 'shape' | 'camera';
  name: string;
  dataUrl: string;
  duration: number; // default duration, e.g. 3s for images
  file?: File;
}

export interface Keyframe {
  id: string;
  time: number; // percentage from 0 to 100
  scale?: number;
  rotation?: number;
  posX?: number;
  posY?: number;
  opacity?: number;
  easing?: string;
}

export interface TimelineClip extends MediaItem {
  trackId: string;
  startTime: number; 
  clipStartOffset: number; // for trimming
  clipEndOffset: number;
  // Text specific
  textContent?: string;
  fontFamily?: string;
  textColor?: string;
  customFontUrl?: string;
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowEnabled?: boolean;
  // Effects and filters
  filter?: string;
  effect?: string;
  // Transitions
  transitionNext?: string;
  transitionIn?: string;
  transitionInDuration?: number;
  transitionOut?: string;
  transitionOutDuration?: number;
  // Transform
  posX?: number;
  posY?: number;
  scale?: number;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  opacity?: number;
  // Animation / Keyframes
  animationType?: string;
  animationSpeed?: number;
  easing?: string;
  bezierPoints?: [number, number, number, number];
  keyframes?: Keyframe[];
  // Audio FX processing
  audioVolume?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  audioPitch?: number;
  audioBass?: number;
  audioTreble?: number;
  audioLowpass?: number;
  audioReverb?: number;
  audioDistortion?: number;
  audioTremolo?: number;
  audioPhaser?: number;
  scaleMode?: 'cover' | 'contain';
  blendMode?: string;
  // Shape specific
  shapeType?: 'circle' | 'square' | 'triangle' | 'star-4' | 'star-5' | 'oval-custom';
  shapeColor?: string;
  shapeBorderColor?: string;
  shapeBorderWidth?: number;
  // Chroma Key (Green Screen) specific
  chromaKeyEnabled?: boolean;
  chromaKeyColor?: string;
  chromaKeySimilarity?: number;
}
