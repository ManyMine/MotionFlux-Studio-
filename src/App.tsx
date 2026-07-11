import React, { useState, useEffect, useRef } from 'react';
import { MediaPool } from './components/MediaPool';
import { Timeline } from './components/Timeline';
import { PreviewCanvas } from './components/PreviewCanvas';
import { ClipEditor } from './components/ClipEditor';
import { StartScreen, Project } from './components/StartScreen';
import { NostalgiaStartScreen } from './components/NostalgiaStartScreen';
import { NostalgiaEditor } from './components/NostalgiaEditor';
import { MediaItem, TimelineClip } from './types';
import { 
  Wand2, Download, Share, Loader2, Video as VideoIcon, 
  Type, Scissors, Copy, Undo2, Redo2, Trash2, Settings, X, Zap, Sparkles, Edit2, Cpu, Shapes, Camera, Mic
} from 'lucide-react';
import { cn, getInterpolatedProperties, makeDistortionCurve } from './utils';
import { exportVideoOffline } from './utils/exportOffline';
import { saveMediaFile, deleteMediaFile, restoreProjectMediaUrls } from './utils/mediaDb';

interface EditorSettings {
  aspectRatio: string;
  quality: '720p' | '1080p' | '4K';
  fps: number;
  globalAnimationSpeed?: number;
}

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

function getDimensions(aspectRatio: string, quality: string) {
  let baseHeight = 1080;
  if (quality === '720p') baseHeight = 720;
  else if (quality === '4K') baseHeight = 2160;

  let w = 1920;
  let h = 1080;

  switch (aspectRatio) {
    case '16/9':
      h = baseHeight;
      w = Math.round((h * 16) / 9);
      break;
    case '9/16':
      w = baseHeight;
      h = Math.round((w * 16) / 9);
      break;
    case '1/1':
      w = baseHeight;
      h = baseHeight;
      break;
    case '4/3':
      h = baseHeight;
      w = Math.round((h * 4) / 3);
      break;
    case '21/9':
      h = baseHeight;
      w = Math.round((h * 21) / 9);
      break;
    case '4/5':
      w = baseHeight;
      h = Math.round((w * 5) / 4);
      break;
    case '3/2':
      h = baseHeight;
      w = Math.round((h * 3) / 2);
      break;
    default:
      if (aspectRatio && aspectRatio.includes('/')) {
        const parts = aspectRatio.split('/');
        const numW = parseFloat(parts[0]);
        const numH = parseFloat(parts[1]);
        if (!isNaN(numW) && !isNaN(numH) && numH > 0) {
          h = baseHeight;
          w = Math.round((h * numW) / numH);
          break;
        }
      }
      w = baseHeight;
      h = Math.round((w * 16) / 9);
  }

  return { width: w, height: h };
}

