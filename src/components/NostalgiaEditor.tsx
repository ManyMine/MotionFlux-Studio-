import React from 'react';
import { 
  ChevronLeft, Undo2, Redo2, Maximize, Settings, Upload, 
  Play, Pause, Home, Crown, Store, Sparkles, Layers, Mic, Music, 
  Video as VideoIcon, Menu, SkipBack, SkipForward, X, Radio, Scissors, 
  Copy, Folder, Palette, Sliders, Trash2, Type, Volume2, Heart, 
  Activity, Smile, RefreshCw, Camera, Plus, LogOut
} from 'lucide-react';
import { PreviewCanvas } from './PreviewCanvas';
import { Timeline } from './Timeline';
import { MediaPool } from './MediaPool';
import { TimelineClip } from '../types';
import { ClipEditor } from './ClipEditor';

interface NostalgiaEditorProps {
  clips: TimelineClip[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  selectedClipId: string | null;
  selectedKeyframeId: string | null;
  settings: any;
  onPlayPause: () => void;
  onStop: () => void;
  setCurrentTime: (t: number | ((prev: number) => number)) => void;
  setSelectedClipId: (id: string | null) => void;
  onSelectKeyframe: (id: string | null) => void;
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
  onAddClip: (clip: TimelineClip) => void;
  onDeleteClip: (id: string) => void;
  onSplitClip: (id: string, time: number) => void;
  onDuplicateClip: (id: string) => void;
  onClose: () => void;
  onExport: () => void;
  historyRef?: any;
  theme: 'padrão' | 'nostalgia';
  setTheme: (t: 'padrão' | 'nostalgia') => void;
  keyframeMode: 'simple' | 'advanced';
  setKeyframeMode: (m: 'simple' | 'advanced') => void;
  onUndo: () => void;
  onRedo: () => void;
  onUndoAll: () => void;
  onRedoAll: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // New rich props:
  media: any[];
  onAddMedia: (files: FileList | File[]) => Promise<void>;
  onRemoveMedia: (id: string) => void;
  onClickAdd: (item: any) => void;
  onClickAddOverlay: (item: any) => void;
  onAddText: () => void;
  onAddShape: (shapeType: 'circle' | 'square' | 'triangle' | 'star-4' | 'star-5' | 'oval-custom') => void;
  onAddCamera: () => void;
  isAnalyzing: boolean;
  onAnalyzeWithAI: () => void;
  isSettingsOpen: boolean;
  onOpenSettings: () => void;

  importedFonts?: { name: string; file: string }[];
  onImportFont?: (name: string, file: string) => void;
  onCommitChange?: () => void;
  onUpdateKeyframe?: (clipId: string, kfId: string, updates: Partial<any>) => void;
  markers?: number[];
  onToggleMarker?: (time: number) => void;
}

export function NostalgiaEditor(props: NostalgiaEditorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const selectedClip = props.clips.find(c => c.id === props.selectedClipId);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isSimpleMode, setIsSimpleMode] = React.useState(false);

  // Modal & Popup States
  const [isPropertiesOpen, setIsPropertiesOpen] = React.useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = React.useState(false);
  const [mediaFilter, setMediaFilter] = React.useState<'all' | 'audio'>('all');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = React.useState(false);
  const [isShapeMenuOpen, setIsShapeMenuOpen] = React.useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = React.useState(false);
  
  // Simulated REC State
  const [isRecording, setIsRecording] = React.useState(false);
  const [recSeconds, setRecSeconds] = React.useState(0);
  const recIntervalRef = React.useRef<any>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioStreamRef = React.useRef<MediaStream | null>(null);

