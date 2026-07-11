import React, { useEffect, useRef, useState } from 'react';
import { TimelineClip } from '../types';
import { 
  X, Trash2, MoveRight, TrendingUp, TrendingDown, 
  Shuffle, Compass, Flame, Activity, Zap, PenTool, Play
} from 'lucide-react';
import { cn, getInterpolatedProperties } from '../utils';

interface ClipEditorProps {
  clip: TimelineClip;
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
  onRemoveClip: (id: string) => void;
  onCommitChange: () => void;
  onClose?: () => void;
  importedFonts?: { name: string; file: string }[];
  onImportFont?: (name: string, file: string) => void;
  currentTime?: number;
  setCurrentTime?: (time: number) => void;
  keyframeMode: 'simple' | 'advanced';
  selectedKeyframeId: string | null;
  onUpdateKeyframe: (clipId: string, kfId: string, updates: Partial<any>) => void;
}

export function getEasingIcon(easing?: string) {
  const size = "w-3.5 h-3.5";
  switch (easing) {
    case 'linear':
      return <MoveRight className={`${size} text-sky-400`} title="Linear" />;
    case 'ease-in':
      return <TrendingUp className={`${size} text-amber-400`} title="Ease In" />;
    case 'ease-out':
      return <TrendingDown className={`${size} text-emerald-400`} title="Ease Out" />;
    case 'ease-in-out':
      return <Shuffle className={`${size} text-indigo-400`} title="Ease In-Out" />;
    case 'sine-in-out':
    case 'ease-in-sine':
    case 'ease-out-sine':
      return <Compass className={`${size} text-purple-400`} title="Sine Easing" />;
    case 'ease-in-back':
    case 'ease-out-back':
    case 'ease-in-out-back':
      return <Flame className={`${size} text-orange-400`} title="Back Easing" />;
    case 'elastic':
      return <Activity className={`${size} text-pink-400 animate-pulse`} title="Elastic" />;
    case 'bounce':
    case 'bounce-twice':
      return <Zap className={`${size} text-yellow-400`} title="Bounce" />;
    case 'custom-bezier':
      return <PenTool className={`${size} text-violet-400`} title="Custom Bezier" />;
    default:
      return <MoveRight className={`${size} text-slate-500`} />;
  }
}