export default function App() {
  const [theme, setThemeState] = useState<'padrão' | 'nostalgia'>(() => (localStorage.getItem('mf-theme') as 'padrão' | 'nostalgia') || 'padrão');

  const setTheme = (t: 'padrão' | 'nostalgia') => {
    setThemeState(t);
    localStorage.setItem('mf-theme', t);
  };
  const [keyframeMode, setKeyframeMode] = useState<'simple' | 'advanced'>('advanced');
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(() => {
    return localStorage.getItem('vid-editor-current-project-id');
  });

  const setCurrentProjectId = (id: string | null) => {
    setCurrentProjectIdState(id);
    if (id) {
      localStorage.setItem('vid-editor-current-project-id', id);
    } else {
      localStorage.removeItem('vid-editor-current-project-id');
    }
  };

  const [media, setMedia] = useState<MediaItem[]>([]);
  
  const [userSession, setUserSession] = useState<{ email: string; name: string; isLoggedIn: boolean; method?: string }>(() => {
    const saved = localStorage.getItem('vid-user-session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { email: '', name: '', isLoggedIn: false, method: '' };
  });
  
  // Undo/Redo Timeline History Engine
  const [clips, setClipsState] = useState<TimelineClip[]>([]);
  const [history, setHistory] = useState<TimelineClip[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [settings, setSettings] = useState<EditorSettings>({
    aspectRatio: '9/16',
    quality: '1080p',
    fps: 30,
    globalAnimationSpeed: 1.0
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [isTransparent, setIsTransparent] = useState(false);
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recSecondsMic, setRecSecondsMic] = useState(0);
  const mediaRecorderMicRef = useRef<MediaRecorder | null>(null);
  const audioChunksMicRef = useRef<Blob[]>([]);
  const audioStreamMicRef = useRef<MediaStream | null>(null);
  const recIntervalMicRef = useRef<any>(null);

  const [markers, setMarkers] = useState<number[]>([]);

  const handleToggleMarker = (time: number) => {
    const roundedTime = Math.round(time * 100) / 100;
    setMarkers(prev => {
      const exists = prev.some(m => Math.abs(m - roundedTime) < 0.15);
      if (exists) {
        return prev.filter(m => Math.abs(m - roundedTime) >= 0.15);
      } else {
        return [...prev, roundedTime].sort((a, b) => a - b);
      }
    });
  };
  const [projectTrigger, setProjectTrigger] = useState(0);
  const [isAntiLagEnabled, setIsAntiLagEnabled] = useState<boolean>(() => {
    return localStorage.getItem('vid-anti-lag') === 'true';
  });

  // Load Google Fonts
  useEffect(() => {
    const fonts = [
      'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 
      'Merriweather', 'Nunito', 'Raleway', 'Poppins', 'Ubuntu', 
      'Mukta', 'Lora', 'Rubik', 'Noto Sans', 
      'Work Sans', 'Fira Sans', 'Quicksand', 'Karla', 'Inconsolata', 'Josefin Sans'
    ];
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=' + fonts.map(f => f.replace(/ /g, '+') + ':wght@400;700').join('&family=') + '&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const getActiveProjectName = () => {
    // Reference projectTrigger to force React re-render when name updates
    const _dummy = projectTrigger;
    try {
      const saved = localStorage.getItem('vid-editor-projects');
      if (saved) {
        const list: Project[] = JSON.parse(saved);
        const proj = list.find(p => p.id === currentProjectId);
        return proj ? proj.name : 'Projeto Sem Nome';
      }
    } catch (e) {}
    return 'Projeto Sem Nome';
  };

  const handleRenameActiveProject = () => {
    if (!currentProjectId) return;
    const currentName = getActiveProjectName();
    const newName = prompt("Digite o novo nome do projeto:", currentName);
    if (newName && newName.trim()) {
      handleRenameProject(currentProjectId, newName.trim());
      setProjectTrigger(prev => prev + 1);
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleDeleteActiveProject = () => {
    if (!currentProjectId) return;
    if (confirm("Tem certeza que deseja excluir permanentemente o projeto atual? Você voltará ao painel inicial.")) {
      handleDeleteProject(currentProjectId);
      setProjectTrigger(prev => prev + 1);
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (!currentProjectId) return;
    
    try {
      const savedProjects = localStorage.getItem('vid-editor-projects');
      let projectsList: Project[] = savedProjects ? JSON.parse(savedProjects) : [];
      
      const updatedSettings = {
        ...settings,
        bgColor: backgroundColor
      };
      
      const projectIndex = projectsList.findIndex(p => p.id === currentProjectId);
      if (projectIndex >= 0) {
        projectsList[projectIndex] = {
          ...projectsList[projectIndex],
          media,
          clips,
          settings: updatedSettings,
          updatedAt: Date.now()
        };
      } else {
        projectsList.push({
          id: currentProjectId,
          name: 'Projeto Sem Nome',
          media,
          clips,
          settings: updatedSettings,
          updatedAt: Date.now()
        });
      }
      
      localStorage.setItem('vid-editor-projects', JSON.stringify(projectsList));
    } catch (e) {
      console.error("Error auto-saving project:", e);
    }
  }, [clips, media, settings, backgroundColor, currentProjectId]);

  // Handle projects list operations
  const handleSwitchTheme = () => {
    const newTheme = theme === 'padrão' ? 'nostalgia' : 'padrão';
    setTheme(newTheme);
    localStorage.setItem('mf-theme', newTheme);
  };

  const handleCreateProject = (name: string, aspectRatio: string, bgColor?: string) => {
    const newId = Math.random().toString(36).substring(7);
    const initialBgColor = bgColor || '#000000';
    const newProj: Project = {
      id: newId,
      name,
      media: [],
      clips: [],
      settings: {
        aspectRatio,
        quality: '1080p',
        fps: 30,
        bgColor: initialBgColor,
        globalAnimationSpeed: 1.0
      },
      updatedAt: Date.now()
    };
    
    try {
      const saved = localStorage.getItem('vid-editor-projects');
      const list: Project[] = saved ? JSON.parse(saved) : [];
      list.push(newProj);
      localStorage.setItem('vid-editor-projects', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
    
    setCurrentProjectId(newId);
    setMedia([]);
    setClipsState([]);
    setSettings({
      aspectRatio,
      quality: '1080p',
      fps: 30,
      bgColor: initialBgColor,
      globalAnimationSpeed: 1.0
    });
    setBackgroundColor(initialBgColor);
    setIsTransparent(false);
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedClipId(null);
  };

  const handleOpenProject = async (id: string) => {
    try {
      const saved = localStorage.getItem('vid-editor-projects');
      if (saved) {
        const list: Project[] = JSON.parse(saved);
        let proj = list.find(p => p.id === id);
        if (proj) {
          proj = await restoreProjectMediaUrls(proj);
          setCurrentProjectId(id);
          setMedia(proj.media || []);
          setClipsState(proj.clips || []);
          
          const loadedSettings = proj.settings || {
            aspectRatio: '9/16',
            quality: '1080p',
            fps: 30,
            globalAnimationSpeed: 1.0
          };
          setSettings(loadedSettings);
          
          const loadedBgColor = loadedSettings.bgColor || '#000000';
          setBackgroundColor(loadedBgColor);
          setIsTransparent(false);
          
          setHistory([proj.clips || []]);
          setHistoryIndex(0);
          setSelectedClipId(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProject = (id: string) => {
    try {
      const saved = localStorage.getItem('vid-editor-projects');
      if (saved) {
        const list: Project[] = JSON.parse(saved);
        const filtered = list.filter(p => p.id !== id);
        localStorage.setItem('vid-editor-projects', JSON.stringify(filtered));
        if (currentProjectId === id) {
          setCurrentProjectId(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameProject = (id: string, newName: string) => {
    try {
      const saved = localStorage.getItem('vid-editor-projects');
      if (saved) {
        const list: Project[] = JSON.parse(saved);
        const updated = list.map(p => p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p);
        localStorage.setItem('vid-editor-projects', JSON.stringify(updated));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemixProject = (projectData: Omit<Project, 'id' | 'updatedAt'> & { name: string }) => {
    const newId = Math.random().toString(36).substring(7);
    const newProj: Project = {
      ...projectData,
      id: newId,
      updatedAt: Date.now()
    };
    
    try {
      const saved = localStorage.getItem('vid-editor-projects');
      const list: Project[] = saved ? JSON.parse(saved) : [];
      list.push(newProj);
      localStorage.setItem('vid-editor-projects', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
    
    setCurrentProjectId(newId);
    setMedia(newProj.media);
    setClipsState(newProj.clips);
    setSettings(newProj.settings);
    setHistory([newProj.clips]);
    setHistoryIndex(0);
    setSelectedClipId(null);
  };

  // One-time load project on mount
  useEffect(() => {
    if (currentProjectId) {
      const loadProject = async () => {
        try {
          const saved = localStorage.getItem('vid-editor-projects');
          if (saved) {
            const list: Project[] = JSON.parse(saved);
            let proj = list.find(p => p.id === currentProjectId);
            if (proj) {
              proj = await restoreProjectMediaUrls(proj);
              setMedia(proj.media || []);
              setClipsState(proj.clips || []);
              setSettings(proj.settings || {
                aspectRatio: '9/16',
                quality: '1080p',
                fps: 30,
                globalAnimationSpeed: 1.0
              });
              setHistory([proj.clips || []]);
              setHistoryIndex(0);
            } else {
              setCurrentProjectId(null);
            }
          }
        } catch (e) {
          console.error("Error loading project on mount:", e);
        }
      };
      loadProject();
    }
  }, []);

  const setClips = (newClipsOrUpdater: TimelineClip[] | ((prev: TimelineClip[]) => TimelineClip[]), pushToHistory = true) => {
    setClipsState(prev => {
      const nextClips = typeof newClipsOrUpdater === 'function' ? newClipsOrUpdater(prev) : newClipsOrUpdater;
      
      if (pushToHistory) {
        const nextHistory = history.slice(0, historyIndex + 1);
        setHistory([...nextHistory, nextClips]);
        setHistoryIndex(nextHistory.length);
      }
      return nextClips;
    });
  };

  const commitCurrentState = () => {
    setHistory(prevHistory => {
      const lastState = prevHistory[historyIndex];
      if (lastState && JSON.stringify(lastState) === JSON.stringify(clips)) {
        return prevHistory;
      }
      const nextHistory = prevHistory.slice(0, historyIndex + 1);
      const updated = [...nextHistory, clips];
      setHistoryIndex(nextHistory.length);
      return updated;
    });
  };

  const handleUndoAll = () => {
    if (historyIndex > 0) {
      setHistoryIndex(0);
      setClipsState(history[0]);
      setSelectedClipId(null);
    }
  };

  const handleRedoAll = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(history.length - 1);
      setClipsState(history[history.length - 1]);
      setSelectedClipId(null);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setClipsState(history[nextIndex]);
      setSelectedClipId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setClipsState(history[nextIndex]);
      setSelectedClipId(null);
    }
  };

  // Keyboard shortcut listeners (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, clips]);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  
  const animationRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(null);

  // Total duration of the timeline based on clips
  const duration = Math.max(
    30, // minimum 30s timeline
    ...clips.map(c => c.startTime + (c.clipEndOffset - c.clipStartOffset))
  ) + 5; // buffer

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (time: number) => {
        if (lastTimeRef.current) {
          const delta = (time - lastTimeRef.current) / 1000;
          
          // Anti-lag framerate throttle: limit update rate to ~24 FPS on low-end phones
          if (isAntiLagEnabled && delta < 0.041) {
            animationRef.current = requestAnimationFrame(loop);
            return;
          }

          setCurrentTime(prev => {
            const nextTime = prev + delta;
            
            // "acabe a timeline quando qualquer clipe acabar" -> Finish playhead if we reach the end of any track clip
            const clipsEndTime = clips.length > 0
              ? Math.max(...clips.map(c => c.startTime + (c.clipEndOffset - c.clipStartOffset)))
              : 0;

            if (clipsEndTime > 0 && nextTime >= clipsEndTime) {
              setIsPlaying(false);
              return clipsEndTime;
            }

            if (nextTime > duration) {
              setIsPlaying(false);
              return 0;
            }
            return nextTime;
          });
        }
        lastTimeRef.current = time;
        animationRef.current = requestAnimationFrame(loop);
      };
      animationRef.current = requestAnimationFrame(loop);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, duration, clips, isAntiLagEnabled]);

  const [isExporting, setIsExporting] = useState(false);
  const isExportingRef = useRef(false);
  const exportCancelledRef = useRef(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isBoostEnabled, setIsBoostEnabled] = useState(true);
  const [importedFonts, setImportedFonts] = useState<{ name: string; file: string }[]>([]);
  const [bottomTab, setBottomTab] = useState<'timeline' | 'editor'>('timeline');

  // Switch to editor tab automatically on mobile when a clip is selected
  useEffect(() => {
    if (selectedClipId) {
      setBottomTab('editor');
    } else {
      setBottomTab('timeline');
    }
  }, [selectedClipId]);

  const handleAddMedia = async (files: FileList | File[]) => {
    const newMedia: MediaItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('video') ? 'video' 
                 : file.type.startsWith('audio') ? 'audio' 
                 : 'image';
                 
      const dataUrl = URL.createObjectURL(file);

      const getDuration = (src: string, type: string) => {
        return new Promise<number>((resolve) => {
          if (type === 'image') return resolve(3);
          const media = type === 'video' ? document.createElement('video') : document.createElement('audio');
          media.onloadedmetadata = () => resolve(media.duration);
          media.onerror = () => resolve(5);
          media.src = src;
        });
      };

      const duration = await getDuration(dataUrl, type);

      const newId = Math.random().toString(36).substring(7);
      
      newMedia.push({
        id: newId,
        type,
        name: file.name,
        dataUrl,
        duration: isNaN(duration) || duration === Infinity ? 5 : duration,
        file
      });
      
      await saveMediaFile(newId, file);
    }
    
    setMedia(prev => [...prev, ...newMedia]);
  };

function drawShapeOnCanvas(ctx: CanvasRenderingContext2D, clip: any, width: number, height: number) {
  const fill = clip.shapeColor || '#6366f1';
  const stroke = clip.shapeBorderColor || '#ffffff';
  const strokeWidth = clip.shapeBorderWidth !== undefined ? clip.shapeBorderWidth : 2;

  const size = height * 0.4;
  
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;

  ctx.beginPath();
  switch (clip.shapeType) {
    case 'circle': {
      const r = (size * 0.8) / 2;
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'square': {
      const s = size * 0.8;
      const x = -s / 2;
      const y = -s / 2;
      ctx.rect(x, y, s, s);
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'triangle': {
      const scale = (size * 0.8) / 100;
      ctx.moveTo((50 - 50) * scale, (10 - 50) * scale);
      ctx.lineTo((90 - 50) * scale, (90 - 50) * scale);
      ctx.lineTo((10 - 50) * scale, (90 - 50) * scale);
      ctx.closePath();
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'star-4': {
      const scale = (size * 0.8) / 100;
      const pts = [
        [50, 10], [62, 38], [90, 50], [62, 62],
        [50, 90], [38, 62], [10, 50], [38, 38]
      ];
      ctx.moveTo((pts[0][0] - 50) * scale, (pts[0][1] - 50) * scale);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i][0] - 50) * scale, (pts[i][1] - 50) * scale);
      }
      ctx.closePath();
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'star-5': {
      const scale = (size * 0.8) / 100;
      const pts = [
        [50, 10], [63, 38], [93, 38], [69, 57], [78, 87],
        [50, 70], [22, 87], [31, 57], [7, 38], [37, 38]
      ];
      ctx.moveTo((pts[0][0] - 50) * scale, (pts[0][1] - 50) * scale);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i][0] - 50) * scale, (pts[i][1] - 50) * scale);
      }
      ctx.closePath();
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'oval-custom': {
      const rx = (size * 0.8) / 2;
      const ry = rx * 0.55;
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }
  }
}

  const handleExportVideo = async () => {
    if (clips.length === 0) return alert("Adicione clipes à timeline primeiro.");
    
    setIsPlaying(false);
    setIsExporting(true);
    isExportingRef.current = true;
    exportCancelledRef.current = false;
    setExportProgress(0);
    setTimeout(async () => {
      try {
        const dims = getDimensions(settings.aspectRatio, settings.quality);
        await exportVideoOffline(clips, settings, dims.width, dims.height, (p) => {
          if (isExportingRef.current) {
             setExportProgress(p);
          }
        }, () => exportCancelledRef.current, backgroundColor, isTransparent);
      } catch (err) {
        console.error("Export error:", err);
        alert("Ocorreu um erro ao exportar o vídeo.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleDragStart = (e: React.DragEvent, item: MediaItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
  };

  const handleAnalyzeWithAI = async () => {
    if (media.length === 0) return;
    setIsAnalyzing(true);
    try {
      const sample = media.slice(0, 5).map(m => ({
        type: m.type,
        name: m.name,
        dataUrl: m.dataUrl
      }));
      
      const res = await fetch('/api/analyze-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: sample })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newClips: TimelineClip[] = [];
      let currentStartTime = 0;
      
      media.forEach((item, index) => {
        const suggestedDuration = (data.clipDurations && data.clipDurations[index]) || item.duration;
        newClips.push({
          ...item,
          trackId: item.type === 'audio' ? 'a1' : 'v1',
          startTime: currentStartTime,
          clipStartOffset: 0,
          clipEndOffset: suggestedDuration,
          scaleMode: 'contain', // Default to contain to prevent cropping
        });
        
        if (item.type !== 'audio') {
           currentStartTime += suggestedDuration;
         }
      });
      
      setClips(newClips);
      setCurrentTime(0);
      alert(`Sugestão da IA:\nTítulo: ${data.title}\nRoteiro: ${data.script}\n\n${data.suggestions}`);
      
    } catch (err) {
      console.error(err);
      alert("Falha ao analisar mídias com IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meu Vídeo Editado',
          text: 'Confira meu novo vídeo criado no MotionFlux Studio!',
          url: url,
        });
        return;
      } catch (err) {
        console.log('Compartilhamento nativo cancelado ou falhou, tentando copiar para clipboard');
      }
    }
    
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado para a área de transferência!");
    } catch (err) {
      alert("Não foi possível compartilhar ou copiar o link.");
      console.error('Falha ao copiar:', err);
    }
  };

  const handleClickAdd = (item: MediaItem) => {
    const trackId = item.type === 'audio' ? 'a1' : 'v1';
    const trackClips = clips.filter(c => c.trackId === trackId);
    
    let startTime = 0;
    if (trackClips.length > 0) {
      const lastClip = trackClips.reduce((prev, current) => 
        (prev.startTime + (prev.clipEndOffset - prev.clipStartOffset)) > 
        (current.startTime + (current.clipEndOffset - current.clipStartOffset)) ? prev : current
      );
      startTime = lastClip.startTime + (lastClip.clipEndOffset - lastClip.clipStartOffset);
    }

    setClips(prev => [...prev, {
      ...item,
      id: Math.random().toString(36).substring(7),
      trackId,
      startTime,
      clipStartOffset: 0,
      clipEndOffset: item.duration,
      scaleMode: 'contain', // Default to contain to prevent cropping
    }]);
  };

  const handleAddAsOverlay = (item: MediaItem) => {
    const trackId = 'v2';
    const startTime = currentTime;
    
    setClips(prev => [...prev, {
      ...item,
      id: Math.random().toString(36).substring(7),
      trackId,
      startTime,
      clipStartOffset: 0,
      clipEndOffset: item.duration,
      scale: 0.5,
      posX: 60,
      posY: 100,
      scaleMode: 'contain', // Default to contain to prevent cropping
    }]);
  };

  const handlePublishTemplate = () => {
    try {
      const saved = localStorage.getItem('vid-editor-templates');
      const templatesList = saved ? JSON.parse(saved) : [];
      
      const savedProjects = localStorage.getItem('vid-editor-projects');
      const projectsList = savedProjects ? JSON.parse(savedProjects) : [];
      const currentProj = projectsList.find((p: any) => p.id === currentProjectId);
      
      const newTemplate = {
        id: 'tpl-' + Math.random().toString(36).substring(7),
        title: 'Modelo ' + (currentProj?.name || 'Sem Nome'),
        description: 'Template customizado criado pelo usuário contendo todos os clipes da linha de tempo, ideal para remixes rápidos.',
        aspectRatio: settings.aspectRatio,
        clipsCount: clips.length,
        estimatedDuration: clips.reduce((acc, c) => Math.max(acc, c.startTime + (c.clipEndOffset - c.clipStartOffset)), 0),
        difficulty: 'Iniciante',
        plays: 0,
        tags: ['Custom', 'User'],
        color: 'from-violet-600 to-cyan-600',
        iconColor: 'text-violet-400',
        clips: JSON.parse(JSON.stringify(clips)),
        media: JSON.parse(JSON.stringify(media))
      };
      
      templatesList.push(newTemplate);
      localStorage.setItem('vid-editor-templates', JSON.stringify(templatesList));
      alert('Seu projeto foi publicado com sucesso como um modelo na galeria! Você pode visualizá-lo e remixá-lo no painel inicial.');
    } catch (e) {
      console.error(e);
      alert('Erro ao publicar modelo.');
    }
  };

  const handleRecordMic = async () => {
    if (isRecordingMic) {
      if (recIntervalMicRef.current) {
        clearInterval(recIntervalMicRef.current);
        recIntervalMicRef.current = null;
      }
      setIsRecordingMic(false);

      if (mediaRecorderMicRef.current && mediaRecorderMicRef.current.state !== 'inactive') {
        mediaRecorderMicRef.current.stop();
      }
      if (audioStreamMicRef.current) {
        audioStreamMicRef.current.getTracks().forEach(track => track.stop());
        audioStreamMicRef.current = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamMicRef.current = stream;
        audioChunksMicRef.current = [];

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderMicRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksMicRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksMicRef.current, { type: 'audio/wav' });
          const filename = `gravacao-${Date.now()}.wav`;
          const file = new File([audioBlob], filename, { type: 'audio/wav' });

          // Add to media pool and local indexedDB
          const dataUrl = URL.createObjectURL(file);
          const duration = recSecondsMic || 1; // fall back to timer-derived seconds if needed
          
          const newId = 'rec-' + Math.random().toString(36).substring(7);
          const newVoiceClip = {
            id: newId,
            type: 'audio' as const,
            name: `Microfone (${duration}s)`,
            dataUrl,
            duration,
            trackId: 'a1',
            startTime: currentTime,
            clipStartOffset: 0,
            clipEndOffset: duration,
          };
          
          await handleAddMedia([file]);
          handleClickAdd(newVoiceClip);
        };

        mediaRecorder.start();
        setIsRecordingMic(true);
        setRecSecondsMic(0);
        recIntervalMicRef.current = setInterval(() => {
          setRecSecondsMic(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Não foi possível acessar o microfone. Por favor, conceda as permissões de áudio.');
      }
    }
  };

  const handleAddCamera = () => {
    const trackId = 'c1'; // Camera track
    const id = Math.random().toString(36).substring(7);
    
    setClips(prev => [...prev, {
      id,
      type: 'camera',
      name: 'Câmera',
      dataUrl: '',
      duration: 5,
      trackId,
      startTime: currentTime,
      clipStartOffset: 0,
      clipEndOffset: 5,
      posX: 0,
      posY: 0,
      scale: 1,
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      opacity: 1,
    }]);
    commitCurrentState();
  };

  const handleAddText = () => {
    const trackId = 't1';
    setClips(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      type: 'text',
      name: 'Texto',
      dataUrl: '',
      duration: 3,
      trackId,
      startTime: currentTime,
      clipStartOffset: 0,
      clipEndOffset: 3,
      textContent: 'TEXTO AQUI',
      fontFamily: 'font-sans',
      textColor: '#ffffff'
    }]);
  };

  const handleAddShape = (shapeType: 'circle' | 'square' | 'triangle' | 'star-4' | 'star-5' | 'oval-custom') => {
    const trackId = 'v2'; // Shapes go onto the overlay track so they sit on top of video/image backgrounds!
    const id = Math.random().toString(36).substring(7);
    
    const names = {
      circle: 'Círculo',
      square: 'Quadrado',
      triangle: 'Triângulo',
      'star-4': 'Estrela 4P',
      'star-5': 'Estrela 5P',
      'oval-custom': 'Oval'
    };

    setClips(prev => [...prev, {
      id,
      type: 'shape',
      name: names[shapeType] || 'Forma',
      dataUrl: '',
      duration: 3,
      trackId,
      startTime: currentTime,
      clipStartOffset: 0,
      clipEndOffset: 3,
      shapeType,
      shapeColor: '#6366f1', // Beautiful Indigo
      shapeBorderColor: '#ffffff',
      shapeBorderWidth: 2,
      posX: 0,
      posY: 0,
      scale: 0.5,
      rotation: 0
    }]);
    
    setIsShapeMenuOpen(false);
  };

  
  const handleUpdateClip = (id: string, updates: Partial<TimelineClip>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c), false);
  };

  const handleUpdateKeyframe = (clipId: string, kfId: string, updates: Partial<Keyframe>) => {
    setClips(prev => prev.map(c => {
      if (c.id === clipId && c.keyframes) {
        return {
          ...c,
          keyframes: c.keyframes.map(k => k.id === kfId ? { ...k, ...updates } : k)
        };
      }
      return c;
    }), true);
  };

  const handleDuplicateClip = (id: string) => {
    const clipToDup = clips.find(c => c.id === id);
    if (!clipToDup) return;
    const newClip = {
      ...clipToDup,
      id: Math.random().toString(36).substring(7),
      startTime: clipToDup.startTime + (clipToDup.clipEndOffset - clipToDup.clipStartOffset)
    };
    setClips(prev => [...prev, newClip]);
  };

  const handleSplitClip = () => {
    if (!selectedClipId) return;
    
    const clipIndex = clips.findIndex(c => c.id === selectedClipId);
    if (clipIndex === -1) return;
    
    const clip = clips[clipIndex];
    const clipDuration = clip.clipEndOffset - clip.clipStartOffset;
    const splitPoint = currentTime - clip.startTime;
    
    if (splitPoint > 0 && splitPoint < clipDuration) {
      const clip1 = { ...clip, clipEndOffset: clip.clipStartOffset + splitPoint };
      const clip2 = { 
        ...clip, 
        id: Math.random().toString(36).substring(7), 
        startTime: currentTime,
        clipStartOffset: clip.clipStartOffset + splitPoint 
      };
      
      setClips(prev => {
        const newClips = [...prev];
        newClips[clipIndex] = clip1;
        newClips.push(clip2);
        return newClips;
      });
    }
  };

  const handleDeleteClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const selectedClip = clips.find(c => c.id === selectedClipId);

  
  if (currentProjectId === null) {
    if (theme === 'nostalgia') {
      return (
        <NostalgiaStartScreen 
          onCreateProject={handleCreateProject}
          onSwitchTheme={handleSwitchTheme}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onRemixProject={handleRemixProject}
          userSession={userSession}
          setUserSession={setUserSession}
        />
      );
    }

    return (
      <StartScreen
        userSession={userSession}
        setUserSession={setUserSession}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onCreateProject={handleCreateProject}
        onRemixProject={handleRemixProject}
        onSwitchTheme={handleSwitchTheme}
      />
    );
  }


  
  if (theme === 'nostalgia') {
    return (
      <NostalgiaEditor
        clips={clips}
        currentTime={currentTime}
        isPlaying={isPlaying}
        duration={duration}
        selectedClipId={selectedClipId}
        selectedKeyframeId={selectedKeyframeId}
        settings={settings}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onStop={() => setIsPlaying(false)}
        setCurrentTime={setCurrentTime}
        setSelectedClipId={setSelectedClipId}
        onSelectKeyframe={setSelectedKeyframeId}
        onUpdateClip={handleUpdateClip}
        onAddClip={(clip) => setClips(prev => [...prev, clip])}
        onAddMedia={handleAddMedia}
        onDeleteClip={handleDeleteClip}
        onSplitClip={handleSplitClip}
        onDuplicateClip={handleDuplicateClip}
        onClose={() => setCurrentProjectId(null)}
        onExport={handleExportVideo}
        theme={theme}
        setTheme={setTheme}
        keyframeMode={keyframeMode}
        setKeyframeMode={setKeyframeMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onUndoAll={handleUndoAll}
        onRedoAll={handleRedoAll}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        media={media}
        onRemoveMedia={(id) => setMedia(prev => prev.filter(m => m.id !== id))}
        onClickAdd={handleClickAdd}
        onClickAddOverlay={handleAddAsOverlay}
        onAddText={handleAddText}
        onAddShape={handleAddShape}
        onAddCamera={handleAddCamera}
        isAnalyzing={isAnalyzing}
        onAnalyzeWithAI={handleAnalyzeWithAI}
        isSettingsOpen={isSettingsOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        importedFonts={importedFonts}
        onImportFont={(name, file) => setImportedFonts(prev => [...prev, { name, file }])}
        onCommitChange={commitCurrentState}
        onUpdateKeyframe={handleUpdateKeyframe}
        markers={markers}
        onToggleMarker={handleToggleMarker}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <nav className="min-h-14 bg-[#0a0a0a] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:px-6 sm:py-0 shrink-0 z-50 gap-2">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentProjectId(null)}
              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold text-slate-300 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Voltar ao Painel"
            >
              <span>← Voltar</span>
            </button>
            <div className="w-px h-5 bg-white/10 mx-1 hidden xs:block" />
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)] shrink-0">
              <VideoIcon className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-semibold tracking-tight text-xs xs:text-sm md:text-lg shrink-0 hidden md:block">
              MotionFlux Studio <span className="text-[10px] font-normal opacity-50 ml-0.5">v4.0</span>
            </h1>
            <div className="w-px h-5 bg-white/10 mx-1 hidden md:block" />
            
            {/* Active Project Card in Editor Header with Rename & Delete */}
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-xl shadow-inner shrink-0">
              <span className="text-xs font-bold text-slate-100 max-w-[80px] xs:max-w-[120px] sm:max-w-[160px] truncate leading-none">
                {getActiveProjectName()}
              </span>
              <button
                onClick={handleRenameActiveProject}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Renomear Projeto"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={handleDeleteActiveProject}
                className="p-1 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                title="Excluir Projeto"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          
          {/* Central Toolbar positioned in the logo row on mobile for max screen efficiency */}
          <div className="flex items-center bg-[#121212] border border-white/5 rounded-full px-1 py-0.5 gap-0.5 shadow-inner sm:hidden">
            <button 
              onClick={handleUndo}
              disabled={historyIndex === 0}
              className="p-1 rounded-full hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              title="Desfazer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleRedo}
              disabled={historyIndex === history.length - 1}
              className="p-1 rounded-full hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              title="Refazer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <button 
              onClick={() => selectedClipId && handleDeleteClip(selectedClipId)}
              disabled={!selectedClipId}
              className="p-1 rounded-full hover:bg-red-950/30 text-slate-400 hover:text-red-400 disabled:opacity-30 transition-all"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1 rounded-full hover:bg-white/5 text-slate-400 hover:text-indigo-400 transition-all"
              title="Configurações"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Undo/Redo/Delete/Settings Central Toolbar (Only on desktop screens) */}
        <div className="hidden sm:flex items-center bg-[#121212] border border-white/5 rounded-full px-1.5 py-0.5 gap-1 shadow-inner">
          <button 
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleRedo}
            disabled={historyIndex === history.length - 1}
            className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button 
            onClick={() => selectedClipId && handleDeleteClip(selectedClipId)}
            disabled={!selectedClipId}
            className="p-1.5 rounded-full hover:bg-red-950/30 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Excluir Selecionado (Ctrl+Backspace)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-indigo-400 transition-all"
            title="Configurações do Editor"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic actions section - perfect space distribution with wrap and smaller padding on mobile */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end w-full sm:w-auto gap-1 md:gap-2">
          <button 
            onClick={handleAnalyzeWithAI}
            disabled={isAnalyzing || media.length === 0}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="AI Auto-Edit"
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> : <Wand2 className="w-3 h-3 text-indigo-400" />}
            <span className="hidden xs:inline">AI Edit</span>
          </button>
          
          <button 
            onClick={handleAddText}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full transition-colors"
            title="Adicionar Texto"
          >
            <Type className="w-3 h-3 text-slate-300" />
            <span className="hidden xs:inline">Texto</span>
          </button>

          <button 
            onClick={handleAddCamera}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full text-white transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 cursor-pointer"
            title="Adicionar Câmera Funcional"
          >
            <Camera className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="hidden xs:inline">Câmera</span>
          </button>

          <button 
            onClick={handleRecordMic}
            className={cn(
              "flex items-center gap-1.5 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full transition-all active:scale-95 cursor-pointer border",
              isRecordingMic 
                ? "bg-rose-600 hover:bg-rose-500 border-rose-500 text-white animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.5)]" 
                : "bg-white/5 hover:bg-white/10 border-white/10 text-rose-400"
            )}
            title={isRecordingMic ? `Parar gravação (${recSecondsMic}s)` : "Gravar Áudio com Microfone"}
          >
            <Mic className={cn("w-3.5 h-3.5", isRecordingMic ? "text-white animate-pulse" : "text-rose-400")} />
            <span>{isRecordingMic ? `${recSecondsMic}s` : "Gravar Voz"}</span>
          </button>

          {/* Elementos Button with Popover Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setIsShapeMenuOpen(prev => !prev)}
              className={cn(
                "flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full transition-colors cursor-pointer select-none",
                isShapeMenuOpen ? "bg-white/10 border-indigo-500/50 text-indigo-400" : ""
              )}
              title="Adicionar Elementos Gráficos (Formas)"
            >
              <Shapes className="w-3.5 h-3.5 text-slate-300 animate-pulse" />
              <span>Elementos</span>
            </button>
            
            {isShapeMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-50 cursor-default" 
                  onClick={() => setIsShapeMenuOpen(false)} 
                />
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#101010] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 backdrop-blur-md">
                  <p className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider font-mono border-b border-white/5">Adicionar Forma</p>
                  <button
                    onClick={() => handleAddShape('circle')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left cursor-pointer"
                  >
                    <span className="w-4 h-4 rounded-full border border-indigo-400 bg-indigo-500/20" />
                    <span>Círculo</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('square')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left cursor-pointer"
                  >
                    <span className="w-4 h-4 rounded border border-indigo-400 bg-indigo-500/20" />
                    <span>Quadrado</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('triangle')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left cursor-pointer"
                  >
                    <span className="w-4 h-4 border-l-8 border-r-8 border-b-[16px] border-l-transparent border-r-transparent border-b-indigo-500/40 relative top-[-1px]" />
                    <span>Triângulo</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('star-4')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left cursor-pointer"
                  >
                    <span className="text-[15px] leading-none text-indigo-400">✦</span>
                    <span>Estrela 4 Pontas</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('star-5')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left cursor-pointer"
                  >
                    <span className="text-[15px] leading-none text-indigo-400">★</span>
                    <span>Estrela 5 Pontas</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('oval-custom')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left cursor-pointer"
                  >
                    <span className="w-4 h-2.5 rounded-full border border-indigo-400 bg-indigo-500/20" />
                    <span>Oval Customizado</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={handleSplitClip}
            disabled={!selectedClipId}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full transition-colors disabled:opacity-50"
            title="Dividir Clipe"
          >
            <Scissors className="w-3 h-3 text-slate-300" />
            <span className="hidden xs:inline">Dividir</span>
          </button>

          <button 
            onClick={() => selectedClipId && handleDuplicateClip(selectedClipId)}
            disabled={!selectedClipId}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full transition-colors disabled:opacity-50"
            title="Duplicar Clipe"
          >
            <Copy className="w-3 h-3 text-slate-300" />
            <span className="hidden xs:inline">Duplicar</span>
          </button>

          <button 
            onClick={() => setIsBoostEnabled(prev => !prev)}
            className={cn(
              "flex items-center gap-1 border px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-all cursor-pointer select-none",
              isBoostEnabled 
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            )}
            title="Turbo Export"
          >
            <Zap className={cn("w-3 h-3", isBoostEnabled && "animate-pulse text-amber-400")} />
            <span className="hidden xs:inline">Boost</span>
          </button>

          {/* Anti-Lag Button for Low-end phones */}
          <button 
            onClick={() => {
              const nextVal = !isAntiLagEnabled;
              setIsAntiLagEnabled(nextVal);
              localStorage.setItem('vid-anti-lag', String(nextVal));
            }}
            className={cn(
              "flex items-center gap-1 border px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer select-none",
              isAntiLagEnabled 
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] animate-pulse" 
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            )}
            title="Ativar/Desativar Sistema Anti-Lag para Celulares Fracos"
          >
            <Cpu className={cn("w-3.5 h-3.5", isAntiLagEnabled ? "text-emerald-400" : "text-slate-500")} />
            <span>Anti-Lag: {isAntiLagEnabled ? 'ATIVO' : 'OFF'}</span>
          </button>

          <button 
            onClick={handleExportVideo}
            disabled={isExporting}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-semibold px-3 py-1 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            <span>{isExporting ? 'Exportando...' : 'Exportar MP4'}</span>
          </button>

          <button 
            onClick={handlePublishTemplate}
            className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.3)] transition-all cursor-pointer"
            title="Publicar como Modelo Público"
          >
            <Sparkles className="w-3 h-3 text-violet-200" />
            <span className="hidden xs:inline">Publicar Modelo</span>
          </button>

          <button 
            onClick={handleShare}
            className="flex items-center gap-1 bg-white hover:bg-gray-200 text-black text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg transition-all"
            title="Compartilhar Link"
          >
            <Share className="w-3 h-3" />
            <span className="hidden xs:inline">Share</span>
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
        <MediaPool 
          media={media} 
          onAddMedia={handleAddMedia}
          onRemoveMedia={(id) => setMedia(prev => prev.filter(m => m.id !== id))}
          onDragStart={handleDragStart}
          onClickAdd={handleClickAdd}
          onClickAddOverlay={handleAddAsOverlay}
        />
        <PreviewCanvas 
          clips={clips} 
          currentTime={currentTime}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onStop={() => { setIsPlaying(false); setCurrentTime(0); }}
          onUpdateClip={(id, updates) => setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c), false)}
          settings={settings}
          isAntiLagEnabled={isAntiLagEnabled}
          backgroundColor={backgroundColor}
          markers={markers}
          onToggleMarker={handleToggleMarker}
          onSeek={(time) => setCurrentTime(time)}
          duration={duration}
        />
      </div>

      {/* Bottom Panel (Timeline & ClipEditor switch on mobile, side-by-side on desktop) */}
      <div className="h-80 md:h-72 bg-[#0d0d0d] border-t border-white/10 flex flex-col overflow-hidden shrink-0 relative">
        {/* Mobile Switching Tabs when a clip is selected */}
        {selectedClip && (
          <div className="flex md:hidden bg-black/90 border-b border-white/5 text-[10px] font-bold uppercase tracking-wider shrink-0 z-50">
            <button
              onClick={() => setBottomTab('timeline')}
              className={cn(
                "flex-1 py-2.5 text-center border-b-2 transition-all cursor-pointer",
                bottomTab === 'timeline' ? "border-indigo-500 text-indigo-400 bg-white/[0.02]" : "border-transparent text-slate-500 hover:text-white"
              )}
            >
              Linha do Tempo
            </button>
            <button
              onClick={() => setBottomTab('editor')}
              className={cn(
                "flex-1 py-2.5 text-center border-b-2 transition-all cursor-pointer",
                bottomTab === 'editor' ? "border-indigo-500 text-indigo-400 bg-white/[0.02]" : "border-transparent text-slate-500 hover:text-white"
              )}
            >
              Propriedades ({selectedClip.name})
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Timeline Section */}
          <div className={cn(
            "flex-1 min-w-0 flex flex-col h-full",
            selectedClip && bottomTab !== 'timeline' && "hidden md:flex"
          )}>
            <Timeline 
              clips={clips}
              onAddClip={(clip) => setClips(prev => [...prev, clip])}
              onUpdateClip={(id, updates) => setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))}
              onRemoveClip={handleDeleteClip}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              duration={duration}
              selectedClipId={selectedClipId}
              onSelectClip={(id) => { setSelectedClipId(id); setSelectedKeyframeId(null); }}
              selectedKeyframeId={selectedKeyframeId}
              onSelectKeyframe={setSelectedKeyframeId}
              markers={markers}
              onToggleMarker={handleToggleMarker}
            />
          </div>

          {/* Editor Section */}
          {selectedClip && (
            <div className={cn(
              "w-full md:w-96 bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-white/5 h-full flex flex-col shrink-0 relative",
              bottomTab !== 'editor' && "hidden md:flex"
            )}>
              <ClipEditor 
                clip={selectedClip} 
                onUpdateClip={(id, updates) => setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c), false)} 
                onRemoveClip={handleDeleteClip}
                onCommitChange={commitCurrentState}
                onClose={() => setSelectedClipId(null)}
                importedFonts={importedFonts}
                onImportFont={(name, file) => setImportedFonts(prev => [...prev, { name, file }])}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                keyframeMode={keyframeMode}
                selectedKeyframeId={selectedKeyframeId}
                onUpdateKeyframe={handleUpdateKeyframe}
              />
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-6">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-lg text-white">Configurações do Editor</h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Background Color & Transparency */}
              <div className="space-y-2">
                <label className="text-slate-400 font-bold uppercase tracking-wider block">Fundo</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {['#000000', '#ffffff', '#00ff00', '#0000ff'].map(color => (
                    <button
                      key={color}
                      onClick={() => { setBackgroundColor(color); setIsTransparent(false); }}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        backgroundColor === color && !isTransparent ? "border-indigo-500 scale-110" : "border-white/20"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    onClick={() => setIsTransparent(true)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center bg-[repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] bg-[length:8px_8px]",
                      isTransparent ? "border-indigo-500 scale-110" : "border-white/20"
                    )}
                  />
                  <div className="flex items-center gap-1.5 ml-2">
                    <input
                      type="checkbox"
                      checked={isTransparent}
                      onChange={(e) => setIsTransparent(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    <span className="text-slate-300 text-xs">Exportar Transparente</span>
                  </div>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <label className="text-slate-400 font-bold uppercase tracking-wider block">Dimensões & Proporção</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: '16/9', label: '16:9 (Cinema/YouTube)' },
                    { value: '9/16', label: '9:16 (Reels/TikTok)' },
                    { value: '1/1', label: '1:1 (Quadrado/Instagram)' },
                    { value: '4/3', label: '4:3 (TV Clássica)' },
                    { value: '21/9', label: '21:9 (Cinemascope)' },
                    { value: '4/5', label: '4:5 (Instagram Retrato)' },
                    { value: '3/2', label: '3:2 (Fotografia DSLR)' }
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setSettings(prev => ({ ...prev, aspectRatio: preset.value }))}
                      className={cn(
                        "p-2.5 rounded-lg border text-left font-medium transition-all cursor-pointer",
                        settings.aspectRatio === preset.value
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_12px_rgba(79,70,229,0.2)]"
                          : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Aspect Ratio Inputs in Settings */}
              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl space-y-2 animate-fade-in">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">🛠️ Proporção Customizada</span>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Defina proporções específicas inserindo a largura e altura desejadas (Ex: 16 e 10 para 16:10).
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between border border-white/5">
                    <span className="text-[9px] text-slate-500 font-mono">Largura</span>
                    <input 
                      type="number" 
                      min="1"
                      max="100"
                      className="w-10 bg-transparent text-white text-xs text-right outline-none font-mono font-bold"
                      value={(() => {
                        const parts = settings.aspectRatio.split('/');
                        return parts.length === 2 ? parseInt(parts[0]) || 16 : 16;
                      })()}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        const parts = settings.aspectRatio.split('/');
                        const hVal = parts.length === 2 ? parseInt(parts[1]) || 9 : 9;
                        setSettings(prev => ({ ...prev, aspectRatio: `${val}/${hVal}` }));
                      }}
                    />
                  </div>
                  <span className="text-slate-500 font-mono font-bold">:</span>
                  <div className="flex-1 bg-black/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between border border-white/5">
                    <span className="text-[9px] text-slate-500 font-mono">Altura</span>
                    <input 
                      type="number" 
                      min="1"
                      max="100"
                      className="w-10 bg-transparent text-white text-xs text-right outline-none font-mono font-bold"
                      value={(() => {
                        const parts = settings.aspectRatio.split('/');
                        return parts.length === 2 ? parseInt(parts[1]) || 9 : 9;
                      })()}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        const parts = settings.aspectRatio.split('/');
                        const wVal = parts.length === 2 ? parseInt(parts[0]) || 16 : 16;
                        setSettings(prev => ({ ...prev, aspectRatio: `${wVal}/${val}` }));
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quality Preset */}
              <div className="space-y-2">
                <label className="text-slate-400 font-bold uppercase tracking-wider block">Qualidade de Exportação</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '720p', label: '720p (HD)' },
                    { value: '1080p', label: '1080p (Full HD)' },
                    { value: '4K', label: '4K (Ultra HD)' }
                  ].map((quality) => (
                    <button
                      key={quality.value}
                      onClick={() => setSettings(prev => ({ ...prev, quality: quality.value as any }))}
                      className={cn(
                        "p-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer",
                        settings.quality === quality.value
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_12px_rgba(79,70,229,0.2)]"
                          : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      {quality.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate FPS */}
              <div className="space-y-2">
                <label className="text-slate-400 font-bold uppercase tracking-wider block">Taxa de Quadros (FPS)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 24, label: '24 FPS' },
                    { value: 30, label: '30 FPS' },
                    { value: 60, label: '60 FPS' }
                  ].map((fps) => (
                    <button
                      key={fps.value}
                      onClick={() => setSettings(prev => ({ ...prev, fps: fps.value }))}
                      className={cn(
                        "p-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer",
                        settings.fps === fps.value
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_12px_rgba(79,70,229,0.2)]"
                          : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      {fps.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Velocidade Global de Animação */}
              <div className="space-y-2">
                <label className="text-slate-400 font-bold uppercase tracking-wider block">Velocidade das Animações</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 0.5, label: '0.5x' },
                    { value: 1.0, label: '1.0x (Padrão)' },
                    { value: 1.5, label: '1.5x' },
                    { value: 2.0, label: '2.0x' }
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, globalAnimationSpeed: preset.value }))}
                      className={cn(
                        "p-2 rounded-lg border text-center font-semibold transition-all cursor-pointer text-[10px]",
                        (settings.globalAnimationSpeed || 1.0) === preset.value
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_12px_rgba(79,70,229,0.2)]"
                          : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">Afeta a reprodução e acelera/desacelera todos os elementos e textos simultaneamente.</p>
              </div>

              {/* Boost Export Mode */}
              <div className="space-y-2 pt-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Modo Super Boost (Exportação Acelerada)
                </label>
                <button
                  type="button"
                  onClick={() => setIsBoostEnabled(prev => !prev)}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left font-medium transition-all flex items-center justify-between cursor-pointer",
                    isBoostEnabled
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                      : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05]"
                  )}
                >
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold">Aceleração de Renderização Hardware</span>
                    <span className="block text-[10px] text-slate-400 font-normal">Ignora delays de renderização para exportar o vídeo em velocidade turbo.</span>
                  </div>
                  <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-400">
                    {isBoostEnabled ? 'Ativado' : 'Desativado'}
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg text-sm cursor-pointer"
            >
              Aplicar Configurações
            </button>
          </div>
        </div>
      )}

      {/* REAL-TIME RENDERING EXPORT QUEUE MODAL */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30 animate-pulse relative">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white">Renderizando MP4</h2>
              <p className="text-xs text-slate-400 max-w-sm">
                Processando filtros, animações, keyframes e camadas em alta definição. Por favor, mantenha esta aba aberta.
              </p>
            </div>

            {/* Dynamic Export Monitor Preview with exact target Aspect Ratio */}
            <div 
              style={{ aspectRatio: settings.aspectRatio }} 
              className="relative border border-white/10 rounded-lg overflow-hidden bg-black w-40 max-h-64 shadow-inner"
            >
              <canvas id="export-canvas" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-600 text-white font-mono text-[8px] font-bold tracking-widest uppercase animate-pulse">
                REC
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-indigo-400 font-semibold px-1">
                <span>Progresso</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-100 ease-out"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
            
            <button 
              onClick={() => {
                exportCancelledRef.current = true;
                isExportingRef.current = false;
                setIsExporting(false);
              }}
              className="text-xs text-slate-400 hover:text-red-400 font-semibold px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition-all active:scale-95 cursor-pointer uppercase tracking-wider text-[10px]"
            >
              Cancelar Exportação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
