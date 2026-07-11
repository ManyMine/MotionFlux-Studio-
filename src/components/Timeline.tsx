import React, { useRef, useEffect } from 'react';
import { TimelineClip } from '../types';
import { formatTime, cn, setupTouchDragScroll } from '../utils';
import { getEasingIcon } from './ClipEditor';
import { X, Eye, EyeOff, Image as ImageIcon, Music, Square, Camera, Video, Type } from 'lucide-react';

interface TimelineProps {
  clips: TimelineClip[];
  onAddClip: (clip: TimelineClip) => void;
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
  onRemoveClip: (id: string) => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  duration: number;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  selectedKeyframeId: string | null;
  onSelectKeyframe: (id: string | null) => void;
  theme?: 'padrão' | 'nostalgia' | 'simple';
  markers?: number[];
  onToggleMarker?: (time: number) => void;
}

const PIXELS_PER_SECOND = 40;

export function Timeline({
  clips,
  onAddClip,
  onUpdateClip,
  onRemoveClip,
  currentTime,
  onTimeUpdate,
  duration,
  selectedClipId,
  onSelectClip,
  selectedKeyframeId,
  onSelectKeyframe,
  theme = 'padrão',
  markers = [],
  onToggleMarker
}: TimelineProps) {
  const tracks = [
    { id: 'c1', name: 'Câmera', type: 'camera' },
    { id: 'v2', name: 'V2 (Sobrep.)', type: 'video' },
    { id: 'v1', name: 'V1', type: 'video' },
    { id: 't1', name: 'T1', type: 'text' },
    { id: 'a1', name: 'A1', type: 'audio' },
  ];

  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = React.useState(800);
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    const el = tracksContainerRef.current;
    if (!el) return;
    
    // Resize Observer to keep track of the available width
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);

    // Setup touch scroll if any
    const cleanupScroll = setupTouchDragScroll(el);

    return () => {
      observer.disconnect();
      if (cleanupScroll) cleanupScroll();
    };
  }, []);

  const headerWidth = 96; // 24 * 4px = 96px (w-24)
  const scrollViewportWidth = Math.max(200, viewportWidth - headerWidth);
  const halfViewport = scrollViewportWidth / 2;

  // Sync scroll on currentTime updates
  useEffect(() => {
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    const targetScroll = currentTime * PIXELS_PER_SECOND;
    if (tracksContainerRef.current) {
      tracksContainerRef.current.scrollLeft = targetScroll;
    }
    if (rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = targetScroll;
    }
  }, [currentTime, halfViewport]);
  
  const handleScrollTracks = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (rulerScrollRef.current && rulerScrollRef.current.scrollLeft !== scrollLeft) {
      rulerScrollRef.current.scrollLeft = scrollLeft;
    }
    
    const newTime = scrollLeft / PIXELS_PER_SECOND;
    if (Math.abs(newTime - currentTime) > 0.01) {
      isProgrammaticScrollRef.current = true;
      onTimeUpdate(newTime);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    try {
      const isMove = e.dataTransfer.getData('text/plain') === 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      
      // Calculate start time based on drop position, adjusting for nostalgia halfViewport offset
      const relativeOffset = theme === 'nostalgia' ? (offsetX - halfViewport) : offsetX;
      const startTime = Math.max(0, relativeOffset / PIXELS_PER_SECOND);

      if (isMove) {
        const clipId = e.dataTransfer.getData('clipId');
        if (clipId) {
          onUpdateClip(clipId, { startTime, trackId });
          return;
        }
      }

      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const mediaItem = JSON.parse(data);
      
      onAddClip({
        ...mediaItem,
        id: Math.random().toString(36).substring(7),
        trackId,
        startTime,
        clipStartOffset: 0,
        clipEndOffset: mediaItem.duration,
      });
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newTime = Math.max(0, offsetX / PIXELS_PER_SECOND);
      onTimeUpdate(newTime);
    }
  };

  const cycleTransition = (clipId: string, currentTransition?: string) => {
    const transitions = [
      '', 'dissolve', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 
      'zoom', 'spin', 'wipe-left', 'wipe-right', 'color-flash-white', 'color-flash-black', 'ripple'
    ];
    const idx = transitions.indexOf(currentTransition || '');
    const nextIdx = (idx + 1) % transitions.length;
    onUpdateClip(clipId, { transitionNext: transitions[nextIdx] || undefined });
  };

  const totalWidth = Math.max(duration * PIXELS_PER_SECOND, 800);
  const scrollContentWidth = totalWidth + halfViewport * 2;

  return (
    <footer className="flex flex-col h-64 bg-[#0d0d0d] border-t border-white/10 overflow-hidden shrink-0 relative">
      {/* Time ruler */}
      <div className="h-8 border-b border-white/5 bg-white/[0.02] flex items-end relative overflow-hidden">
         <div className="w-24 bg-[#0a0a0a] border-r border-white/5 shrink-0 sticky left-0 z-40 h-full flex items-center justify-center text-[9px] font-mono text-white/30 uppercase tracking-widest">
           Timeline
         </div>
         <div 
            className="relative h-full flex-1 cursor-text overflow-hidden"
            onClick={(e) => {
              handleTimelineClick(e);
              onSelectClip(null);
            }}
            ref={rulerScrollRef}
         >
            <div style={{ width: `${scrollContentWidth}px`, height: '100%', position: 'relative' }}>
              <div 
                style={{ position: 'absolute', left: `${halfViewport}px`, width: `${totalWidth}px`, height: '100%' }}
                ref={timelineRef}
              >

                {/* Markers */}
                {markers.map((m, idx) => (
                  <div 
                    key={`marker-${idx}`}
                    className="absolute top-0 bottom-0 w-[10px] -ml-[5px] z-30 pointer-events-auto cursor-pointer flex flex-col items-center"
                    style={{ left: `${m * PIXELS_PER_SECOND}px` }}
                    title={`Marcador: ${formatTime(m)} (Clique para remover)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleMarker) onToggleMarker(m);
                    }}
                  >
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-amber-500 drop-shadow-md" />
                  </div>
                ))}

                {/* Ticks */}
                {Array.from({ length: Math.ceil(totalWidth / PIXELS_PER_SECOND) + 1 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${i * PIXELS_PER_SECOND}px` }}
                  >
                    {i % 10 === 0 && (
                      <span className="text-[9px] text-white/20 font-mono mb-1 absolute bottom-1 -translate-x-1/2">
                        {formatTime(i)}
                      </span>
                    )}
                    <div className={cn("w-px bg-white/10", i % 10 === 0 ? "h-2.5" : "h-1")} />
                  </div>
                ))}
              </div>
            </div>
         </div>
      </div>

      {/* Tracks */}
      <div 
         ref={tracksContainerRef}
         className="flex-1 overflow-auto flex flex-col relative bg-[#0d0d0d] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA2MCA0OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik01OS41IDBoMXY0OGgtMXoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L2c+PC9zdmc+')]"
         onScroll={handleScrollTracks}
      >
        <div className="flex relative min-h-full" style={{ width: `${scrollContentWidth}px` }}>
          {/* Fixed Track Controls Layer */}
          <div className={cn("w-24 border-r border-white/5 sticky left-0 z-40 flex flex-col shrink-0 min-h-full", theme === 'simple' ? "bg-[#1c1c1c]" : "bg-[#0a0a0a]")}>
            {tracks.map(track => {
              const TrackIcon = track.type === 'camera' ? Camera :
                               track.type === 'video' ? Video :
                               track.type === 'text' ? Type :
                               track.type === 'audio' ? Music :
                               track.type === 'image' ? ImageIcon : Square;

              if (theme === 'simple') {
                return (
                  <div key={`header-${track.id}`} className="h-14 border-b border-white/5 flex items-center justify-between px-2 text-slate-400">
                    <button className="p-1 hover:text-white bg-[#222222] rounded-full">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1">
                       <TrackIcon className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                );
              }
              return (
                <div key={`header-${track.id}`} className="h-14 border-b border-white/5 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white/30 uppercase">{track.name}</span>
                </div>
              );
            })}
          </div>

          {/* Tracks Content Layer */}
          <div 
            className="flex-1 flex flex-col relative" 
            style={{ position: 'absolute', left: `${halfViewport + headerWidth}px`, width: `${totalWidth}px` }} 
            onClick={() => onSelectClip(null)}
          >
            {/* Marker Vertical Lines */}
            {markers.map((m, idx) => (
              <div 
                key={`track-marker-${idx}`}
                className="absolute top-0 bottom-0 w-[1px] bg-amber-500/50 pointer-events-none z-30 border-l border-dashed border-amber-500/60"
                style={{ left: `${m * PIXELS_PER_SECOND}px` }}
              />
            ))}
            {tracks.map(track => (
              <div 
                key={track.id} 
                className="h-14 border-b border-white/5 relative group w-full"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, track.id)}
              >
                {clips.filter(c => c.trackId === track.id).sort((a, b) => a.startTime - b.startTime).map((clip, index, arr) => {
                  const width = (clip.clipEndOffset - clip.clipStartOffset) * PIXELS_PER_SECOND;
                  const left = clip.startTime * PIXELS_PER_SECOND;
                  
                  const isSelected = selectedClipId === clip.id;

                  const bgClass = clip.type === 'camera'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : clip.type === 'audio' 
                    ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                    : clip.type === 'text'
                    ? 'bg-amber-600/30 border-amber-500/50 text-amber-300'
                    : track.id === 'v2'
                    ? 'bg-violet-600/40 border-violet-500/50 text-violet-200'
                    : 'bg-indigo-600/40 border-indigo-500/50 text-white';
                  
                  const nextClip = arr[index + 1];
                  const isAdjacent = nextClip && Math.abs((clip.startTime + (clip.clipEndOffset - clip.clipStartOffset)) - nextClip.startTime) < 0.1;
                  
                  return (
                    <React.Fragment key={clip.id}>
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', 'move');
                          e.dataTransfer.setData('clipId', clip.id);
                        }}
                        className={cn(
                          "absolute top-2 bottom-2 border rounded flex items-center justify-between px-2 overflow-hidden shadow-sm cursor-pointer transition-colors group/clip gap-2 active:opacity-50",
                          bgClass,
                          isSelected ? "ring-2 ring-white z-10" : "hover:brightness-110"
                        )}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip.id);
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {getEasingIcon(clip.easing)}
                          <span className="text-[10px] font-bold truncate">
                            {clip.name} {clip.textContent ? `- ${clip.textContent}` : ''}
                          </span>
                        </div>
                        
                        {/* Keyframe indicators */}
                        {clip.keyframes && clip.keyframes.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none z-10">
                            {clip.keyframes.map(kf => (
                              <div 
                                key={kf.id}
                                className={cn(
                                  "absolute w-2 h-2 rotate-45 border border-white/60 shadow-md cursor-pointer pointer-events-auto hover:scale-125 transition-transform",
                                  selectedKeyframeId === kf.id ? "bg-amber-400 scale-110 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-white"
                                )}
                                style={{ left: `${(kf.time / 100) * width - 4}px`, top: '50%', marginTop: '-4px' }}
                                title={`Keyframe: ${kf.time}%`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectKeyframe(kf.id);
                                }}
                              />
                            ))}
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveClip(clip.id);
                          }}
                          className="opacity-0 group-hover/clip:opacity-100 p-0.5 text-slate-300 hover:text-red-400 bg-black/40 rounded transition-opacity"
                          title="Excluir clipe"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      
                      {isAdjacent && (track.id === 'v1' || track.id === 'v2') && (
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center cursor-pointer group"
                          style={{ left: `${left + width - 10}px`, width: '20px', height: '20px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleTransition(clip.id, clip.transitionNext);
                          }}
                          title={`Transição: ${clip.transitionNext || 'Nenhuma'} (Clique para mudar)`}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-[4px] border border-white/20 flex items-center justify-center shadow-lg transition-colors group-hover:border-white",
                            clip.transitionNext ? "bg-indigo-600 text-white animate-pulse" : "bg-[#1a1a1a] text-slate-500"
                          )}>
                            {clip.transitionNext ? (
                               <span className="text-[8px] font-mono font-bold">TR</span>
                            ) : (
                               <span className="text-[10px]">+</span>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
          
        </div>
      </div>

      {/* FIXED CENTRED PLAYHEAD LINE FOR BOTH THEMES */}
      <div 
        className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none shadow-[0_0_12px_rgba(239,68,68,0.9)]"
        style={{ left: 'calc(50% + 48px)' }}
      >
        {theme === 'nostalgia' ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleMarker) onToggleMarker(currentTime);
            }}
            className="absolute top-0 -translate-x-1/2 -translate-y-1/2 bg-red-600 hover:bg-amber-500 border border-red-500 hover:border-amber-400 text-[10px] text-white font-mono px-2 py-0.5 rounded-full font-black shadow-lg cursor-pointer z-50 flex items-center justify-center tracking-wide min-w-[70px] select-none transition-all active:scale-95"
            title="Clique para adicionar/remover marcador neste tempo"
          >
            {formatTime(currentTime)}
          </button>
        ) : (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleMarker) onToggleMarker(currentTime);
            }}
            className="absolute top-0 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-amber-500 border border-indigo-500 hover:border-amber-400 text-[10px] text-white font-sans px-2.5 py-0.5 rounded-md font-bold shadow-lg cursor-pointer z-50 flex items-center justify-center tracking-wider min-w-[64px] gap-1 select-none transition-all active:scale-95"
            title="Clique para adicionar/remover marcador neste tempo"
          >
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping absolute -left-0.5 top-1/2 -translate-y-1/2" />
            <span>{formatTime(currentTime)}</span>
          </button>
        )}
      </div>
    </footer>
  );
}