function BezierVisualizer({ points }: { points: [number, number, number, number] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [x1, y1, x2, y2] = points;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }

    // Handles line guide
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(x1 * w, h - y1 * h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(x2 * w, h - y2 * h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h);
    
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const cx = 3 * Math.pow(1 - t, 2) * t * x1 + 3 * (1 - t) * Math.pow(t, 2) * x2 + Math.pow(t, 3);
      const cy = 3 * Math.pow(1 - t, 2) * t * y1 + 3 * (1 - t) * Math.pow(t, 2) * x2 + Math.pow(t, 3);
      ctx.lineTo(cx * w, h - cy * h);
    }
    ctx.stroke();

    // Endpoints & handle points
    ctx.fillStyle = '#ef4444'; // Red for handles
    ctx.beginPath();
    ctx.arc(x1 * w, h - y1 * h, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3b82f6'; // Blue for handles
    ctx.beginPath();
    ctx.arc(x2 * w, h - y2 * h, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, h, 4, 0, Math.PI * 2);
    ctx.arc(w, 0, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [points]);

  return (
    <div className="flex flex-col items-center bg-[#151515] p-2 rounded-lg border border-white/5 space-y-1">
      <canvas ref={canvasRef} width={80} height={80} className="bg-black/40 rounded border border-white/10" />
      <div className="flex items-center gap-2 text-[8px] font-mono text-slate-400">
        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>P1 ({x1.toFixed(2)}, {y1.toFixed(2)})</span>
        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>P2 ({x2.toFixed(2)}, {y2.toFixed(2)})</span>
      </div>
    </div>
  );
}

export function ClipEditor({ 
  clip, 
  onUpdateClip, 
  onRemoveClip, 
  onCommitChange, 
  onClose, 
  importedFonts, 
  onImportFont,
  currentTime = 0,
  setCurrentTime,
  keyframeMode,
  selectedKeyframeId,
  onUpdateKeyframe
}: ClipEditorProps) {
  const isText = clip.type === 'text';
  const isVisual = clip.type === 'image' || clip.type === 'video';
  const isShape = clip.type === 'shape';
  const isCamera = clip.type === 'camera';
  const [activeTab, setActiveTab] = useState<'basics' | 'motion' | 'fx'>('basics');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Disabled manual touch scroll interception on properties panel to allow native high-momentum mobile scrolling

  const clipDuration = clip.clipEndOffset - clip.clipStartOffset;
  const currentProgressPercent = clipDuration > 0 
    ? Math.max(0, Math.min(100, Math.round(((currentTime - clip.startTime) / clipDuration) * 100))) 
    : 0;

  const handleAddKeyframe = () => {
    console.log("Adding keyframe with clip properties:", {
      scale: interpolated.scale,
      rotation: interpolated.rotation,
      posX: interpolated.posX,
      posY: interpolated.posY
    });
    const kfs = clip.keyframes ? [...clip.keyframes] : [];
    const existingIndex = kfs.findIndex(k => k.time === currentProgressPercent);
    
    const newKf = {
      id: Math.random().toString(36).substring(2, 11),
      time: currentProgressPercent,
      scale: interpolated.scale ?? 1.0,
      rotation: interpolated.rotation ?? 0,
      posX: interpolated.posX ?? 0,
      posY: interpolated.posY ?? 0,
      rotationX: (interpolated as any).rotationX ?? 0,
      rotationY: (interpolated as any).rotationY ?? 0,
      easing: clip.easing || 'linear'
    };

    if (existingIndex >= 0) {
      kfs[existingIndex] = newKf;
    } else {
      kfs.push(newKf);
    }
    
    kfs.sort((a, b) => a.time - b.time);
    
    onUpdateClip(clip.id, { keyframes: kfs });
    onCommitChange();
  };

  const handleRemoveKeyframe = (kfId: string) => {
    if (!clip.keyframes) return;
    const kfs = clip.keyframes.filter(k => k.id !== kfId);
    onUpdateClip(clip.id, { keyframes: kfs });
    onCommitChange();
  };

  const interpolated = getInterpolatedProperties(clip, currentTime);

  const existingKeyframe = clip.keyframes?.find(kf => kf.time === currentProgressPercent);

  const handlePropertyChange = (property: 'posX' | 'posY' | 'scale' | 'rotation' | 'opacity' | 'rotationX' | 'rotationY', val: number) => {
    const hasKeyframes = clip.keyframes && clip.keyframes.length > 0;
    
    if (hasKeyframes) {
      const kfs = [...clip.keyframes!];
      const index = kfs.findIndex(kf => kf.time === currentProgressPercent);
      if (index !== -1) {
        // Update existing keyframe in single state update to avoid batching race conditions
        const updatedKfs = kfs.map((kf, i) => i === index ? { ...kf, [property]: val } : kf);
        onUpdateClip(clip.id, { keyframes: updatedKfs, [property]: val });
      } else {
        // Auto-create a keyframe at current progress percent
        const newKf = {
          id: Math.random().toString(36).substring(2, 11),
          time: currentProgressPercent,
          scale: property === 'scale' ? val : (interpolated.scale ?? 1.0),
          rotation: property === 'rotation' ? val : (interpolated.rotation ?? 0),
          posX: property === 'posX' ? val : (interpolated.posX ?? 0),
          posY: property === 'posY' ? val : (interpolated.posY ?? 0),
          rotationX: property === 'rotationX' ? val : ((interpolated as any).rotationX ?? 0),
          rotationY: property === 'rotationY' ? val : ((interpolated as any).rotationY ?? 0),
          opacity: clip.opacity ?? 1.0,
          easing: 'linear'
        };
        const updatedKfs = [...kfs, newKf].sort((a, b) => a.time - b.time);
        onUpdateClip(clip.id, { keyframes: updatedKfs, [property]: val });
      }
    } else {
      // Always update the clip's base properties if no keyframes
      onUpdateClip(clip.id, { [property]: val });
    }
  };

  const toggleKeyframeAtCurrentTime = (property?: string, value?: number) => {
    const kfs = clip.keyframes ? [...clip.keyframes] : [];
    const index = kfs.findIndex(kf => kf.time === currentProgressPercent);
    if (index !== -1) {
      kfs.splice(index, 1);
      onUpdateClip(clip.id, { keyframes: kfs });
    } else {
      const newKf = {
        id: Math.random().toString(36).substring(2, 11),
        time: currentProgressPercent,
        scale: interpolated.scale ?? 1.0,
        rotation: interpolated.rotation ?? 0,
        posX: interpolated.posX ?? 0,
        posY: interpolated.posY ?? 0,
        rotationX: (interpolated as any).rotationX ?? 0,
        rotationY: (interpolated as any).rotationY ?? 0,
        opacity: clip.opacity ?? 1.0,
        easing: 'linear'
      };
      if (property !== undefined && value !== undefined) {
        (newKf as any)[property] = value;
      }
      kfs.push(newKf);
      kfs.sort((a, b) => a.time - b.time);
      onUpdateClip(clip.id, { keyframes: kfs });
    }
    onCommitChange();
  };

  const fonts = [
    { value: 'font-sans', label: 'Inter (Sans)' },
    { value: 'font-mono', label: 'JetBrains (Mono)' },
    { value: 'font-bebas', label: 'Bebas Neue' },
    { value: 'font-pacifico', label: 'Pacifico' },
    { value: 'font-oswald', label: 'Oswald' },
    { value: 'Anton', label: 'Anton (Impact)' },
    { value: 'Cinzel', label: 'Cinzel (Elegant Serif)' },
    { value: 'Lobster', label: 'Lobster (Playful Script)' },
    { value: 'Creepster', label: 'Creepster (Spooky)' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Merriweather', label: 'Merriweather' },
    { value: 'Nunito', label: 'Nunito' },
    { value: 'Raleway', label: 'Raleway' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Ubuntu', label: 'Ubuntu' },
    { value: 'Mukta', label: 'Mukta' },
    { value: 'Lora', label: 'Lora' },
    { value: 'Rubik', label: 'Rubik' },
    { value: 'Noto Sans', label: 'Noto Sans' },
    { value: 'Work Sans', label: 'Work Sans' },
    { value: 'Fira Sans', label: 'Fira Sans' },
    { value: 'Quicksand', label: 'Quicksand' },
    { value: 'Karla', label: 'Karla' },
    { value: 'Inconsolata', label: 'Inconsolata' },
    { value: 'Josefin Sans', label: 'Josefin Sans' },
    ...(importedFonts || []).map(f => ({ value: f.name, label: `📁 ${f.file}` })),
  ];

  const filters = [
    { value: '', label: 'Nenhum' },
    { value: 'grayscale(100%)', label: 'P&B (Filtro)' },
    { value: 'sepia(100%)', label: 'Sépia (Filtro)' },
    { value: 'invert(100%)', label: 'Inverter (Filtro)' },
    { value: 'saturate(200%)', label: 'Vibrante (Filtro)' },
    { value: 'hue-rotate(90deg)', label: 'Psicodélico (Filtro)' },
    { value: 'contrast(150%)', label: 'Contraste Alto (Filtro)' },
    { value: 'brightness(150%)', label: 'Claro (Filtro)' },
    { value: 'blur(4px)', label: 'Desfoque (Filtro)' },
    { value: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))', label: 'Sombra Escura' },
    { value: 'saturate(300%) hue-rotate(180deg)', label: 'Cyberpunk' },
    { value: 'sepia(50%) hue-rotate(30deg) saturate(150%)', label: 'Golden Hour' },
    { value: 'grayscale(100%) contrast(200%)', label: 'Noir' },
    { value: 'brightness(80%) saturate(120%) contrast(110%)', label: 'Cinema' },
    { value: 'hue-rotate(-45deg) saturate(180%)', label: 'Neon' },
  ];

  const effects = [
    { value: '', label: 'Nenhum' },
    { value: 'effect-glitch', label: 'Glitch' },
    { value: 'effect-vintage', label: 'Vintage' },
    { value: 'effect-zoom', label: 'Zoom in/out' },
    { value: 'effect-shake', label: 'Tremor' },
    { value: 'effect-bounce', label: 'Salto' },
    { value: 'effect-motion-blur', label: 'Motion Blur' },
    { value: 'effect-scanline', label: '📺 CRT Retro TV & Scanline' },
    { value: 'effect-rgb-split', label: '🌈 Separação RGB / Aberração' },
    { value: 'effect-pulse', label: '🌟 Pulso de Luz Neon' },
    { value: 'effect-pixelate', label: '👾 Retro Pixel Art (8-bit)' },
    { value: 'effect-acid-trip', label: '🍄 Acid Trip Psicodélico' },
  ];

  const bezierPoints = clip.bezierPoints || [0.25, 0.1, 0.25, 1.0];

  const handleBezierChange = (index: number, val: number) => {
    const newPoints = [...bezierPoints] as [number, number, number, number];
    newPoints[index] = val;
    onUpdateClip(clip.id, { bezierPoints: newPoints });
  };

  const handleApplyPreset = (presetName: string) => {
    let updates: Partial<TimelineClip> = {};
    if (presetName === 'cinema') {
      updates = {
        animationType: 'pan-right',
        easing: 'ease-out',
        scale: 1.15,
        rotation: 0
      };
    } else if (presetName === 'zoom') {
      updates = {
        animationType: 'zoom-in',
        easing: 'sine-in-out',
        scale: 1.0,
        rotation: 0
      };
    } else if (presetName === 'bounce') {
      updates = {
        animationType: 'zoom-in',
        easing: 'bounce',
        scale: 1.1,
        rotation: 0
      };
    } else if (presetName === 'wobble') {
      updates = {
        animationType: 'wobble',
        easing: 'elastic',
        scale: 1.15,
        rotation: 12
      };
    } else if (presetName === 'pop') {
      updates = {
        animationType: 'zoom-in',
        easing: 'custom-bezier',
        bezierPoints: [0.34, 1.56, 0.64, 1.0],
        scale: 1.0,
        rotation: 0
      };
    }
    onUpdateClip(clip.id, updates);
    onCommitChange();
  };

  return (
    <div className="w-full h-full bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Title & Close */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Painel de Edição de Propriedades</h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onRemoveClip(clip.id)}
            className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-white/5 transition-colors cursor-pointer"
            title="Excluir este clipe"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-[#0e0e0e] shrink-0 text-[10px] font-bold uppercase tracking-wider">
        <button 
          onClick={() => setActiveTab('basics')} 
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'basics' ? 'border-indigo-500 text-indigo-400 bg-white/[0.01]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          🎛️ Básico & Trimming
        </button>
        {(isVisual || isText || isShape || isCamera) && (
          <button 
            onClick={() => { setActiveTab('motion'); }} 
            className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'motion' ? 'border-indigo-500 text-indigo-400 bg-white/[0.01]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            📈 Keyframes & Movimento
          </button>
        )}
        <button 
          onClick={() => { setActiveTab('fx'); }} 
          className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'fx' ? 'border-indigo-500 text-indigo-400 bg-white/[0.01]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          {clip.type === 'audio' ? '🔊 Efeitos de Áudio (FX)' : '👾 Filtros & FX'}
        </button>
      </div>

      {/* Bento Grid Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#070707]">
        
        {/* Tab 1: Basics & Trimming */}
        {activeTab === 'basics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Section 1: Core parameters & Trimming */}
            <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
              <h4 className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Tempo & Trimming
              </h4>
              
              <div className="space-y-2">
                <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">Duração e Trimming (s)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between border border-white/5">
                    <span className="text-[9px] text-slate-500 font-mono">Início</span>
                    <input 
                      type="number" 
                      className="w-14 bg-transparent text-white text-xs text-right outline-none font-mono"
                      value={clip.clipStartOffset}
                      step="0.1"
                      min="0"
                      onChange={(e) => onUpdateClip(clip.id, { clipStartOffset: Math.max(0, parseFloat(e.target.value) || 0) })}
                      onBlur={onCommitChange}
                    />
                  </div>
                  <div className="flex-1 bg-black/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between border border-white/5">
                    <span className="text-[9px] text-slate-500 font-mono">Fim</span>
                    <input 
                      type="number" 
                      className="w-14 bg-transparent text-white text-xs text-right outline-none font-mono"
                      value={clip.clipEndOffset}
                      step="0.1"
                      min="0.1"
                      onChange={(e) => onUpdateClip(clip.id, { clipEndOffset: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                      onBlur={onCommitChange}
                    />
                  </div>
                </div>
              </div>

              {isText && (
                <div className="space-y-3 pt-2">
                  <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">Conteúdo do Texto</label>
                  <textarea
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none h-16 font-sans leading-relaxed"
                    value={clip.textContent || ''}
                    onChange={(e) => onUpdateClip(clip.id, { textContent: e.target.value })}
                    onBlur={onCommitChange}
                    placeholder="Digite seu texto incrível aqui..."
                  />
                </div>
              )}
            </div>

            {/* Section 2: Fonts & Colors (Only for Text) */}
            {isText && (
              <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Estilo de Tipografia
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500 mb-1 block">Cor do Texto</label>
                    <div className="flex items-center gap-2 bg-black/40 px-2 py-1.5 rounded border border-white/5">
                      <input 
                        type="color" 
                        value={clip.textColor || '#ffffff'}
                        onChange={(e) => onUpdateClip(clip.id, { textColor: e.target.value })}
                        onBlur={onCommitChange}
                        className="w-6 h-6 bg-transparent cursor-pointer rounded border-0"
                      />
                      <span className="text-[10px] font-mono text-slate-400">{clip.textColor || '#ffffff'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 mb-1 block">Escolha a Fonte</label>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-mono"
                      value={clip.fontFamily || 'font-sans'}
                      onChange={(e) => { onUpdateClip(clip.id, { fontFamily: e.target.value }); onCommitChange(); }}
                    >
                      {fonts.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* LOCAL FONT IMPORT FROM DEVICE BUTTON */}
                <div className="bg-indigo-500/5 border border-indigo-500/10 p-2.5 rounded-lg space-y-2">
                  <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider block">🔌 Importar Fonte do Dispositivo (.ttf, .otf, .woff)</span>
                  <p className="text-[8px] text-slate-400 leading-normal">
                    Selecione qualquer fonte do seu dispositivo e use instantaneamente no editor de vídeo!
                  </p>
                  <label className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded-md text-[10px] transition-all cursor-pointer">
                    <span>Importar Arquivo de Fonte</span>
                    <input 
                      type="file" 
                      accept=".ttf,.otf,.woff,.woff2" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const result = ev.target?.result;
                          if (typeof result === 'string') {
                            const fontName = `UserFont-${file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-")}`;
                            const fontFace = new FontFace(fontName, `url(${result})`);
                            try {
                              await fontFace.load();
                              document.fonts.add(fontFace);
                              if (onImportFont) {
                                onImportFont(fontName, file.name);
                              }
                              onUpdateClip(clip.id, { fontFamily: fontName });
                              onCommitChange();
                              alert(`Fonte "${file.name}" importada e aplicada com sucesso!`);
                            } catch (err) {
                              alert("Não foi possível carregar esta fonte do dispositivo.");
                            }
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>

                {/* Text Shadow Controls */}
                <div className="border-t border-white/5 pt-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={clip.textShadowEnabled ?? true}
                        onChange={(e) => { onUpdateClip(clip.id, { textShadowEnabled: e.target.checked }); onCommitChange(); }}
                        className="rounded bg-black border-white/10 text-indigo-500 focus:ring-0 cursor-pointer"
                      />
                      Sombra de Texto
                    </label>
                    <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                      <input 
                        type="color"
                        value={clip.textShadowColor || '#000000'}
                        disabled={!(clip.textShadowEnabled ?? true)}
                        onChange={(e) => onUpdateClip(clip.id, { textShadowColor: e.target.value })}
                        onBlur={onCommitChange}
                        className="w-4 h-4 bg-transparent cursor-pointer rounded border-0 disabled:opacity-30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                        <span>Intensidade do Desfoque (Blur)</span>
                        <span className="font-mono text-slate-400">{clip.textShadowBlur !== undefined ? clip.textShadowBlur : 6}px</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="20"
                        step="0.5"
                        value={clip.textShadowBlur !== undefined ? clip.textShadowBlur : 6}
                        disabled={!(clip.textShadowEnabled ?? true)}
                        onChange={(e) => onUpdateClip(clip.id, { textShadowBlur: parseFloat(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                          <span>Afastamento X</span>
                          <span className="font-mono text-slate-400">{clip.textShadowOffsetX !== undefined ? clip.textShadowOffsetX : 2}px</span>
                        </div>
                        <input 
                          type="range"
                          min="-15"
                          max="15"
                          step="0.5"
                          value={clip.textShadowOffsetX !== undefined ? clip.textShadowOffsetX : 2}
                          disabled={!(clip.textShadowEnabled ?? true)}
                          onChange={(e) => onUpdateClip(clip.id, { textShadowOffsetX: parseFloat(e.target.value) })}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-30"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                          <span>Afastamento Y</span>
                          <span className="font-mono text-slate-400">{clip.textShadowOffsetY !== undefined ? clip.textShadowOffsetY : 2}px</span>
                        </div>
                        <input 
                          type="range"
                          min="-15"
                          max="15"
                          step="0.5"
                          value={clip.textShadowOffsetY !== undefined ? clip.textShadowOffsetY : 2}
                          disabled={!(clip.textShadowEnabled ?? true)}
                          onChange={(e) => onUpdateClip(clip.id, { textShadowOffsetY: parseFloat(e.target.value) })}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-30"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2b: Shape Properties (Only for Shapes) */}
            {isShape && (
              <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Estilo do Elemento (Forma)
                </h4>

                <div className="space-y-3.5">
                  {/* Shape Type */}
                  <div>
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Tipo de Forma</label>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                      value={clip.shapeType || 'circle'}
                      onChange={(e) => { onUpdateClip(clip.id, { shapeType: e.target.value as any }); onCommitChange(); }}
                    >
                      <option value="circle">🟢 Círculo</option>
                      <option value="square">⬜ Quadrado</option>
                      <option value="triangle">🔺 Triângulo</option>
                      <option value="star-4">✦ Estrela 4 Pontas</option>
                      <option value="star-5">★ Estrela 5 Pontas</option>
                      <option value="oval-custom">🥚 Oval Customizado</option>
                    </select>
                  </div>

                  {/* Colors */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 mb-1 block">Cor de Preenchimento</label>
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5">
                        <input 
                          type="color" 
                          value={clip.shapeColor || '#6366f1'}
                          onChange={(e) => onUpdateClip(clip.id, { shapeColor: e.target.value })}
                          onBlur={onCommitChange}
                          className="w-5 h-5 bg-transparent cursor-pointer rounded border-0 p-0"
                        />
                        <span className="text-[9px] font-mono text-slate-400 truncate">{clip.shapeColor || '#6366f1'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 mb-1 block">Cor da Borda</label>
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5">
                        <input 
                          type="color" 
                          value={clip.shapeBorderColor || '#ffffff'}
                          onChange={(e) => onUpdateClip(clip.id, { shapeBorderColor: e.target.value })}
                          onBlur={onCommitChange}
                          className="w-5 h-5 bg-transparent cursor-pointer rounded border-0 p-0"
                        />
                        <span className="text-[9px] font-mono text-slate-400 truncate">{clip.shapeBorderColor || '#ffffff'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Border Width */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-400 font-medium">Largura da Borda</span>
                      <span className="text-[9px] font-mono text-indigo-400 font-semibold">{clip.shapeBorderWidth ?? 2}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="20" 
                      step="1"
                      value={clip.shapeBorderWidth ?? 2}
                      onChange={(e) => onUpdateClip(clip.id, { shapeBorderWidth: parseInt(e.target.value) })}
                      onMouseUp={onCommitChange}
                      onTouchEnd={onCommitChange}
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Visual Transform & Positioning (Only for Images/Videos/Texts/Shapes/Cameras) */}
            {(isVisual || isText || isShape || isCamera) && (
              <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-violet-400 tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  Transformar & Posicionar
                </h4>
                <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-3 text-xs">
                  {/* Position X Slider with Keyframe */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-400 font-medium">Posição X</span>
                      <span className="text-[9px] font-mono text-indigo-400 font-semibold">{Math.round(interpolated.posX || 0)}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="-1000" 
                        max="1000" 
                        step="1"
                        value={Math.round(interpolated.posX || 0)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handlePropertyChange('posX', val);
                        }}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <button
                        onClick={() => toggleKeyframeAtCurrentTime('posX', interpolated.posX ?? 0)}
                        className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                        title={existingKeyframe ? "Remover Keyframe de Posição X" : "Inserir Keyframe de Posição X"}
                      >
                        {existingKeyframe ? '◆' : '◇'}
                      </button>
                    </div>
                  </div>

                  {/* Position Y Slider with Keyframe */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-400 font-medium">Posição Y</span>
                      <span className="text-[9px] font-mono text-indigo-400 font-semibold">{Math.round(interpolated.posY || 0)}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="-1000" 
                        max="1000" 
                        step="1"
                        value={Math.round(interpolated.posY || 0)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handlePropertyChange('posY', val);
                        }}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <button
                        onClick={() => toggleKeyframeAtCurrentTime('posY', interpolated.posY ?? 0)}
                        className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                        title={existingKeyframe ? "Remover Keyframe de Posição Y" : "Inserir Keyframe de Posição Y"}
                      >
                        {existingKeyframe ? '◆' : '◇'}
                      </button>
                    </div>
                  </div>

                  {/* Scale with Keyframe */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-400 font-medium">Escala</span>
                      <span className="text-[9px] font-mono text-indigo-400 font-semibold">{(interpolated.scale ?? 1.0).toFixed(2)}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="0.1" 
                        max="4.0" 
                        step="0.05"
                        value={interpolated.scale ?? 1.0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handlePropertyChange('scale', val);
                        }}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <button
                        onClick={() => toggleKeyframeAtCurrentTime('scale', interpolated.scale ?? 1.0)}
                        className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                        title={existingKeyframe ? "Remover Keyframe de Escala" : "Inserir Keyframe de Escala"}
                      >
                        {existingKeyframe ? '◆' : '◇'}
                      </button>
                    </div>
                  </div>

                  {/* Rotation with Keyframe */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-400 font-medium">Rotação</span>
                      <span className="text-[9px] font-mono text-indigo-400 font-semibold">{(interpolated.rotation || 0)}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="-180" 
                        max="180" 
                        step="1"
                        value={interpolated.rotation || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handlePropertyChange('rotation', val);
                        }}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <button
                        onClick={() => toggleKeyframeAtCurrentTime('rotation', interpolated.rotation || 0)}
                        className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                        title={existingKeyframe ? "Remover Keyframe de Rotação" : "Inserir Keyframe de Rotação"}
                      >
                        {existingKeyframe ? '◆' : '◇'}
                      </button>
                    </div>
                  </div>

                  {/* 3D Rotation X (Only for Camera) */}
                  {isCamera && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium text-emerald-400">Rotação 3D X (Inclinação)</span>
                        <span className="text-[9px] font-mono text-emerald-400 font-semibold">{Math.round((interpolated as any).rotationX || 0)}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="-90" 
                          max="90" 
                          step="1"
                          value={((interpolated as any).rotationX || 0)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handlePropertyChange('rotationX', val);
                          }}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                          className="flex-1 accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <button
                          onClick={() => toggleKeyframeAtCurrentTime('rotationX', (interpolated as any).rotationX || 0)}
                          className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                          title={existingKeyframe ? "Remover Keyframe de Rotação 3D X" : "Inserir Keyframe de Rotação 3D X"}
                        >
                          {existingKeyframe ? '◆' : '◇'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3D Rotation Y (Only for Camera) */}
                  {isCamera && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium text-emerald-400">Rotação 3D Y (Giro Lateral)</span>
                        <span className="text-[9px] font-mono text-emerald-400 font-semibold">{Math.round((interpolated as any).rotationY || 0)}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="-90" 
                          max="90" 
                          step="1"
                          value={((interpolated as any).rotationY || 0)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handlePropertyChange('rotationY', val);
                          }}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                          className="flex-1 accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <button
                          onClick={() => toggleKeyframeAtCurrentTime('rotationY', (interpolated as any).rotationY || 0)}
                          className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                          title={existingKeyframe ? "Remover Keyframe de Rotação 3D Y" : "Inserir Keyframe de Rotação 3D Y"}
                        >
                          {existingKeyframe ? '◆' : '◇'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Opacity with Keyframe */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-400 font-medium">Opacidade</span>
                      <span className="text-[9px] font-mono text-indigo-400 font-semibold">{Math.round((interpolated.opacity ?? 1.0) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="1"
                        value={(interpolated.opacity ?? 1.0) * 100}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          handlePropertyChange('opacity', val);
                        }}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <button
                        onClick={() => toggleKeyframeAtCurrentTime('opacity', interpolated.opacity ?? 1.0)}
                        className={`p-1.5 rounded bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all ${existingKeyframe ? 'text-amber-400 font-bold scale-110 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}
                        title={existingKeyframe ? "Remover Keyframe de Opacidade" : "Inserir Keyframe de Opacidade"}
                      >
                        {existingKeyframe ? '◆' : '◇'}
                      </button>
                    </div>
                  </div>

                  {/* Scale Mode (Cover or Contain) - Only for image and video */}
                  {isVisual && (
                    <div className="pt-1.5 border-t border-white/[0.03]">
                      <label className="text-[9px] text-slate-400 block mb-1 font-semibold uppercase tracking-wider">Modo de Escala (Ajuste)</label>
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        value={clip.scaleMode || 'cover'}
                        onChange={(e) => { onUpdateClip(clip.id, { scaleMode: e.target.value as 'cover' | 'contain' }); onCommitChange(); }}
                      >
                        <option value="cover">Cortar para Preencher (Cover)</option>
                        <option value="contain">Ajustar Inteiro (Contain - Sem Cortes)</option>
                      </select>
                      <p className="text-[7px] text-slate-500 mt-1 leading-normal font-mono">
                        "Cover" preenche a tela inteira. "Contain" mostra a imagem original inteira sem cortes nas bordas.
                      </p>
                    </div>
                  )}

                  {/* Mix Blend Mode */}
                  {isVisual && (
                    <div className="pt-1.5 border-t border-white/[0.03]">
                      <label className="text-[9px] text-slate-400 block mb-1 font-semibold uppercase tracking-wider">Mesclagem (Blend Mode)</label>
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        value={clip.blendMode || 'normal'}
                        onChange={(e) => { onUpdateClip(clip.id, { blendMode: e.target.value }); onCommitChange(); }}
                      >
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiplicar (Multiply)</option>
                        <option value="screen">Divisão (Screen)</option>
                        <option value="overlay">Sobrepor (Overlay)</option>
                        <option value="darken">Escurecer (Darken)</option>
                        <option value="lighten">Clarear (Lighten)</option>
                        <option value="color-dodge">Subexposição de cores (Color Dodge)</option>
                        <option value="color-burn">Superxposição de cores (Color Burn)</option>
                        <option value="difference">Diferença (Difference)</option>
                        <option value="exclusion">Exclusão (Exclusion)</option>
                      </select>
                    </div>
                  )}

                  {/* Reset position help */}
                  <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono mt-1 pt-1.5 border-t border-white/[0.03]">
                    <span>X: {Math.round(clip.posX || 0)}px | Y: {Math.round(clip.posY || 0)}px</span>
                    <button 
                      onClick={() => { onUpdateClip(clip.id, { posX: 0, posY: 0 }); onCommitChange(); }}
                      className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Resetar Posição
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Informational Card (For Audio basics) */}
            {clip.type === 'audio' && (
              <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl flex flex-col justify-center text-center space-y-2">
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Trime o seu clipe de áudio ajustando os pontos de início e fim no card à esquerda.
                </p>
                <p className="text-[10px] text-slate-500">
                  Para aplicar efeitos como volume, pitch e equalização, mude para a aba de <span className="text-indigo-400 font-bold">Efeitos de Áudio (FX)</span>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Motion, Keyframes & Animations */}
        {activeTab === 'motion' && (isVisual || isText || isShape || isCamera) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Custom Keyframes Manager */}
            {keyframeMode === 'advanced' ? (
              <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Keyframes Personalizados (Avançado)
                </h4>
                
                <div className="space-y-3">
                  <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Progresso do Clipe:</span>
                      <span className="font-mono text-indigo-400 font-bold">{currentProgressPercent}%</span>
                    </div>
                    
                    <button
                      onClick={handleAddKeyframe}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.3)]"
                    >
                      <span>➕ Adicionar Keyframe em {currentProgressPercent}%</span>
                    </button>
                  </div>

                  {/* Keyframes list */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 block">Linha de Keyframes ({clip.keyframes?.length || 0})</label>
                    
                    {!clip.keyframes || clip.keyframes.length === 0 ? (
                      <div className="text-center py-4 bg-black/20 rounded border border-dashed border-white/5 text-[9px] text-slate-500 leading-relaxed">
                        Nenhum keyframe adicionado.<br />
                        Mova a agulha na timeline e adicione transformações.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1 select-none custom-scrollbar">
                        {clip.keyframes.map((kf) => (
                          <div 
                            key={kf.id}
                            className="flex items-center gap-1.5 p-1.5 bg-black/40 rounded border border-white/5 text-[10px] hover:border-indigo-500/30 transition-colors"
                          >
                            <button
                              onClick={() => {
                                if (setCurrentTime) {
                                  const targetTime = clip.startTime + (kf.time / 100) * clipDuration;
                                  setCurrentTime(targetTime);
                                }
                              }}
                              className="flex-1 text-left font-semibold text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="font-mono text-indigo-400 px-1 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px]">
                                {kf.time}%
                              </span>
                              <span className="font-mono text-[9px] text-slate-400">
                                S:{(kf.scale ?? 1).toFixed(1)}x R:{kf.rotation || 0}° P:{Math.round(kf.posX || 0)},{Math.round(kf.posY || 0)}
                              </span>
                            </button>
                            
                            <button
                              onClick={() => handleRemoveKeyframe(kf.id)}
                              className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded text-slate-500 transition-colors cursor-pointer"
                              title="Excluir Keyframe"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Keyframe Editor (if one selected) */}
            {selectedKeyframeId && clip.keyframes?.find(k => k.id === selectedKeyframeId) && (
              <div className="bg-[#151515] border border-indigo-500/30 p-3.5 rounded-xl space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-red-400 tracking-wider">
                  Editar Keyframe Selecionado
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[8px] text-slate-400">X</label>
                    <input type="number" className="w-full bg-black rounded p-1" value={clip.keyframes.find(k => k.id === selectedKeyframeId)?.posX || 0} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { posX: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-400">Y</label>
                    <input type="number" className="w-full bg-black rounded p-1" value={clip.keyframes.find(k => k.id === selectedKeyframeId)?.posY || 0} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { posY: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-400">Escala</label>
                    <input type="number" className="w-full bg-black rounded p-1" value={clip.keyframes.find(k => k.id === selectedKeyframeId)?.scale || 1} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { scale: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-400">Rotação</label>
                    <input type="number" className="w-full bg-black rounded p-1" value={clip.keyframes.find(k => k.id === selectedKeyframeId)?.rotation || 0} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { rotation: parseFloat(e.target.value) })} />
                  </div>
                  {isCamera && (
                    <>
                      <div>
                        <label className="text-[8px] text-emerald-400 font-medium">RotX 3D (Inclinação)</label>
                        <input type="number" className="w-full bg-black rounded p-1 text-emerald-400 font-mono" value={(clip.keyframes.find(k => k.id === selectedKeyframeId) as any)?.rotationX || 0} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { rotationX: parseFloat(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-[8px] text-emerald-400 font-medium">RotY 3D (Giro Lateral)</label>
                        <input type="number" className="w-full bg-black rounded p-1 text-emerald-400 font-mono" value={(clip.keyframes.find(k => k.id === selectedKeyframeId) as any)?.rotationY || 0} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { rotationY: parseFloat(e.target.value) })} />
                      </div>
                    </>
                  )}
                </div>
                <div>
                   <label className="text-[8px] text-slate-400">Curva Easing</label>
                   <select className="w-full bg-black rounded p-1 text-xs font-mono text-white" value={clip.keyframes.find(k => k.id === selectedKeyframeId)?.easing || 'linear'} onChange={(e) => onUpdateKeyframe(clip.id, selectedKeyframeId, { easing: e.target.value })}>
                     <option value="linear">linear</option>
                     <option value="ease-in">ease-in</option>
                     <option value="ease-out">ease-out</option>
                     <option value="ease-in-out">ease-in-out</option>
                     <option value="sine-in-out">sine-in-out</option>
                     <option value="ease-in-sine">ease-in-sine</option>
                     <option value="ease-out-sine">ease-out-sine</option>
                     <option value="ease-in-back">ease-in-back</option>
                     <option value="ease-out-back">ease-out-back</option>
                     <option value="ease-in-out-back">ease-in-out-back</option>
                     <option value="ease-in-out-cubic">ease-in-out-cubic</option>
                     <option value="elastic">elastic</option>
                     <option value="bounce">bounce</option>
                     <option value="bounce-twice">bounce-twice</option>
                     <option value="custom-bezier">custom-bezier</option>
                   </select>
                </div>
              </div>
            )}

            {/* Section 3: Animations */}
            <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
              <h4 className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Animações & Efeitos Dinâmicos
              </h4>

              {isText ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">7+ Animações de Texto</label>
                    <select
                      className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                      value={clip.animationType || ''}
                      onChange={(e) => { onUpdateClip(clip.id, { animationType: e.target.value }); onCommitChange(); }}
                    >
                      <option value="">Nenhuma Animação</option>
                      <option value="typewriter">⌨️ Máquina de Escrever (Digitação)</option>
                      <option value="slide-fade-up">⬆️ Deslizar e Surgir (Slide & Fade Up)</option>
                      <option value="zoom-pop">💥 Zoom Pop Cinemático (Elastic Bounce)</option>
                      <option value="glitch-shake">👾 Glitch Digital Hacker (Shake)</option>
                      <option value="bounce-entrance">🏀 Pulo Saltitante (Gravity Drop)</option>
                      <option value="rotate-drop">🌀 Cair Rotacionando (Rotate Drop)</option>
                      <option value="rainbow-wave">🌈 Onda Arco-Íris Mágica (Color Loop)</option>
                      <option value="soft-pulse">💓 Pulsação Orgânica (Smooth Pulse)</option>
                      <option value="blur-reveal">✨ Revelar c/ Desfoque (Blur Reveal)</option>
                      <option value="letter-stagger">🔠 Escalar e Espaçar (Letter Stagger)</option>
                      <option value="slide-left-wipe">➡️ Revelação p/ Direita (Slide Left Wipe)</option>
                      <option value="spiral-in">🌀 Espiral Rotacional (Spiral Scale In)</option>
                      <option value="flash-bang">💥 Piscar e Explodir (Flash Bang)</option>
                      <option value="swing-pendulum">⏱️ Pêndulo (Swing)</option>
                      <option value="zoom-wobble">🤪 Zoom com Tremor (Zoom Wobble)</option>
                      <option value="slide-bounce-right">➡️ Deslizar Direita com Salto (Slide Bounce Right)</option>
                      <option value="blur-in-out">🌫️ Foco e Desfoco (Blur In & Out)</option>
                    </select>
                  </div>
                  <p className="text-[8px] text-slate-500 leading-relaxed">
                    Estas animações rodam perfeitamente no preview em tempo real e são exportadas com alta fidelidade no canvas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Animação Principal (Visual)</label>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                      value={clip.animationType || ''}
                      onChange={(e) => { onUpdateClip(clip.id, { animationType: e.target.value }); onCommitChange(); }}
                    >
                      <option value="">Nenhuma</option>
                      <option value="pan-right">Pan p/ Direita</option>
                      <option value="pan-left">Pan p/ Esquerda</option>
                      <option value="pan-up">Pan p/ Cima</option>
                      <option value="pan-down">Pan p/ Baixo</option>
                      <option value="zoom-in">Zoom In (Suave)</option>
                      <option value="zoom-out">Zoom Out (Suave)</option>
                      <option value="spin">Girar 360°</option>
                      <option value="wobble">Wobble (Balanço)</option>
                      <option value="heartbeat">Heartbeat (Pulsação)</option>
                      <option value="zoom-rotate">Zoom & Girar</option>
                      <option value="slide-up">Deslizar p/ Cima</option>
                      <option value="slide-down">Deslizar p/ Baixo</option>
                      <option value="fade-in">Fade In (Opacidade)</option>
                      <option value="fade-out">Fade Out (Opacidade)</option>
                      <option value="swing">Swing (Pêndulo)</option>
                      <option value="flash">Flash (Piscar)</option>
                      <option value="pulse-rapid">Pulsação Rápida</option>
                      <option value="shake-intense">Tremor Intenso</option>
                      <option value="rotate-flip">Flip Horizontal</option>
                      <option value="zoom-shake">Zoom com Tremor</option>
                      <option value="slide-fade-down">Deslizar p/ Baixo (Fade)</option>
                      <option value="zoom-in-bounce">Zoom c/ Bounce</option>
                      <option value="shake-small">Tremor Leve</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Velocidade da Animação</span>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">{(clip.animationSpeed !== undefined ? clip.animationSpeed : 1.0).toFixed(2)}x</span>
                </div>
                
                <input 
                  type="range" 
                  min="0.25" 
                  max="5" 
                  step="0.25"
                  value={clip.animationSpeed !== undefined ? clip.animationSpeed : 1.0}
                  onChange={(e) => onUpdateClip(clip.id, { animationSpeed: parseFloat(e.target.value) })}
                  onMouseUp={onCommitChange}
                  onTouchEnd={onCommitChange}
                  className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />

                {/* Speed Preset Buttons */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {[0.5, 1.0, 1.5, 2.0, 3.0].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => { onUpdateClip(clip.id, { animationSpeed: speed }); onCommitChange(); }}
                      className={`py-1 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                        (clip.animationSpeed !== undefined ? clip.animationSpeed : 1.0) === speed
                          ? 'bg-amber-500 text-black font-bold shadow-[0_1px_5px_rgba(245,158,11,0.4)]'
                          : 'bg-black/40 hover:bg-black/60 text-slate-400 border border-white/5'
                      }`}
                    >
                      {speed.toFixed(1)}x
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Acelere ou desacelere as animações, transições de keyframes e efeitos de digitação deste clipe.
                </p>
              </div>
            </div>

            {/* Transitions (Only for Visuals) */}
            {isVisual && (
              <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Transição para o Próximo Clipe
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Efeito de Transição</label>
                    <select
                      className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                      value={clip.transitionNext || ''}
                      onChange={(e) => { onUpdateClip(clip.id, { transitionNext: e.target.value }); onCommitChange(); }}
                    >
                      <option value="">Nenhuma Transição (Corte Seco)</option>
                      <option value="fade">🌀 Dissolver / Fade Cruzado</option>
                      <option value="slide-left">⬅️ Deslizar p/ Esquerda</option>
                      <option value="slide-right">➡️ Deslizar p/ Direita</option>
                      <option value="slide-up">⬆️ Deslizar p/ Cima</option>
                      <option value="slide-down">⬇️ Deslizar p/ Baixo</option>
                      <option value="zoom">🔍 Zoom In/Out Cruzado</option>
                      <option value="spin">🔄 Giro Espiral (Spin)</option>
                      <option value="wipe-left">🧹 Wipe Cortina p/ Esquerda</option>
                      <option value="wipe-right">🧹 Wipe Cortina p/ Direita</option>
                      <option value="color-flash-white">⚡ Flash de Luz Branco</option>
                      <option value="color-flash-black">⚡ Flash de Luz Negro</option>
                      <option value="ripple">🌊 Ondulação Ripple d'Água</option>
                      <option value="blur-fade">🌫️ Desfoque Suave & Fade</option>
                      <option value="rotate-zoom">💫 Giro 3D com Zoom In/Out</option>
                      <option value="slide-up-fade">⬆️ Deslizar p/ Cima com Desfoque/Fade</option>
                      <option value="slide-down-fade">⬇️ Deslizar p/ Baixo com Desfoque/Fade</option>
                      <option value="squeeze-left">↔️ Espremer Compacto (Squeeze)</option>
                      <option value="skew-slide">📐 Deslizamento Inclinado (Skew)</option>
                    </select>
                  </div>
                  <p className="text-[8px] text-slate-500 leading-relaxed">
                    A transição dura exatamente 0.5s e conecta este clipe ao próximo que estiver adjacente na mesma trilha de vídeo.
                  </p>
                </div>
              </div>
            )}

            {/* Keyframes Curve Preset Selector & Bezier Curve Controller */}
            <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
              <h4 className="text-[10px] uppercase font-bold text-violet-400 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Interpolação de Keyframes (Easing)
              </h4>

              <div className="space-y-3">
                {/* Select Curva */}
                <div>
                  <label className="text-[9px] text-slate-400 block mb-1">Curva de Easing</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-mono"
                        value={clip.easing || 'linear'}
                        onChange={(e) => { onUpdateClip(clip.id, { easing: e.target.value }); onCommitChange(); }}
                      >
                        <option value="linear">linear (Velocidade Constante)</option>
                        <option value="ease-in">ease-in (Aceleração)</option>
                        <option value="ease-out">ease-out (Desaceleração)</option>
                        <option value="ease-in-out">ease-in-out (Suave)</option>
                        <option value="sine-in-out">sine-in-out (Senoide)</option>
                        <option value="ease-in-sine">ease-in-sine (Entrada de Seno)</option>
                        <option value="ease-out-sine">ease-out-sine (Saída de Seno)</option>
                        <option value="ease-in-back">ease-in-back (Recuo e Acelera)</option>
                        <option value="ease-out-back">ease-out-back (Acelera e Passa)</option>
                        <option value="ease-in-out-back">ease-in-out-back (Surgimento Completo)</option>
                        <option value="elastic">elastic (Efeito Mola Elástica)</option>
                        <option value="bounce">bounce (Pulo de Gravidade)</option>
                        <option value="bounce-twice">bounce-twice (Pulo Duplo)</option>
                        <option value="custom-bezier">custom-bezier (Cubic Bezier Manual)</option>
                      </select>
                    </div>
                    <div className="bg-black/50 p-1.5 rounded border border-white/5 flex items-center justify-center shrink-0">
                      {getEasingIcon(clip.easing)}
                    </div>
                  </div>
                </div>

                {/* Preset Keyframe Buttons (The missing buttons the user requested!) */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-slate-500 block">Presets Rápidos de Keyframe</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={() => handleApplyPreset('cinema')}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 hover:text-indigo-400 rounded text-[9px] font-semibold text-slate-300 transition-colors text-left flex items-center gap-1 cursor-pointer"
                    >
                      🎬 Cinemático Pan
                    </button>
                    <button 
                      onClick={() => handleApplyPreset('zoom')}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 hover:text-indigo-400 rounded text-[9px] font-semibold text-slate-300 transition-colors text-left flex items-center gap-1 cursor-pointer"
                    >
                      🔍 Zoom In Suave
                    </button>
                    <button 
                      onClick={() => handleApplyPreset('bounce')}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 hover:text-indigo-400 rounded text-[9px] font-semibold text-slate-300 transition-colors text-left flex items-center gap-1 cursor-pointer"
                    >
                      🏀 Salto Elástico
                    </button>
                    <button 
                      onClick={() => handleApplyPreset('wobble')}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 hover:text-indigo-400 rounded text-[9px] font-semibold text-slate-300 transition-colors text-left flex items-center gap-1 cursor-pointer"
                    >
                      🌀 Balanço Wobble
                    </button>
                    <button 
                      onClick={() => handleApplyPreset('pop')}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 hover:text-indigo-400 rounded text-[9px] font-semibold text-slate-300 transition-colors text-left flex items-center gap-1 cursor-pointer col-span-2"
                    >
                      💥 Elastic POP (Bezier)
                    </button>
                  </div>
                </div>

                {/* Cubic Bezier Visualizer */}
                {clip.easing === 'custom-bezier' && (
                  <div className="flex gap-3 items-center pt-2 border-t border-white/5">
                    <BezierVisualizer points={bezierPoints} />
                    <div className="flex-1 space-y-2 text-[9px]">
                      <div>
                        <span className="text-red-400 font-bold block mb-0.5">Controlador P1 (X, Y)</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" min="0" max="1" step="0.01" value={bezierPoints[0]} 
                            onChange={(e) => handleBezierChange(0, parseFloat(e.target.value))}
                            onMouseUp={onCommitChange} onTouchEnd={onCommitChange}
                            className="flex-1 accent-red-500 h-1"
                          />
                          <input 
                            type="range" min="0" max="1.5" step="0.01" value={bezierPoints[1]} 
                            onChange={(e) => handleBezierChange(1, parseFloat(e.target.value))}
                            onMouseUp={onCommitChange} onTouchEnd={onCommitChange}
                            className="flex-1 accent-red-400 h-1"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="text-blue-400 font-bold block mb-0.5">Controlador P2 (X, Y)</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" min="0" max="1" step="0.01" value={bezierPoints[2]} 
                            onChange={(e) => handleBezierChange(2, parseFloat(e.target.value))}
                            onMouseUp={onCommitChange} onTouchEnd={onCommitChange}
                            className="flex-1 accent-blue-500 h-1"
                          />
                          <input 
                            type="range" min="0" max="1.5" step="0.01" value={bezierPoints[3]} 
                            onChange={(e) => handleBezierChange(3, parseFloat(e.target.value))}
                            onMouseUp={onCommitChange} onTouchEnd={onCommitChange}
                            className="flex-1 accent-blue-400 h-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Filters & FX (Visual/Texts or Audio FX) */}
        {activeTab === 'fx' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {clip.type === 'audio' ? (
              <>
                {/* Audio Gain & Volume Card */}
                <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                  <h4 className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ganho & Volume Geral
                  </h4>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Volume</span>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">{clip.audioVolume !== undefined ? clip.audioVolume : 100}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="200" 
                        step="5"
                        value={clip.audioVolume !== undefined ? clip.audioVolume : 100}
                        onChange={(e) => onUpdateClip(clip.id, { audioVolume: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <p className="text-[8px] text-slate-500 leading-normal">
                      Aumente ou diminua a intensidade do som. Valores acima de 100% aplicam ganho extra ao áudio.
                    </p>
                  </div>
                </div>

                {/* Fade In & Out Card */}
                <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                  <h4 className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Transição de Volume (Fades)
                  </h4>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Fade In (Suavização Inicial)</span>
                        <span className="text-[10px] font-mono text-amber-400 font-semibold">{(clip.audioFadeIn || 0).toFixed(1)}s</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="5.0" 
                        step="0.1"
                        value={clip.audioFadeIn || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioFadeIn: parseFloat(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Fade Out (Suavização Final)</span>
                        <span className="text-[10px] font-mono text-amber-400 font-semibold">{(clip.audioFadeOut || 0).toFixed(1)}s</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="5.0" 
                        step="0.1"
                        value={clip.audioFadeOut || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioFadeOut: parseFloat(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Pitch & Equalizer Card */}
                <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4 col-span-1 md:col-span-2 lg:col-span-1">
                  <h4 className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Pitch & Equalizador Simples
                  </h4>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-3.5 text-xs">
                    {/* Pitch Shift Slider */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-semibold uppercase">Tom (Pitch Shift)</span>
                        <span className="text-[10px] font-mono text-indigo-400 font-bold">
                          {clip.audioPitch && clip.audioPitch > 0 ? `+${clip.audioPitch}` : clip.audioPitch || 0} semitones
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="-12" 
                        max="12" 
                        step="1"
                        value={clip.audioPitch || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioPitch: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[7px] text-slate-500 font-mono mt-0.5">
                        <span>Grave / Grosso</span>
                        <span>Normal</span>
                        <span>Agudo / Fino</span>
                      </div>
                    </div>

                    {/* Simple Equalizer (Bass / Treble) */}
                    <div className="border-t border-white/[0.05] pt-3.5 space-y-3">
                      <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">🎛️ Equalizador de Frequências</span>
                      
                      {/* Bass */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] text-slate-400">Graves (Bass)</span>
                          <span className="text-[9px] font-mono text-indigo-400 font-bold">{clip.audioBass && clip.audioBass > 0 ? `+${clip.audioBass}` : clip.audioBass || 0} dB</span>
                        </div>
                        <input 
                          type="range" 
                          min="-10" 
                          max="10" 
                          step="1"
                          value={clip.audioBass || 0}
                          onChange={(e) => onUpdateClip(clip.id, { audioBass: parseInt(e.target.value) })}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                          className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Treble */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] text-slate-400">Agudos (Treble)</span>
                          <span className="text-[9px] font-mono text-indigo-400 font-bold">{clip.audioTreble && clip.audioTreble > 0 ? `+${clip.audioTreble}` : clip.audioTreble || 0} dB</span>
                        </div>
                        <input 
                          type="range" 
                          min="-10" 
                          max="10" 
                          step="1"
                          value={clip.audioTreble || 0}
                          onChange={(e) => onUpdateClip(clip.id, { audioTreble: parseInt(e.target.value) })}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                          className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                  </div>
                </div>
              </div>

              {/* Premium Audio Effects Card */}
                <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4 col-span-1 md:col-span-2 lg:col-span-1">
                  <h4 className="text-[10px] uppercase font-bold text-violet-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                    5 Novos Efeitos Premium de Áudio
                  </h4>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-4 text-xs">
                    
                    {/* Muffler / Lowpass */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Abafador (Passa-Baixa)</span>
                        <span className="text-[10px] font-mono text-violet-400 font-semibold">
                          {clip.audioLowpass !== undefined ? `${clip.audioLowpass}%` : '100% (Normal)'}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5"
                        value={clip.audioLowpass !== undefined ? clip.audioLowpass : 100}
                        onChange={(e) => onUpdateClip(clip.id, { audioLowpass: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[7px] text-slate-500 mt-0.5 font-mono">Cria efeito de som subaquático ou vizinho barulhento.</p>
                    </div>

                    {/* Reverb / Delay Echo */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Reverberação & Eco</span>
                        <span className="text-[10px] font-mono text-violet-400 font-semibold">
                          {clip.audioReverb || 0}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5"
                        value={clip.audioReverb || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioReverb: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[7px] text-slate-500 mt-0.5 font-mono">Adiciona profundidade espacial de eco e ambiente de catedral.</p>
                    </div>

                    {/* Distortion */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Distorção (Overdrive)</span>
                        <span className="text-[10px] font-mono text-violet-400 font-semibold">
                          {clip.audioDistortion || 0}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5"
                        value={clip.audioDistortion || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioDistortion: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[7px] text-slate-500 mt-0.5 font-mono">Gera ganho analógico, sujeira de áudio e som de rádio antigo.</p>
                    </div>

                    {/* Tremolo */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Tremolo (Volume Pulsante)</span>
                        <span className="text-[10px] font-mono text-violet-400 font-semibold">
                          {clip.audioTremolo || 0}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5"
                        value={clip.audioTremolo || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioTremolo: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[7px] text-slate-500 mt-0.5 font-mono">Modulação de volume oscilante no tempo para efeito trêmulo.</p>
                    </div>

                    {/* Chorus / Phaser */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Chorus / Phaser Espacial</span>
                        <span className="text-[10px] font-mono text-violet-400 font-semibold">
                          {clip.audioPhaser || 0}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5"
                        value={clip.audioPhaser || 0}
                        onChange={(e) => onUpdateClip(clip.id, { audioPhaser: parseInt(e.target.value) })}
                        onMouseUp={onCommitChange}
                        onTouchEnd={onCommitChange}
                        className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[7px] text-slate-500 mt-0.5 font-mono">Ondulação psicodélica espacial simulando coro e phaser estéreo.</p>
                    </div>

                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Navegador de Efeitos */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-white flex items-center gap-2">
                      Navegador de Efeito
                    </h4>
                  </div>
                  
                  {/* Categorias de Filtros (Cor e Luz, Desfoque, etc) */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest px-1">Cor e Luz</h5>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {filters.filter(f => !f.label.includes('Desfoque') && !f.label.includes('Sombra')).map(f => (
                          <button 
                            key={f.value}
                            onClick={() => { onUpdateClip(clip.id, { filter: f.value }); onCommitChange(); }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${clip.filter === f.value ? 'bg-indigo-500/20 border border-indigo-500' : 'bg-[#121212] border border-white/5 hover:bg-white/5'}`}
                          >
                            <div className="w-full aspect-square rounded-lg bg-cover bg-center overflow-hidden border border-white/10" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop)' }}>
                              <div className="w-full h-full" style={{ filter: f.value, backdropFilter: f.value, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            </div>
                            <span className="text-[9px] text-center font-medium text-slate-300 leading-tight line-clamp-2">{f.label || 'Nenhum'}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest px-1">Desfoque</h5>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {filters.filter(f => f.label.includes('Desfoque')).map(f => (
                          <button 
                            key={f.value}
                            onClick={() => { onUpdateClip(clip.id, { filter: f.value }); onCommitChange(); }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${clip.filter === f.value ? 'bg-indigo-500/20 border border-indigo-500' : 'bg-[#121212] border border-white/5 hover:bg-white/5'}`}
                          >
                            <div className="w-full aspect-square rounded-lg bg-cover bg-center overflow-hidden border border-white/10" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop)' }}>
                              <div className="w-full h-full" style={{ filter: f.value, backdropFilter: f.value, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            </div>
                            <span className="text-[9px] text-center font-medium text-slate-300 leading-tight line-clamp-2">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest px-1">Desenho e Borda</h5>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {filters.filter(f => f.label.includes('Sombra')).map(f => (
                          <button 
                            key={f.value}
                            onClick={() => { onUpdateClip(clip.id, { filter: f.value }); onCommitChange(); }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${clip.filter === f.value ? 'bg-indigo-500/20 border border-indigo-500' : 'bg-[#121212] border border-white/5 hover:bg-white/5'}`}
                          >
                            <div className="w-full aspect-square rounded-lg bg-cover bg-center overflow-hidden border border-white/10 flex items-center justify-center bg-slate-900">
                              <div className="w-1/2 h-1/2 bg-white rounded-full" style={{ filter: f.value }} />
                            </div>
                            <span className="text-[9px] text-center font-medium text-slate-300 leading-tight line-clamp-2">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest px-1">Efeitos Especiais (FX)</h5>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {effects.map(e => (
                          <button 
                            key={e.value}
                            onClick={() => { onUpdateClip(clip.id, { effect: e.value }); onCommitChange(); }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${clip.effect === e.value ? 'bg-pink-500/20 border border-pink-500' : 'bg-[#121212] border border-white/5 hover:bg-white/5'}`}
                          >
                            <div className="w-full aspect-square rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden relative">
                              <span className="text-[10px] font-bold text-slate-500 uppercase rotate-45 opacity-50">FX</span>
                            </div>
                            <span className="text-[9px] text-center font-medium text-slate-300 leading-tight line-clamp-2">{e.label || 'Nenhum'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chroma Key Card */}
                <div className="bg-[#0f0f0f] border border-white/5 p-3.5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Remover Fundo (Chroma Key)
                    </h4>
                    <button
                      onClick={() => {
                        onUpdateClip(clip.id, { chromaKeyEnabled: !clip.chromaKeyEnabled });
                        onCommitChange();
                      }}
                      className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer border select-none",
                        clip.chromaKeyEnabled 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                          : "bg-white/5 text-slate-400 border-white/5"
                      )}
                    >
                      {clip.chromaKeyEnabled ? "ATIVO" : "INATIVO"}
                    </button>
                  </div>

                  {clip.chromaKeyEnabled && (
                    <div className="space-y-3 pt-1 border-t border-white/5 animate-fade-in">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[9px] text-slate-400 font-medium">Cor para Remover (Seletor)</label>
                        <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded px-1.5 py-0.5">
                          <input 
                            type="color" 
                            className="w-4 h-4 bg-transparent border-none cursor-pointer p-0"
                            value={clip.chromaKeyColor || '#00ff00'}
                            onChange={(e) => {
                              onUpdateClip(clip.id, { chromaKeyColor: e.target.value });
                              onCommitChange();
                            }}
                          />
                          <span className="text-[10px] font-mono text-white select-all">
                            {clip.chromaKeyColor || '#00ff00'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                          <span>Similaridade (Tolerância)</span>
                          <span className="font-mono text-white">
                            {clip.chromaKeySimilarity !== undefined ? Math.round(clip.chromaKeySimilarity * 100) : 30}%
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.8" 
                          step="0.01"
                          className="w-full accent-emerald-500 cursor-pointer"
                          value={clip.chromaKeySimilarity !== undefined ? clip.chromaKeySimilarity : 0.3}
                          onChange={(e) => {
                            onUpdateClip(clip.id, { chromaKeySimilarity: parseFloat(e.target.value) });
                          }}
                          onMouseUp={onCommitChange}
                          onTouchEnd={onCommitChange}
                        />
                      </div>

                      <p className="text-[8px] text-slate-500 leading-normal">
                        Dica: Escolha verde (#00ff00) ou azul (#0000ff) para remover telas de chroma key padrão, ou clique no seletor para remover qualquer cor.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* Footer deletion bar */}
      <div className="p-3 border-t border-white/5 bg-[#0a0a0a] shrink-0 flex items-center justify-between gap-4">
        <p className="text-[9px] text-slate-500 font-mono">ID: {clip.id}</p>
        <button 
          onClick={() => onRemoveClip(clip.id)}
          className="px-4 py-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-red-600 rounded-full text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Excluir Clipe</span>
        </button>
      </div>
    </div>
  );
}