  // Submenu states for bottom bar properties
  const [activeSubmenu, setActiveSubmenu] = React.useState<'none' | 'filtro' | 'ajuste' | 'alfa' | 'animacao' | 'estilo' | 'mesclagem' | 'cor'>('none');
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);

  // Captions loading animation state
  const [isCaptionsGenerating, setIsCaptionsGenerating] = React.useState(false);

  const handleMediaClick = () => {
    setMediaFilter('all');
    setIsMediaModalOpen(true);
  };

  const handleAudioClick = () => {
    setMediaFilter('audio');
    setIsMediaModalOpen(true);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Erro ao ativar tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleRecClick = async () => {
    if (isRecording) {
      if (recIntervalRef.current) {
        clearInterval(recIntervalRef.current);
        recIntervalRef.current = null;
      }
      setIsRecording(false);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        audioChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const filename = `gravacao-${Date.now()}.wav`;
          const file = new File([audioBlob], filename, { type: 'audio/wav' });

          // Add to media pool and local indexedDB
          const dataUrl = URL.createObjectURL(file);
          const duration = recSeconds || 1; // fall back to timer-derived seconds if needed
          
          const newId = 'rec-' + Math.random().toString(36).substring(7);
          const newVoiceClip = {
            id: newId,
            type: 'audio' as const,
            name: `Microfone (${duration}s)`,
            dataUrl,
            duration,
            trackId: 'a1',
            startTime: props.currentTime,
            clipStartOffset: 0,
            clipEndOffset: duration,
          };
          
          if (props.onAddMedia) {
            await props.onAddMedia([file]);
          }
          props.onClickAdd(newVoiceClip);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecSeconds(0);
        recIntervalRef.current = setInterval(() => {
          setRecSeconds(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Não foi possível acessar o microfone. Por favor, conceda as permissões de áudio.');
      }
    }
  };

  // Add default text clip
  const handleAddTextDefault = () => {
    props.onAddText();
  };

  // Auto Captions generation with nice feedback
  const handleAutoCaptions = () => {
    setIsCaptionsGenerating(true);
    setTimeout(() => {
      const captions = [
        { text: "Sejam bem-vindos ao MotionFlux Studio!", start: 0, end: 2.5 },
        { text: "Edição Nostálgica com Timeline em tempo real", start: 2.7, end: 5.5 },
        { text: "Agulha fixa centralizada e Render 60 FPS!", start: 5.8, end: 9 }
      ];
      captions.forEach((cap, idx) => {
        props.onAddClip({
          id: 'cap-' + Math.random().toString(36).substring(7),
          type: 'text',
          name: `Legenda ${idx + 1}`,
          dataUrl: '',
          duration: cap.end - cap.start,
          trackId: 't1',
          startTime: cap.start,
          clipStartOffset: 0,
          clipEndOffset: cap.end - cap.start,
          textContent: cap.text,
          textColor: '#fbbc05', // classic KineMaster golden yellow captions
          fontFamily: 'oswald',
          posX: 0,
          posY: 160,
          scale: 0.95
        });
      });
      setIsCaptionsGenerating(false);
      alert("Legendas automáticas geradas e adicionadas na timeline!");
    }, 2000);
  };

  // Text To Speech (Voice Narrator) using window.speechSynthesis
  const handleTTS = () => {
    const text = prompt("Digite o texto para o narrador falar:", "Olá! Esta é uma narração gerada automaticamente.");
    if (!text) return;
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
    
    const duration = Math.max(3, Math.ceil(text.length * 0.08));
    props.onAddClip({
      id: 'tts-' + Math.random().toString(36).substring(7),
      type: 'audio',
      name: `Narrador: "${text.substring(0, 15)}..."`,
      dataUrl: '',
      duration: duration,
      trackId: 'a1',
      startTime: props.currentTime,
      clipStartOffset: 0,
      clipEndOffset: duration
    });
  };

  // Sound Remix Beat Creator
  const handleBeatMatch = () => {
    props.onAddClip({
      id: 'beat-' + Math.random().toString(36).substring(7),
      type: 'audio',
      name: `Lofi Ambient Beats`,
      dataUrl: '',
      duration: 15,
      trackId: 'a1',
      startTime: 0,
      clipStartOffset: 0,
      clipEndOffset: 15
    });
    alert("Trilha sonora Lofi Ambient adicionada no início da timeline!");
  };

  // Replace media helper
  const handleReplaceMediaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Build filter style string
  React.useEffect(() => {
    if (selectedClip && activeSubmenu === 'ajuste') {
      const filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      props.onUpdateClip(selectedClip.id, { filter: filterStr });
    }
  }, [brightness, contrast, saturation]);

  React.useEffect(() => {
    return () => {
      if (recIntervalRef.current) {
        clearInterval(recIntervalRef.current);
      }
    };
  }, []);

  // Clear submenu on clip change
  React.useEffect(() => {
    setActiveSubmenu('none');
    if (!props.selectedClipId) {
      setIsPropertiesOpen(false);
    }
  }, [props.selectedClipId]);

  if (isSimpleMode) {
    return (
      <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files) {
              props.onAddMedia(e.target.files);
              e.target.value = '';
            }
          }}
          multiple 
          accept="video/*,audio/*,image/*" 
          className="hidden" 
        />

        {/* Top Bar */}
        <div className="h-14 bg-[#121212] flex items-center justify-between px-4 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={props.onClose} className="text-white hover:text-slate-300 transition-colors p-1" title="Sair">
               <LogOut className="w-5 h-5 scale-x-[-1]" />
            </button>
            <span className="text-[13px] font-medium text-slate-200">Novo projeto</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white hover:text-slate-300 p-1">
                <Settings className="w-5 h-5" />
              </button>
              {isMenuOpen && (
                <div className="absolute top-10 right-0 w-48 bg-[#202024] border border-white/10 rounded-xl p-2 z-50 shadow-2xl">
                  <button 
                    onClick={() => {
                      setIsSimpleMode(false);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                  >
                    Desativar Modo Simples
                  </button>
                </div>
              )}
            </div>
            <button onClick={props.onExport} className="text-white hover:text-slate-300 p-1" title="Exportar">
              <Upload className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 min-h-0 bg-black flex items-center justify-center relative overflow-hidden">
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center pointer-events-auto relative">
            <PreviewCanvas 
              clips={props.clips}
              currentTime={props.currentTime}
              isPlaying={props.isPlaying}
              duration={props.duration}
              onUpdateClip={props.onUpdateClip}
              onPlayPause={props.onPlayPause}
              onStop={props.onStop}
              settings={props.settings}
              backgroundColor={props.settings.backgroundColor}
            />
          </div>
        </div>

        {/* Bottom Area (Timeline + Controls) */}
        <div className="h-[40%] bg-[#121212] flex flex-col relative border-t border-white/5">
          {/* Controls Bar */}
          <div className="h-12 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-6">
              <button onClick={props.onUndo} disabled={!props.canUndo} className="text-slate-300 disabled:opacity-30 hover:text-white p-1"><Undo2 className="w-4 h-4"/></button>
              <button onClick={props.onRedo} disabled={!props.canRedo} className="text-slate-300 disabled:opacity-30 hover:text-white p-1"><Redo2 className="w-4 h-4"/></button>
            </div>
            
            <div className="flex items-center gap-8">
              <button onClick={() => props.setCurrentTime(0)} className="text-white hover:text-slate-300 p-1"><SkipBack className="w-4 h-4"/></button>
              <button onClick={props.isPlaying ? props.onStop : props.onPlayPause} className="text-white hover:text-slate-300 p-1">
                {props.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button onClick={() => props.setCurrentTime(props.duration)} className="text-white hover:text-slate-300 p-1"><SkipForward className="w-4 h-4"/></button>
            </div>

            <div className="flex items-center gap-6">
              <button className="text-white hover:text-slate-300 flex items-center justify-center relative p-1" title="Adicionar Keyframe" onClick={() => {/* Keyframe logic if needed */}}>
                 <div className="w-3 h-3 border-2 border-current rotate-45 flex items-center justify-center rounded-sm">
                   <Plus className="w-2.5 h-2.5 -rotate-45" />
                 </div>
              </button>
              <button className="text-white hover:text-slate-300 p-1"><Maximize className="w-4 h-4"/></button>
            </div>
          </div>
          
          {/* Simple Timeline Tracks */}
          <div className="flex-1 overflow-hidden relative">
              <Timeline 
                clips={props.clips}
                currentTime={props.currentTime}
                duration={props.duration}
                onTimeUpdate={(t) => props.setCurrentTime(t)}
                selectedClipId={props.selectedClipId}
                onSelectClip={props.setSelectedClipId}
                selectedKeyframeId={props.selectedKeyframeId}
                onSelectKeyframe={props.onSelectKeyframe}
                onUpdateClip={props.onUpdateClip}
                onRemoveClip={props.onDeleteClip}
                onAddClip={props.onAddClip}
                theme="simple"
                markers={props.markers}
                onToggleMarker={props.onToggleMarker}
              />
          </div>

          {/* Floating Add Button */}
          <div className="absolute bottom-6 right-6 z-50">
             <button 
               onClick={() => {
                 setMediaFilter('all');
                 setIsMediaModalOpen(true);
               }} 
               className="w-12 h-12 rounded-full border border-teal-500/50 flex items-center justify-center text-teal-400 hover:bg-teal-500/10 transition-colors shadow-[0_0_15px_rgba(20,184,166,0.15)]"
             >
                <Plus className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* Media Modal reusing the one from NostalgiaEditor */}
        {isMediaModalOpen && (
          <div className="absolute inset-0 bg-black/90 z-50 flex flex-col backdrop-blur-xl">
            <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold text-teal-400">Adicionar Mídia</h2>
              <button onClick={() => setIsMediaModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <MediaPool 
                media={props.media} 
                onRemoveMedia={props.onRemoveMedia} 
                onClickAdd={props.onClickAdd}
                onClickAddOverlay={props.onClickAddOverlay}
                onAddMedia={props.onAddMedia}
                onDragStart={() => {}}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1c1c1f] text-amber-200 font-sans overflow-hidden">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) {
            props.onAddMedia(e.target.files);
            e.target.value = '';
          }
        }}
        multiple 
        accept="video/*,audio/*,image/*" 
        className="hidden" 
      />

      {/* 1. Header (Top Bar) */}
      <div className="h-14 bg-[#141416] border-b border-white/5 flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={props.onClose} className="p-2 bg-white/5 rounded-full text-white hover:text-amber-400 transition-colors cursor-pointer" title="Voltar ao Painel">
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="p-2 bg-white/5 rounded-full text-white hover:text-amber-400 border border-white/5 cursor-pointer flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full">
            <Crown className="w-4 h-4 text-amber-400 fill-current" />
            <span className="text-xs font-black tracking-wider text-amber-300">NOSTALGIA</span>
          </div>
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-14 left-14 w-52 bg-[#202024] border border-white/10 rounded-xl p-2 z-50 shadow-2xl">
            <button 
              onClick={() => {
                setIsSimpleMode(!isSimpleMode);
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer transition-colors flex justify-between"
            >
              <span>Modo Simples:</span>
              <span className={isSimpleMode ? "text-emerald-400 uppercase font-bold" : "text-amber-400 uppercase font-bold"}>{isSimpleMode ? "Ativo" : "Inativo"}</span>
            </button>
            <button 
              onClick={() => {
                props.setTheme(props.theme === 'padrão' ? 'nostalgia' : 'padrão');
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer transition-colors flex justify-between"
            >
              <span>Tema do Editor:</span>
              <span className="text-amber-400 uppercase font-bold">{props.theme}</span>
            </button>
            <button 
              onClick={() => {
                props.setKeyframeMode(props.keyframeMode === 'simple' ? 'advanced' : 'simple');
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer transition-colors flex justify-between"
            >
              <span>Keyframes:</span>
              <span className="text-amber-400 uppercase font-bold">{props.keyframeMode}</span>
            </button>
          </div>
        )}

        {/* Center Aspect Ratio display */}
        <div className="text-sm font-bold text-white bg-white/5 px-4 py-1.5 rounded-lg border border-white/5">
          Formato: {props.settings.aspectRatio}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleFullscreen} className="p-2 text-slate-300 hover:text-white bg-white/5 rounded-full transition-colors cursor-pointer" title="Tela Cheia">
            <Maximize className="w-5 h-5" />
          </button>
          <button onClick={props.onOpenSettings} className="p-2 text-slate-300 hover:text-white bg-white/5 rounded-full transition-colors cursor-pointer" title="Configurações">
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={props.onExport} className="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 text-xs uppercase tracking-wider border-0">
            <Upload className="w-4 h-4" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 2. Top Half: Video Preview */}
      <div className="flex-1 min-h-0 bg-black flex items-center justify-center relative overflow-hidden">
        <div className="w-full h-full max-w-full max-h-full flex items-center justify-center pointer-events-auto relative">
          <PreviewCanvas 
            clips={props.clips}
            currentTime={props.currentTime}
            isPlaying={props.isPlaying}
            onPlayPause={props.onPlayPause}
            onStop={props.onStop}
            onUpdateClip={props.onUpdateClip}
            settings={props.settings}
            theme={props.theme}
          />
        </div>

        {/* Watermark branding */}
        <div className="absolute top-4 right-4 pointer-events-none opacity-40 select-none flex items-center gap-1.5">
          <span className="text-[10px] font-black tracking-widest text-white">MOTIONFLUX</span>
          <Store className="w-3.5 h-3.5 text-amber-400" />
        </div>

        {/* Simulated recording visual overlay banner */}
        {isRecording && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-red-600 text-white rounded-full flex items-center gap-1.5 animate-pulse shadow-lg text-xs font-bold z-40">
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>GRAVANDO: {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}</span>
          </div>
        )}

        {/* Captions Generating feedback */}
        {isCaptionsGenerating && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
            <Activity className="w-10 h-10 text-amber-400 animate-spin" />
            <span className="text-white font-bold tracking-wider animate-pulse">GERANDO LEGENDAS COM INTELIGÊNCIA ARTIFICIAL...</span>
          </div>
        )}

        {/* Advanced Properties Drawer */}
        {isPropertiesOpen && selectedClip && (
          <div className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 bg-[#141416] border-l border-white/10 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 bg-[#1c1c1f] border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Propriedades Avançadas</span>
              </div>
              <button 
                onClick={() => setIsPropertiesOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 bg-[#0f0f11]">
              <ClipEditor 
                clip={selectedClip} 
                onUpdateClip={props.onUpdateClip} 
                onRemoveClip={props.onDeleteClip}
                onCommitChange={props.onCommitChange || (() => {})}
                onClose={() => {
                  setIsPropertiesOpen(false);
                  props.setSelectedClipId(null);
                }}
                importedFonts={props.importedFonts}
                onImportFont={props.onImportFont}
                currentTime={props.currentTime}
                setCurrentTime={props.setCurrentTime}
                keyframeMode={props.keyframeMode}
                selectedKeyframeId={props.selectedKeyframeId}
                onUpdateKeyframe={props.onUpdateKeyframe}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Control Row (SkipBack, Play/Pause, SkipForward, Undo, Redo) */}
      <div className="h-12 bg-[#1c1c1f] border-t border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          {/* Expanded timeline vertical size spacer placeholder */}
          <button className="p-2 hover:bg-white/5 rounded-full text-slate-300 transition-colors cursor-pointer" title="Expandir Timeline">
            <Layers className="w-5 h-5 text-amber-400/80" />
          </button>
        </div>

        {/* Middle playback controls */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => props.setCurrentTime(0)} 
            className="p-2 hover:bg-white/5 rounded-full text-amber-200/70 hover:text-white transition-colors cursor-pointer" 
            title="Pular para o Início"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button 
            onClick={props.onPlayPause} 
            className="w-10 h-10 bg-amber-500 hover:bg-amber-400 text-black rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95" 
            title="Play/Pause"
          >
            {props.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          
          <button 
            onClick={() => props.setCurrentTime(props.duration)} 
            className="p-2 hover:bg-white/5 rounded-full text-amber-200/70 hover:text-white transition-colors cursor-pointer" 
            title="Pular para o Fim"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Undo / Redo controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={props.onUndo} 
            disabled={!props.canUndo} 
            className="p-1.5 hover:bg-white/5 rounded-full text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer" 
            title="Desfazer"
          >
            <Undo2 className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={props.onRedo} 
            disabled={!props.canRedo} 
            className="p-1.5 hover:bg-white/5 rounded-full text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer" 
            title="Refazer"
          >
            <Redo2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* 4. Timeline Viewport */}
      <div className="h-56 shrink-0 relative z-10">
        <Timeline 
          clips={props.clips}
          currentTime={props.currentTime}
          duration={props.duration}
          onTimeUpdate={(t) => props.setCurrentTime(t)}
          selectedClipId={props.selectedClipId}
          onSelectClip={props.setSelectedClipId}
          selectedKeyframeId={props.selectedKeyframeId}
          onSelectKeyframe={props.onSelectKeyframe}
          onUpdateClip={props.onUpdateClip}
          onRemoveClip={props.onDeleteClip}
          onAddClip={() => {}}
          theme="nostalgia"
          markers={props.markers}
          onToggleMarker={props.onToggleMarker}
        />
      </div>

      {/* 5. Horizontal Scrolling Bottom Toolbar / Bottom Panel */}
      <div className="h-24 bg-[#111113] border-t border-white/10 relative z-20 shrink-0">
        
        {/* NO CLIP IS SELECTED: Main Mobile Editing Toolbar */}
        {!selectedClip && (
          <div className="w-full h-full flex items-center overflow-x-auto scrollbar-none gap-6 px-6">
            
            {/* 1. Mídia (Video file upload / explorer) */}
            <button 
              onClick={handleMediaClick}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <VideoIcon className="w-5 h-5 text-sky-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Mídia</span>
            </button>

            {/* 2. Camada (Overlay dropdown) */}
            <div className="relative shrink-0">
              <button 
                onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
                className="flex flex-col items-center justify-center w-16 group cursor-pointer border-0"
              >
                <div className={`w-12 h-12 rounded-full ${isLayerMenuOpen ? 'bg-amber-500/30 text-amber-400' : 'bg-zinc-800 text-white'} group-hover:bg-amber-500/20 group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95`}>
                  <Layers className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Camada</span>
              </button>

              {/* Layer drop popup */}
              {isLayerMenuOpen && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-52 bg-[#1d1d21] border border-amber-500/30 rounded-xl p-1.5 z-50 shadow-2xl flex flex-col gap-0.5">
                  <div className="text-[9px] font-black text-amber-400 px-3 py-1 uppercase tracking-wider border-b border-white/5">
                    Inserir Sobreposição
                  </div>
                  <button 
                    onClick={() => {
                      handleAddTextDefault();
                      setIsLayerMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-amber-500/10 rounded-lg flex items-center gap-2 transition-colors cursor-pointer border-0"
                  >
                    <Type className="w-4 h-4 text-amber-400" />
                    <span>Camada de Texto</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsShapeMenuOpen(true);
                      setIsLayerMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-amber-500/10 rounded-lg flex items-center gap-2 transition-colors cursor-pointer border-0"
                  >
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Formas & Desenhos</span>
                  </button>
                  <button 
                    onClick={() => {
                      setMediaFilter('all');
                      setIsMediaModalOpen(true);
                      setIsLayerMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-amber-500/10 rounded-lg flex items-center gap-2 transition-colors cursor-pointer border-0"
                  >
                    <VideoIcon className="w-4 h-4 text-blue-400" />
                    <span>Mídia como Sobreposição</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Áudio (Audio browser) */}
            <button 
              onClick={handleAudioClick}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Music className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Áudio</span>
            </button>

            {/* 4. Combinação de Música (Remix match) */}
            <button 
              onClick={handleBeatMatch}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
              title="Combinação de Música com AI"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Mixagem</span>
            </button>

            {/* 5. Texto */}
            <button 
              onClick={handleAddTextDefault}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Type className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Texto</span>
            </button>

            {/* 6. Legendas Auto */}
            <button 
              onClick={handleAutoCaptions}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
              title="Gerar Legendas Automáticas"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Activity className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Legendas Auto</span>
            </button>

            {/* 7. Texto em voz */}
            <button 
              onClick={handleTTS}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
              title="Narrador Digital (TTS)"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Volume2 className="w-5 h-5 text-teal-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Voz</span>
            </button>

            {/* 8. Adesivo (Stickers/Elements picker) */}
            <button 
              onClick={() => setIsShapeMenuOpen(true)}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Heart className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Adesivo</span>
            </button>

            {/* Câmera */}
            <button 
              onClick={props.onAddCamera}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
              title="Adicionar Câmera Funcional"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-600/30 group-hover:bg-emerald-500/50 text-white group-hover:text-emerald-400 flex items-center justify-center transition-all border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95">
                <Camera className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Câmera</span>
            </button>

            {/* 9. REC voiceover */}
            <button 
              onClick={handleRecClick}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
            >
              <div className={`w-12 h-12 rounded-full ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-zinc-800'} group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95`}>
                <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-rose-500'}`} />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">{isRecording ? "Parar" : "Voz REC"}</span>
            </button>

            {/* 10. AI Auto Edit */}
            <button 
              onClick={props.onAnalyzeWithAI}
              disabled={props.isAnalyzing || props.media.length === 0}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0 disabled:opacity-40"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center transition-all border border-white/10 shadow-md active:scale-95">
                {props.isAnalyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-white" />}
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">AI Auto</span>
            </button>

            {/* Store button */}
            <button 
              onClick={() => setIsStoreModalOpen(true)}
              className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 shadow-md active:scale-95">
                <Store className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-[10px] text-zinc-300 font-bold mt-1.5 tracking-wide">Recursos</span>
            </button>

          </div>
        )}

        {/* ACTIVE CLIP IS SELECTED: Mobile Operations / Properties Menu */}
        {selectedClip && (
          <div className="w-full h-full flex items-center">
            
            {/* Back Chevron to Deselect */}
            <button 
              onClick={() => {
                if (activeSubmenu !== 'none') {
                  setActiveSubmenu('none');
                } else {
                  props.setSelectedClipId(null);
                }
              }}
              className="h-full px-5 bg-zinc-900 text-amber-400 border-r border-white/10 flex flex-col items-center justify-center hover:bg-zinc-800 cursor-pointer border-0"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest mt-1">Voltar</span>
            </button>

            {/* SUBMENU DISPLAY: Opacity (Alfa) */}
            {activeSubmenu === 'alfa' && (
              <div className="flex-1 flex items-center px-6 gap-6">
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-400 uppercase tracking-widest font-bold">Opacidade (Alfa)</span>
                  <span className="text-sm font-black text-amber-300">{Math.round((selectedClip.opacity ?? 1.0) * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={selectedClip.opacity ?? 1.0}
                  onChange={(e) => props.onUpdateClip(selectedClip.id, { opacity: parseFloat(e.target.value) })}
                  className="flex-1 accent-amber-500 h-1 bg-zinc-700 rounded-lg appearance-none"
                />
              </div>
            )}

            {/* SUBMENU DISPLAY: Filter */}
            {activeSubmenu === 'filtro' && (
              <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-4 px-6 py-2">
                {[
                  { name: 'Nenhum', style: 'none', fx: '' },
                  { name: 'Sépia Vintage', style: 'sepia(80%) contrast(120%) brightness(90%)', fx: 'effect-vintage' },
                  { name: 'P&B', style: 'grayscale(100%)', fx: '' },
                  { name: 'Cyberpunk', style: 'hue-rotate(180deg) saturate(1.6)', fx: 'effect-glitch' },
                  { name: 'Borrão', style: 'blur(4px)', fx: 'effect-motion-blur' },
                  { name: 'Pulsar Zoom', style: 'none', fx: 'effect-zoom' },
                  { name: 'Agitação', style: 'none', fx: 'effect-shake' },
                  { name: 'Salto', style: 'none', fx: 'effect-bounce' }
                ].map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => props.onUpdateClip(selectedClip.id, { filter: preset.style, effect: preset.fx })}
                    className={`px-3 py-2 bg-zinc-800 rounded-lg text-xs font-bold transition-all border shrink-0 border-white/5 active:scale-95 cursor-pointer text-white ${selectedClip.effect === preset.fx && selectedClip.filter === preset.style ? 'bg-amber-500 text-black border-amber-400' : 'hover:bg-zinc-700'}`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}

            {/* SUBMENU DISPLAY: Color Picker for Background or Text */}
            {activeSubmenu === 'cor' && (
              <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-4 px-6">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest shrink-0">Cor Sólida</span>
                {[
                  { hex: '#000000', label: 'Preto' },
                  { hex: '#ffffff', label: 'Branco' },
                  { hex: '#ff0000', label: 'Vermelho' },
                  { hex: '#00ff00', label: 'Verde' },
                  { hex: '#0000ff', label: 'Azul' },
                  { hex: '#fbbc05', label: 'Dourado' },
                  { hex: '#ff5c35', label: 'Coral' },
                  { hex: '#9b5de5', label: 'Roxo' },
                  { hex: '#ff006e', label: 'Rosa' }
                ].map(c => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      if (selectedClip.type === 'shape') {
                        props.onUpdateClip(selectedClip.id, { shapeColor: c.hex });
                      } else {
                        props.onUpdateClip(selectedClip.id, { textColor: c.hex });
                      }
                    }}
                    className="w-8 h-8 rounded-full border border-white/20 relative cursor-pointer flex-shrink-0 active:scale-95 transition-all"
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  >
                    {((selectedClip.textColor === c.hex) || (selectedClip.shapeColor === c.hex)) && (
                      <div className="absolute inset-1 rounded-full border-2 border-amber-400" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* SUBMENU DISPLAY: Adjustments */}
            {activeSubmenu === 'ajuste' && (
              <div className="flex-1 flex items-center gap-6 px-6 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Brilho</span>
                  <input 
                    type="range" 
                    min="50" 
                    max="150" 
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-20 accent-amber-500 h-1 bg-zinc-700"
                  />
                  <span className="text-[10px] text-white font-bold">{brightness}%</span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Contraste</span>
                  <input 
                    type="range" 
                    min="50" 
                    max="150" 
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-20 accent-amber-500 h-1 bg-zinc-700"
                  />
                  <span className="text-[10px] text-white font-bold">{contrast}%</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Saturação</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="200" 
                    value={saturation}
                    onChange={(e) => setSaturation(parseInt(e.target.value))}
                    className="w-20 accent-amber-500 h-1 bg-zinc-700"
                  />
                  <span className="text-[10px] text-white font-bold">{saturation}%</span>
                </div>
              </div>
            )}

            {/* SUBMENU DISPLAY: Animation Selection */}
            {activeSubmenu === 'animacao' && (
              <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-4 px-6 py-2">
                {[
                  { id: 'typewriter', label: 'Máquina de Escrever' },
                  { id: 'slide-fade-up', label: 'Deslizar para Cima' },
                  { id: 'zoom-pop', label: 'Pop Zoom' },
                  { id: 'glitch-shake', label: 'Agitação Glitch' },
                  { id: 'bounce-entrance', label: 'Salto' },
                  { id: 'rotate-drop', label: 'Girar e Cair' },
                  { id: 'rainbow-wave', label: 'Onda Arco-Íris' },
                  { id: 'soft-pulse', label: 'Pulso Suave' },
                  { id: 'blur-reveal', label: 'Revelar Borrado' }
                ].map(anim => (
                  <button
                    key={anim.id}
                    onClick={() => props.onUpdateClip(selectedClip.id, { animationType: anim.id })}
                    className={`px-3 py-2 bg-zinc-800 rounded-lg text-xs font-bold transition-all border shrink-0 border-white/5 active:scale-95 cursor-pointer text-white ${selectedClip.animationType === anim.id ? 'bg-amber-500 text-black border-amber-400' : 'hover:bg-zinc-700'}`}
                  >
                    {anim.label}
                  </button>
                ))}
              </div>
            )}

            {/* SUBMENU DISPLAY: Blending Mode */}
            {activeSubmenu === 'mesclagem' && (
              <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-4 px-6 py-2">
                {[
                  { id: 'normal', label: 'Normal' },
                  { id: 'multiply', label: 'Multiplicar (Multiply)' },
                  { id: 'screen', label: 'Tela (Screen)' },
                  { id: 'overlay', label: 'Sobrepor (Overlay)' },
                  { id: 'color-dodge', label: 'Subexposição (Color Dodge)' },
                  { id: 'color-burn', label: 'Superesposição (Color Burn)' },
                  { id: 'difference', label: 'Diferença' }
                ].map(blend => (
                  <button
                    key={blend.id}
                    onClick={() => props.onUpdateClip(selectedClip.id, { blendMode: blend.id })}
                    className={`px-3 py-2 bg-zinc-800 rounded-lg text-xs font-bold transition-all border shrink-0 border-white/5 active:scale-95 cursor-pointer text-white ${selectedClip.blendMode === blend.id ? 'bg-amber-500 text-black border-amber-400' : 'hover:bg-zinc-700'}`}
                  >
                    {blend.label}
                  </button>
                ))}
              </div>
            )}

            {/* SUBMENU DISPLAY: Text Custom Fonts and Style options */}
            {activeSubmenu === 'estilo' && (
              <div className="flex-1 flex items-center gap-6 px-6 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Fonte:</span>
                  {['bebas', 'pacifico', 'oswald', 'inter', 'mono', 'anton', 'cinzel', 'lobster', 'creepster'].map(f => (
                    <button
                      key={f}
                      onClick={() => props.onUpdateClip(selectedClip.id, { fontFamily: f })}
                      className={`px-2.5 py-1 text-[11px] font-bold capitalize bg-zinc-800 rounded border border-white/5 cursor-pointer text-white ${selectedClip.fontFamily === f ? 'bg-amber-500 text-black' : ''}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Tamanho:</span>
                  <input 
                    type="range" 
                    min="0.3" 
                    max="3.0" 
                    step="0.1"
                    value={selectedClip.scale ?? 1.0}
                    onChange={(e) => props.onUpdateClip(selectedClip.id, { scale: parseFloat(e.target.value) })}
                    className="w-24 accent-amber-500"
                  />
                  <span className="text-[10px] text-white font-bold">{Math.round((selectedClip.scale ?? 1.0) * 100)}%</span>
                </div>
                
                <button 
                  onClick={() => {
                    const txt = prompt("Editar Conteúdo do Texto:", selectedClip.textContent || "");
                    if (txt !== null) props.onUpdateClip(selectedClip.id, { textContent: txt, name: `Texto: "${txt.substring(0, 10)}"` });
                  }}
                  className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold border border-amber-500/30 cursor-pointer shrink-0"
                >
                  Editar Texto
                </button>
              </div>
            )}

            {/* STANDARD CLIP PROPERTIES LIST */}
            {activeSubmenu === 'none' && (
              <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-6 px-6">
                
                {/* Propriedades (Toggle Sidebar) */}
                <button 
                  onClick={() => setIsPropertiesOpen(!isPropertiesOpen)}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 ${isPropertiesOpen ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400'}`}>
                    <Settings className="w-4.5 h-4.5" />
                  </div>
                  <span className={`text-[9px] font-bold mt-1 ${isPropertiesOpen ? 'text-amber-400' : 'text-zinc-300'}`}>Propriedades</span>
                </button>
                
                {/* Substituir (File folder replace) */}
                <button 
                  onClick={handleReplaceMediaClick}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Folder className="w-4.5 h-4.5 text-sky-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Substituir</span>
                </button>

                {/* Cor selector (Only show for shapes or text) */}
                {((selectedClip.type === 'shape') || (selectedClip.type === 'text')) && (
                  <button 
                    onClick={() => setActiveSubmenu('cor')}
                    className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                      <Palette className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <span className="text-[9px] text-zinc-300 font-bold mt-1">Cor</span>
                  </button>
                )}

                {/* Filtro (Vintage, mono, etc.) */}
                <button 
                  onClick={() => setActiveSubmenu('filtro')}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Palette className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Filtro</span>
                </button>

                {/* Ajuste (Sliders submenu) */}
                <button 
                  onClick={() => setActiveSubmenu('ajuste')}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Sliders className="w-4.5 h-4.5 text-purple-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Ajuste</span>
                </button>

                {/* Opacidade / Alfa slider */}
                <button 
                  onClick={() => setActiveSubmenu('alfa')}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Volume2 className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Opacidade</span>
                </button>

                {/* Estilo de Camada / Fonte (For Text) */}
                {selectedClip.type === 'text' && (
                  <button 
                    onClick={() => setActiveSubmenu('estilo')}
                    className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                      <Type className="w-4.5 h-4.5 text-yellow-400" />
                    </div>
                    <span className="text-[9px] text-zinc-300 font-bold mt-1">Estilo</span>
                  </button>
                )}

                {/* Animação Selection (For Overlays and Layers) */}
                <button 
                  onClick={() => setActiveSubmenu('animacao')}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Sparkles className="w-4.5 h-4.5 text-pink-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Animação</span>
                </button>

                {/* Mesclagem Blend Modes (For overlays) */}
                <button 
                  onClick={() => setActiveSubmenu('mesclagem')}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Layers className="w-4.5 h-4.5 text-violet-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Mesclagem</span>
                </button>

                {/* Chroma Key Toggler */}
                <button 
                  onClick={() => props.onUpdateClip(selectedClip.id, { chromaKeyEnabled: !selectedClip.chromaKeyEnabled })}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                  title="Chroma Key (Fundo Verde)"
                >
                  <div className={`w-10 h-10 rounded-full ${selectedClip.chromaKeyEnabled ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-white'} group-hover:bg-amber-500/20 group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95`}>
                    <Activity className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Chroma Key</span>
                </button>

                {/* Separar (Split) */}
                <button 
                  onClick={() => props.onSplitClip(selectedClip.id, props.currentTime)}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Scissors className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Separar</span>
                </button>

                {/* Duplicar (Duplicate) */}
                <button 
                  onClick={() => props.onDuplicateClip(selectedClip.id)}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Copy className="w-4.5 h-4.5 text-zinc-400" />
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold mt-1">Duplicar</span>
                </button>

                {/* Adicionar como Camada (Move to overlay v2) */}
                {selectedClip.trackId !== 'v2' && (
                  <button 
                    onClick={() => props.onUpdateClip(selectedClip.id, { trackId: 'v2' })}
                    className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                    title="Mover para Camada Sobreposta"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                      <Layers className="w-4.5 h-4.5 text-teal-400" />
                    </div>
                    <span className="text-[9px] text-zinc-300 font-bold mt-1">Como Camada</span>
                  </button>
                )}

                {/* Mover para Trilha Principal */}
                {selectedClip.trackId === 'v2' && (
                  <button 
                    onClick={() => props.onUpdateClip(selectedClip.id, { trackId: 'v1' })}
                    className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                    title="Mover para Trilha Principal"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                      <Layers className="w-4.5 h-4.5 text-indigo-400" />
                    </div>
                    <span className="text-[9px] text-zinc-300 font-bold mt-1">Principal</span>
                  </button>
                )}

                {/* Deletar (Trash) */}
                <button 
                  onClick={() => props.onDeleteClip(selectedClip.id)}
                  className="flex flex-col items-center justify-center shrink-0 w-16 group cursor-pointer border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-red-500/20 text-white hover:text-red-400 flex items-center justify-center transition-all border border-white/5 active:scale-95">
                    <Trash2 className="w-4.5 h-4.5 text-red-500" />
                  </div>
                  <span className="text-[9px] text-red-500 font-bold mt-1">Deletar</span>
                </button>

              </div>
            )}

          </div>
        )}

      </div>

      {/* Media Browser Modal (Mídia & Áudio) */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#19191d] border border-amber-500/20 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="bg-[#222228] px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {mediaFilter === 'audio' ? <Music className="w-6 h-6 text-emerald-400" /> : <VideoIcon className="w-6 h-6 text-amber-400" />}
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {mediaFilter === 'audio' ? 'Biblioteca de Áudio' : 'Navegador de Mídia'}
                </h3>
              </div>
              <button 
                onClick={() => setIsMediaModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <MediaPool 
                media={mediaFilter === 'audio' ? props.media.filter(m => m.type === 'audio') : props.media} 
                onAddMedia={props.onAddMedia}
                onRemoveMedia={props.onRemoveMedia}
                onDragStart={() => {}}
                onClickAdd={(item) => {
                  props.onClickAdd(item);
                  setIsMediaModalOpen(false);
                }}
                onClickAddOverlay={(item) => {
                  props.onClickAddOverlay(item);
                  setIsMediaModalOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Shapes Selector Modal */}
      {isShapeMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#19191d] border border-amber-500/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#222228] px-5 py-3 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white">Adicionar Elemento</h3>
              <button onClick={() => setIsShapeMenuOpen(false)} className="text-slate-400 hover:text-white cursor-pointer border-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4">
              {[
                { type: 'circle' as const, label: 'Círculo', icon: '●' },
                { type: 'square' as const, label: 'Quadrado', icon: '■' },
                { type: 'triangle' as const, label: 'Triângulo', icon: '▲' },
                { type: 'star-4' as const, label: 'Estrela 4P', icon: '✦' },
                { type: 'star-5' as const, label: 'Estrela 5P', icon: '★' },
                { type: 'oval-custom' as const, label: 'Oval', icon: '⬭' }
              ].map(shape => (
                <button
                  key={shape.type}
                  onClick={() => {
                    props.onAddShape(shape.type);
                    setIsShapeMenuOpen(false);
                  }}
                  className="bg-[#2a2a35] hover:bg-amber-500/20 border border-white/5 hover:border-amber-500/30 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 cursor-pointer text-slate-200 border-0"
                >
                  <span className="text-3xl font-bold text-amber-400">{shape.icon}</span>
                  <span className="text-xs font-semibold">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Asset Store Modal (bottom left) */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#19191d] border border-amber-500/20 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#222228] px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-amber-400">
                <Store className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white tracking-wide">Recursos da Loja (MasterFlux Nostalgia)</h3>
              </div>
              <button onClick={() => setIsStoreModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer border-0">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Presets/Fonts */}
              <div className="bg-[#22222a] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="font-bold text-amber-300 border-b border-white/10 pb-2">Fontes Premium Retro</h4>
                {[
                  { name: 'Bebas Neue', desc: 'Heading ousado e compacto' },
                  { name: 'Pacifico', desc: 'Cursiva elegante e fluida' },
                  { name: 'Oswald', desc: 'Display robusto e moderno' }
                ].map(font => (
                  <button 
                    key={font.name}
                    onClick={() => {
                      if (props.selectedClipId) {
                        props.onUpdateClip(props.selectedClipId, { fontFamily: font.name.toLowerCase().replace(' ', '-') });
                        alert(`Fonte aplicada com sucesso ao clipe selecionado: ${font.name}`);
                      } else {
                        alert(`Para aplicar a fonte, selecione primeiro um clipe de texto na timeline!`);
                      }
                    }}
                    className="w-full text-left bg-white/5 hover:bg-amber-500/10 border border-white/5 p-3 rounded-lg flex justify-between items-center transition-all hover:translate-x-1 cursor-pointer border-0"
                  >
                    <div>
                      <p className="font-semibold text-white">{font.name}</p>
                      <p className="text-xs text-slate-400">{font.desc}</p>
                    </div>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold uppercase">Baixar</span>
                  </button>
                ))}
              </div>
              
              {/* FX effects */}
              <div className="bg-[#22222a] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="font-bold text-amber-300 border-b border-white/10 pb-2">Efeitos Visuais Analógicos</h4>
                {[
                  { id: 'effect-glitch', name: 'Digital Glitch', desc: 'Distorção cyberpunk com cores saturadas' },
                  { id: 'effect-vintage', name: 'Super 8 Vintage', desc: 'Sepia, contraste e ruído analógico clássico' },
                  { id: 'effect-motion-blur', name: 'Velocidade Borrada', desc: 'Borrão de movimento dinâmico' }
                ].map(fx => (
                  <button 
                    key={fx.id}
                    onClick={() => {
                      if (props.selectedClipId) {
                        props.onUpdateClip(props.selectedClipId, { effect: fx.id });
                        alert(`Efeito visual aplicado com sucesso ao clipe selecionado: ${fx.name}`);
                      } else {
                        alert(`Para aplicar o efeito, selecione um clipe na timeline primeiro!`);
                      }
                    }}
                    className="w-full text-left bg-white/5 hover:bg-amber-500/10 border border-white/5 p-3 rounded-lg flex justify-between items-center transition-all hover:translate-x-1 cursor-pointer border-0"
                  >
                    <div>
                      <p className="font-semibold text-white">{fx.name}</p>
                      <p className="text-xs text-slate-400">{fx.desc}</p>
                    </div>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold uppercase">Aplicar</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
