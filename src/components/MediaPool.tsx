import React, { useRef, useEffect } from 'react';
import { MediaItem } from '../types';
import { Plus, Image as ImageIcon, Video, Music, Trash2, Layers } from 'lucide-react';
import { cn, setupTouchDragScroll } from '../utils';

interface MediaPoolProps {
  media: MediaItem[];
  onAddMedia: (files: FileList) => void;
  onRemoveMedia: (id: string) => void;
  onDragStart: (e: React.DragEvent, item: MediaItem) => void;
  onClickAdd: (item: MediaItem) => void;
  onClickAddOverlay?: (item: MediaItem) => void;
}

export function MediaPool({ media, onAddMedia, onRemoveMedia, onDragStart, onClickAdd, onClickAddOverlay }: MediaPoolProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaPoolScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mediaPoolScrollRef.current;
    if (el) {
      return setupTouchDragScroll(el);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddMedia(e.target.files);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-3.5 h-3.5" />;
      case 'audio': return <Music className="w-3.5 h-3.5" />;
      default: return <ImageIcon className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-col md:h-full bg-[#0d0d0d] border-b md:border-b-0 md:border-r border-white/5 p-2 md:p-4 w-full md:w-72 shrink-0 h-28 md:h-auto z-40">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
      />

      <div ref={mediaPoolScrollRef} className="flex-1 flex md:flex-col overflow-x-auto md:overflow-y-auto space-x-4 md:space-x-0 md:space-y-6 md:pr-2 custom-scrollbar items-center md:items-stretch">
        <div className="flex-shrink-0 w-20 md:w-auto text-center md:text-left">
          <h3 className="hidden md:block text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-3">Importar</h3>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="md:border-2 md:border-dashed md:border-white/10 rounded-xl p-2 md:p-4 flex flex-col items-center justify-center gap-1 md:gap-2 hover:border-indigo-500/50 cursor-pointer group transition-colors"
          >
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-indigo-500/20 md:bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 md:w-4 md:h-4 text-indigo-400" />
            </div>
            <span className="text-[9px] md:text-[11px] text-slate-400">Adicionar</span>
          </div>
        </div>

        {media.length > 0 && (
          <div className="flex flex-row md:flex-col gap-2 md:space-y-3 h-full md:h-auto items-center md:items-stretch">
            <h3 className="hidden md:block text-[10px] uppercase tracking-widest text-slate-500 font-bold">Recentes</h3>
            <div className="flex flex-row md:flex-col gap-2 h-full md:h-auto pt-1 md:pt-0">
              {media.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  className="group relative flex flex-col md:flex-row items-center gap-1 md:gap-3 p-1 md:p-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg cursor-pointer active:cursor-grabbing border border-white/5 transition-colors w-16 md:w-auto h-full md:h-auto"
                >
                  <div className="w-10 h-10 md:w-10 md:h-10 rounded-lg bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                    {item.type === 'image' || item.type === 'video' ? (
                       <img src={item.dataUrl} className="w-full h-full object-cover" alt={item.name} />
                    ) : (
                      <Music className="w-4 h-4 text-indigo-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-center md:text-left w-full hidden md:block">
                    <p className="text-[11px] font-medium text-slate-200 truncate">{item.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                      {getIcon(item.type)}
                      <span>{item.type}</span>
                    </div>
                  </div>
                  
                  {/* Real visual buttons to trigger quick Timeline placement */}
                  <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity rounded-lg z-30 px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onClickAdd(item); }}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-[9px] font-bold flex items-center gap-0.5 shadow transition-all hover:scale-105 active:scale-95"
                      title="Adicionar à Linha Principal (V1)"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>V1</span>
                    </button>
                    {(item.type === 'video' || item.type === 'image') && onClickAddOverlay && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onClickAddOverlay(item); }}
                        className="p-1.5 bg-violet-600 hover:bg-violet-500 rounded text-white text-[9px] font-bold flex items-center gap-0.5 shadow transition-all hover:scale-105 active:scale-95"
                        title="Adicionar como Sobreposição (V2)"
                      >
                        <Layers className="w-2.5 h-2.5" />
                        <span>V2</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveMedia(item.id); }}
                    className="absolute -top-1 -right-1 md:relative md:top-0 md:right-0 opacity-0 group-hover:opacity-100 p-1 md:p-1.5 bg-black md:bg-transparent text-slate-500 hover:text-red-400 transition-all rounded-full z-40"
                  >
                    <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
