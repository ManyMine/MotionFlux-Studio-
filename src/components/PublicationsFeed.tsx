import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, MessageSquare, Star, Play, Share2, Send, Trash2, 
  Plus, ChevronLeft, Sparkles, Clock, User, Music, Video, X, Loader2, ArrowUpRight, Check, Flag
} from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { cn } from '../utils';
import { TimelineClip, MediaItem } from '../types';
import { getMediaFile } from '../utils/mediaDb';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (blob.type.startsWith('image/') && blob.size > 200 * 1024) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          const maxDim = 800;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
      } else {
        resolve(dataUrl);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface Comment {
  id: string;
  userName: string;
  userEmail: string;
  text: string;
  createdAt: number;
}

export interface Publication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  description: string;
  likes: string[]; // array of user emails or ids
  favorites: string[]; // array of user emails or ids
  comments: Comment[];
  createdAt: number;
  projectData: {
    name: string;
    clips: TimelineClip[];
    media: MediaItem[];
    settings: {
      aspectRatio: string;
      quality: string;
      fps: number;
      bgColor?: string;
    };
  };
}

interface PublicationsFeedProps {
  userSession: { email: string; name: string; isLoggedIn: boolean; method?: string; hideEmail?: boolean };
  setUserSession?: React.Dispatch<React.SetStateAction<{ email: string; name: string; isLoggedIn: boolean; method?: string; hideEmail?: boolean }>>;
  onBack: () => void;
  onRemixProject: (projectData: any) => void;
}

export function PublicationsFeed({ userSession, setUserSession, onBack, onRemixProject }: PublicationsFeedProps) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected publication for modal player
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  
  // Profile edit state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState(userSession.name || '');
  
  // New Comment State
  const [newCommentText, setNewCommentText] = useState('');

  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });
  
  // New Publication state (if creating from existing local projects)
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [localProjects, setLocalProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Load community feed
  const handleSaveProfile = () => {
    if (!newProfileName.trim()) return;
    const updated = { ...userSession, name: newProfileName.trim() };
    if (setUserSession) {
      setUserSession(updated);
    }
    localStorage.setItem('vid-user-session', JSON.stringify(updated));
    setIsProfileModalOpen(false);
  };

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'publications'), orderBy('createdAt', 'desc'), limit(30));
      const querySnapshot = await getDocs(q);
      const feedData: Publication[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        feedData.push({
          id: docSnap.id,
          userId: data.userId || 'anonymous',
          userName: data.userName || 'Autor',
          userEmail: data.userEmail || '',
          title: data.title || 'Sem Título',
          description: data.description || '',
          likes: data.likes || [],
          favorites: data.favorites || [],
          comments: data.comments || [],
          createdAt: data.createdAt || Date.now(),
          projectData: data.projectData || { clips: [], media: [], settings: { aspectRatio: '9/16', quality: '1080p', fps: 30 } }
        });
      });
      setPublications(feedData);
    } catch (err: any) {
      console.error("Erro ao carregar publicações:", err);
      setError("Não foi possível carregar as publicações do servidor. Exibindo em modo offline.");
      // Fallback local feed
      const saved = localStorage.getItem('vid-local-feed');
      if (saved) {
        try { setPublications(JSON.parse(saved)); } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    // Load local projects list for publishing
    const saved = localStorage.getItem('vid-editor-projects');
    if (saved) {
      try {
        setLocalProjects(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveLocalFeed = (updated: Publication[]) => {
    localStorage.setItem('vid-local-feed', JSON.stringify(updated));
  };

  // Toggle Like
  const handleLike = async (pub: Publication, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const userIdentifier = userSession.email || 'guest-' + userSession.name || 'guest';
    const isLiked = pub.likes.includes(userIdentifier);
    const newLikes = isLiked 
      ? pub.likes.filter(x => x !== userIdentifier)
      : [...pub.likes, userIdentifier];

    const updatedPub = { ...pub, likes: newLikes };
    
    // UI update
    setPublications(prev => prev.map(p => p.id === pub.id ? updatedPub : p));
    if (selectedPub?.id === pub.id) {
      setSelectedPub(updatedPub);
    }

    try {
      await updateDoc(doc(db, 'publications', pub.id), { likes: newLikes });
    } catch (err) {
      console.error("Erro ao atualizar curtida:", err);
      // Save local fallback
      saveLocalFeed(publications.map(p => p.id === pub.id ? updatedPub : p));
    }
  };

  // Toggle Favorite
  const handleFavorite = async (pub: Publication, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const userIdentifier = userSession.email || 'guest-' + userSession.name || 'guest';
    const isFav = pub.favorites.includes(userIdentifier);
    const newFavs = isFav 
      ? pub.favorites.filter(x => x !== userIdentifier)
      : [...pub.favorites, userIdentifier];

    const updatedPub = { ...pub, favorites: newFavs };
    
    // UI update
    setPublications(prev => prev.map(p => p.id === pub.id ? updatedPub : p));
    if (selectedPub?.id === pub.id) {
      setSelectedPub(updatedPub);
    }

    try {
      await updateDoc(doc(db, 'publications', pub.id), { favorites: newFavs });
    } catch (err) {
      console.error("Erro ao atualizar favorito:", err);
      saveLocalFeed(publications.map(p => p.id === pub.id ? updatedPub : p));
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPub || !newCommentText.trim()) return;

    const newComment: Comment = {
      id: Math.random().toString(36).substring(7),
      userName: userSession.name || 'Convidado',
      userEmail: userSession.hideEmail ? 'privado@criador.com' : (userSession.email || 'guest'),
      text: newCommentText.trim(),
      createdAt: Date.now()
    };

    const newComments = [...selectedPub.comments, newComment];
    const updatedPub = { ...selectedPub, comments: newComments };

    // UI update
    setPublications(prev => prev.map(p => p.id === selectedPub.id ? updatedPub : p));
    setSelectedPub(updatedPub);
    setNewCommentText('');

    try {
      await updateDoc(doc(db, 'publications', selectedPub.id), { comments: newComments });
    } catch (err) {
      console.error("Erro ao adicionar comentário:", err);
      saveLocalFeed(publications.map(p => p.id === selectedPub.id ? updatedPub : p));
    }
  };

  // Delete Publication (if owner)
  const handleDeletePub = (pubId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Excluir Publicação',
      message: 'Deseja realmente excluir esta publicação pública de forma permanente? Ela não estará mais visível no feed da comunidade.',
      onConfirm: async () => {
        setPublications(prev => prev.filter(p => p.id !== pubId));
        if (selectedPub?.id === pubId) setSelectedPub(null);
        setCustomDialog(prev => ({ ...prev, isOpen: false }));

        try {
          await deleteDoc(doc(db, 'publications', pubId));
          setCustomDialog({
            isOpen: true,
            type: 'alert',
            title: 'Excluído',
            message: 'A sua publicação pública foi excluída com sucesso!'
          });
        } catch (err) {
          console.error("Erro ao excluir publicação:", err);
        }
      }
    });
  };

  // Report Publication
  const handleReportPub = (pubId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setCustomDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Denunciar Vídeo',
      message: 'Deseja realmente denunciar este vídeo por conter conteúdo impróprio, abusivo, ou que viola direitos autorais? O vídeo será ocultado do seu feed imediatamente.',
      onConfirm: async () => {
        // Optimistic hide
        setPublications(prev => prev.filter(p => p.id !== pubId));
        if (selectedPub?.id === pubId) setSelectedPub(null);
        setCustomDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
          const pubRef = doc(db, 'publications', pubId);
          const targetPub = publications.find(p => p.id === pubId);
          const currentReports = targetPub?.reports || [];
          const userEmail = userSession.email || 'guest';
          
          if (!currentReports.includes(userEmail)) {
            const newReports = [...currentReports, userEmail];
            await updateDoc(pubRef, { reports: newReports });
          }
          setCustomDialog({
            isOpen: true,
            type: 'alert',
            title: 'Denúncia Registrada',
            message: 'Obrigado pela sua denúncia! O vídeo foi removido do seu feed e nossa equipe revisará o conteúdo.'
          });
        } catch (err) {
          console.error("Erro ao denunciar:", err);
        }
      }
    });
  };

  // Handle Publish Submit
  const handlePublishProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !publishTitle.trim()) {
      setCustomDialog({
        isOpen: true,
        type: 'alert',
        title: 'Campos Obrigatórios',
        message: 'Por favor, selecione um projeto e insira um título.'
      });
      return;
    }

    setPublishing(true);
    try {
      const proj = localProjects.find(p => p.id === selectedProjectId);
      if (!proj) throw new Error("Projeto não encontrado");

      // Compile media and clips by downloading from IndexedDB and transforming to Base64
      let totalSize = 0;

      const compiledClips = await Promise.all((proj.clips || []).map(async (clip: any) => {
        const updatedClip = { ...clip };
        if (clip.type === 'image' || clip.type === 'video' || clip.type === 'audio') {
          // Fallback to finding from project.media if clip.id isn't directly a media ID
          const mediaItem = proj.media?.find((m: any) => m.id === clip.mediaId || (m.name === clip.name && m.type === clip.type));
          const fileId = mediaItem?.id || clip.mediaId || clip.id;
          
          if (fileId) {
            const blob = await getMediaFile(fileId);
            if (blob) {
              try {
                const base64 = await blobToBase64(blob);
                updatedClip.dataUrl = base64;
                updatedClip.url = base64;
                totalSize += base64.length;
              } catch (e) {
                console.error("Failed to convert clip to base64:", e);
              }
            }
          }
        }
        return updatedClip;
      }));

      const compiledMedia = await Promise.all((proj.media || []).map(async (item: any) => {
        const updatedItem = { ...item };
        if (item.type === 'image' || item.type === 'video' || item.type === 'audio') {
          if (item.id) {
            const blob = await getMediaFile(item.id);
            if (blob) {
              try {
                const base64 = await blobToBase64(blob);
                updatedItem.dataUrl = base64;
                updatedItem.url = base64;
                totalSize += base64.length;
              } catch (e) {
                console.error("Failed to convert media to base64:", e);
              }
            }
          }
        }
        return updatedItem;
      }));

      // Check for size limits (Firestore 1MB limit is 1,048,576 bytes)
      if (totalSize > 1048576) {
        setCustomDialog({
          isOpen: true,
          type: 'alert',
          title: 'Projeto Muito Grande',
          message: 'O tamanho total das imagens e vídeos deste projeto é muito grande para publicação pública (limite de mídias de 1MB do Firestore). Tente usar mídias mais curtas ou imagens comprimidas para garantir que o projeto seja postado.'
        });
        setPublishing(false);
        return;
      }

      const isPrivateEmail = userSession.hideEmail;
      const userMailStr = isPrivateEmail ? 'privado@criador.com' : (userSession.email || 'guest');

      const newPub = {
        userId: userSession.email || 'guest',
        userName: userSession.name || 'Convidado',
        userEmail: userMailStr,
        title: publishTitle.trim(),
        description: publishDesc.trim(),
        likes: [],
        favorites: [],
        comments: [],
        createdAt: Date.now(),
        projectData: {
          name: proj.name,
          clips: compiledClips,
          media: compiledMedia,
          settings: proj.settings || { aspectRatio: '9/16', quality: '1080p', fps: 30 }
        }
      };

      const docRef = await addDoc(collection(db, 'publications'), newPub);
      
      // Update local state
      const created: Publication = { id: docRef.id, ...newPub };
      setPublications(prev => [created, ...prev]);
      
      setIsPublishModalOpen(false);
      setPublishTitle('');
      setPublishDesc('');
      setSelectedProjectId('');

      setCustomDialog({
        isOpen: true,
        type: 'alert',
        title: 'Publicado!',
        message: 'Projeto publicado com sucesso no Feed da Comunidade com todas as mídias incorporadas!'
      });
    } catch (err) {
      console.error("Erro ao publicar projeto:", err);
      
      // Fallback local
      const proj = localProjects.find(p => p.id === selectedProjectId);
      if (proj) {
        const isPrivateEmail = userSession.hideEmail;
        const userMailStr = isPrivateEmail ? 'privado@criador.com' : (userSession.email || 'guest');

        const fallbackPub: Publication = {
          id: 'pub-' + Math.random().toString(36).substring(7),
          userId: 'guest',
          userName: userSession.name || 'Convidado',
          userEmail: userMailStr,
          title: publishTitle.trim(),
          description: publishDesc.trim(),
          likes: [],
          favorites: [],
          comments: [],
          createdAt: Date.now(),
          projectData: {
            name: proj.name,
            clips: proj.clips || [],
            media: proj.media || [],
            settings: proj.settings || { aspectRatio: '9/16', quality: '1080p', fps: 30 }
          }
        };
        const updatedFeed = [fallbackPub, ...publications];
        setPublications(updatedFeed);
        saveLocalFeed(updatedFeed);
        setIsPublishModalOpen(false);

        setCustomDialog({
          isOpen: true,
          type: 'alert',
          title: 'Publicado Localmente',
          message: 'Não foi possível publicar online. Salvando localmente como rascunho de post no feed local.'
        });
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07070a] text-slate-100 overflow-hidden relative selection:bg-indigo-500/30">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-14 bg-[#0a0a0f]/90 border-b border-white/5 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-10 relative">
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-extrabold text-sm uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400">
              Community Feed
            </h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Publicações de Vídeos & Projetos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Change Name / Profile button */}
          <button 
            onClick={() => {
              setNewProfileName(userSession.name || 'Criador Convidado');
              setIsProfileModalOpen(true);
            }}
            className="hidden sm:flex items-center gap-2 p-1.5 px-3 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 hover:border-white/10 text-xs font-bold transition-all cursor-pointer text-slate-300 hover:text-white"
            title="Mudar nome do perfil"
          >
            <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[9px] font-black uppercase text-violet-400">
              {userSession.name ? userSession.name.substring(0, 2).toUpperCase() : 'C'}
            </div>
            <span className="truncate max-w-[100px]">{userSession.name || 'Criador Convidado'}</span>
          </button>

          <button 
            onClick={() => {
              setNewProfileName(userSession.name || 'Criador Convidado');
              setIsProfileModalOpen(true);
            }}
            className="sm:hidden w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer border border-white/5"
            title="Mudar nome do perfil"
          >
            <User className="w-4 h-4 text-violet-400" />
          </button>

          <button 
            onClick={() => setIsPublishModalOpen(true)}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Postar Vídeo</span>
          </button>
        </div>
      </header>

      {/* Content Feed */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative">
        {error && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium text-center max-w-xl mx-auto">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider animate-pulse">Buscando publicações...</span>
          </div>
        ) : publications.length === 0 ? (
          <div className="h-80 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Video className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">Nenhum vídeo publicado</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Seja o primeiro a postar! Publique um de seus projetos salvos para a comunidade ver, interagir e remixar.
              </p>
            </div>
            <button 
              onClick={() => setIsPublishModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
            >
              Postar Primeiro Vídeo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {publications.map((pub) => {
              const hasLiked = pub.likes.includes(userSession.email || 'guest-' + userSession.name || 'guest');
              const hasFav = pub.favorites.includes(userSession.email || 'guest-' + userSession.name || 'guest');
              return (
                <div 
                  key={pub.id}
                  onClick={() => setSelectedPub(pub)}
                  className="bg-[#0f0f15]/95 border border-white/5 hover:border-indigo-500/30 rounded-2xl overflow-hidden cursor-pointer hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:shadow-indigo-500/5 transition-all flex flex-col h-96 group relative"
                >
                  {/* Playback Preview Poster Frame */}
                  <div className="h-44 bg-slate-950 flex items-center justify-center relative overflow-hidden shrink-0 border-b border-white/5">
                    {/* Background visual abstraction */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/40 via-transparent to-purple-950/40" />
                    
                    {/* Decorative visual pattern */}
                    <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-lg relative z-10">
                      <Play className="w-6 h-6 fill-indigo-400 text-indigo-400 relative left-0.5" />
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[9px] font-bold font-mono text-slate-300">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>{pub.projectData?.clips?.length || 0} clipes</span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-indigo-300 font-mono">
                      {pub.projectData?.settings?.aspectRatio || '9:16'}
                    </div>
                  </div>

                  {/* Pub Info */}
                  <div className="p-4 flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 space-y-1">
                      <h3 className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors truncate">
                        {pub.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                        {pub.description || 'Nenhuma descrição fornecida.'}
                      </p>
                    </div>

                    {/* Meta User */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-3 shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-extrabold text-indigo-400">
                          {pub.userName ? pub.userName.substring(0,2).toUpperCase() : 'C'}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-200 truncate leading-tight">{pub.userName}</span>
                          <span className="block text-[8px] text-slate-500 font-mono">{(new Date(pub.createdAt)).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Delete button for publisher */}
                      {(pub.userEmail === userSession.email || pub.userId === userSession.email) && (
                        <button 
                          onClick={(e) => handleDeletePub(pub.id, e)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir publicação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Interactions Footer */}
                  <div className="bg-[#12121c] px-4 py-2.5 border-t border-white/5 flex items-center justify-between shrink-0 text-xs">
                    <button 
                      onClick={(e) => handleLike(pub, e)}
                      className={cn(
                        "flex items-center gap-1.5 font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer",
                        hasLiked ? "text-rose-400" : "text-slate-400 hover:text-rose-400"
                      )}
                    >
                      <Heart className={cn("w-4 h-4", hasLiked && "fill-rose-400")} />
                      <span>{pub.likes?.length || 0}</span>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPub(pub);
                      }}
                      className="flex items-center gap-1.5 font-bold text-slate-400 hover:text-indigo-400 transition-all hover:scale-105 active:scale-95 cursor-pointer bg-transparent border-0"
                      title="Comentar"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{pub.comments?.length || 0}</span>
                    </button>

                    <button 
                      onClick={(e) => handleFavorite(pub, e)}
                      className={cn(
                        "flex items-center gap-1.5 font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer",
                        hasFav ? "text-amber-400" : "text-slate-400 hover:text-amber-400"
                      )}
                    >
                      <Star className={cn("w-4 h-4", hasFav && "fill-amber-400")} />
                      <span>{pub.favorites?.length || 0}</span>
                    </button>

                    <button 
                      onClick={(e) => handleReportPub(pub.id, e)}
                      className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-0"
                      title="Denunciar vídeo"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL VIEW & CANVAS PLAYER MODAL */}
      {selectedPub && (
        <DetailPlayerModal 
          pub={selectedPub}
          userSession={userSession}
          onClose={() => setSelectedPub(null)}
          onLike={() => handleLike(selectedPub)}
          onFavorite={() => handleFavorite(selectedPub)}
          onRemix={() => {
            onRemixProject(selectedPub.projectData);
            setSelectedPub(null);
          }}
          onCommentSubmit={handleAddComment}
          commentText={newCommentText}
          onCommentTextChange={setNewCommentText}
          onReport={() => handleReportPub(selectedPub.id)}
        />
      )}

      {/* PUBLISH PROJECT SELECTION MODAL */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0d0d14] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up text-left">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-[#12121c]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-white text-sm tracking-wide uppercase">Publicar Projeto no Feed</h3>
              </div>
              <button 
                onClick={() => setIsPublishModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishProject} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Selecione o Projeto para Postar</label>
                {localProjects.length === 0 ? (
                  <p className="text-amber-400 font-semibold text-center p-2 border border-amber-500/10 rounded-xl bg-amber-500/5">
                    Você não possui projetos salvos para publicar. Crie um primeiro!
                  </p>
                ) : (
                  <select
                    className="w-full bg-[#161622] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 text-xs font-semibold cursor-pointer"
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      const proj = localProjects.find(p => p.id === e.target.value);
                      if (proj) {
                        setPublishTitle(proj.name || '');
                      }
                    }}
                    required
                  >
                    <option value="">-- Selecione um Projeto --</option>
                    {localProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.clips?.length || 0} clipes)</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Título da Publicação</label>
                <input 
                  type="text"
                  placeholder="Ex: Minha Animação Épica!"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  className="w-full bg-[#161622] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Descrição / Legenda</label>
                <textarea 
                  placeholder="Escreva algo sobre sua criação, filtros usados ou técnica..."
                  value={publishDesc}
                  onChange={(e) => setPublishDesc(e.target.value)}
                  className="w-full bg-[#161622] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 h-24 font-medium resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={publishing || !selectedProjectId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl shadow-[0_4px_25px_rgba(79,70,229,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Postar Publicamente</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE EDIT MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f0f15] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-left">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#13131b]">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-violet-400" />
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-200">Editar Perfil de Criador</span>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Seu Nome de Criador</label>
                <input 
                  type="text"
                  placeholder="Ex: Criador Convidado"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full bg-[#161622] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 font-bold text-xs"
                  required
                />
              </div>

              <div className="bg-violet-500/5 border border-violet-500/10 p-3 rounded-xl space-y-1">
                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Nível: Criador verificado</p>
                <p className="text-[9px] text-slate-400 leading-normal">Seu nome será atualizado em novas publicações e comentários que você fizer.</p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={!newProfileName.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-black py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Nome</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* HIGHLY IMMERSIVE DETAILS + CANVAS PROJECT PLAYER MODAL */
interface DetailPlayerModalProps {
  pub: Publication;
  userSession: any;
  onClose: () => void;
  onLike: () => void;
  onFavorite: () => void;
  onRemix: () => void;
  onCommentSubmit: (e: React.FormEvent) => void;
  commentText: string;
  onCommentTextChange: (val: string) => void;
  onReport: () => void;
}

function DetailPlayerModal({
  pub,
  userSession,
  onClose,
  onLike,
  onFavorite,
  onRemix,
  onCommentSubmit,
  commentText,
  onCommentTextChange,
  onReport
}: DetailPlayerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playIntervalRef = useRef<any>(null);
  
  // High-fidelity image and video asset caching
  const [mediaCache, setMediaCache] = useState<Record<string, HTMLImageElement | HTMLVideoElement>>({});

  const hasLiked = pub.likes.includes(userSession.email || 'guest-' + userSession.name || 'guest');
  const hasFav = pub.favorites.includes(userSession.email || 'guest-' + userSession.name || 'guest');

  // Compute project total duration
  const duration = Math.max(
    5,
    pub.projectData?.clips?.reduce((acc, c) => Math.max(acc, c.startTime + (c.clipEndOffset - c.clipStartOffset)), 0) || 5
  );

  // Load all media files into cache dynamically on mount/change
  useEffect(() => {
    const cache: Record<string, HTMLImageElement | HTMLVideoElement> = {};
    const clips = pub.projectData?.clips || [];
    const mediaItems = pub.projectData?.media || [];
    let active = true;

    const promises = clips.map((clip: any) => {
      if (clip.type === 'image' || clip.type === 'video') {
        const media = mediaItems.find((m: any) => m.id === clip.mediaId || (m.name === clip.name && m.type === clip.type)) as any;
        const url = media?.dataUrl || media?.url || clip.dataUrl || clip.url;
        if (!url) return Promise.resolve();

        return new Promise<void>((resolve) => {
          if (clip.type === 'image') {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            img.onload = () => {
              if (active) cache[clip.id] = img;
              resolve();
            };
            img.onerror = () => {
              // Try without anonymous crossOrigin
              const img2 = new Image();
              img2.src = url;
              img2.onload = () => {
                if (active) cache[clip.id] = img2;
                resolve();
              };
              img2.onerror = () => resolve();
            };
          } else if (clip.type === 'video') {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.src = url;
            video.muted = true;
            video.playsInline = true;
            video.onloadeddata = () => {
              if (active) cache[clip.id] = video;
              resolve();
            };
            video.onerror = () => {
              resolve();
            };
          } else {
            resolve();
          }
        });
      }
      return Promise.resolve();
    });

    Promise.all(promises).then(() => {
      if (active) setMediaCache(cache);
    });

    return () => {
      active = false;
    };
  }, [pub]);

  // Playhead loop controller
  useEffect(() => {
    if (isPlaying) {
      const fps = 30;
      const step = 1 / fps;
      playIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + step;
          if (next >= duration) {
            return 0; // Loop play
          }
          return next;
        });
      }, 1000 / fps);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, duration]);

  // High-Fidelity Real-time Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal resolution based on ratio
    const width = 360;
    const height = 640;
    canvas.width = width;
    canvas.height = height;

    // Reset smooth image drawing
    ctx.imageSmoothingEnabled = true;

    // Fill background color
    const bgColor = pub.projectData?.settings?.bgColor || '#000000';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Filter clips active at currentTime
    const activeClips = (pub.projectData?.clips || []).filter(c => {
      const end = c.startTime + (c.clipEndOffset - c.clipStartOffset);
      return currentTime >= c.startTime && currentTime <= end;
    });

    activeClips.forEach((clip: any) => {
      ctx.save();
      
      // Calculate local progress in active clip
      const localTime = clip.clipStartOffset + (currentTime - clip.startTime);
      const clipDuration = clip.clipEndOffset - clip.clipStartOffset;
      
      let opacity = 1;
      let scale = clip.scale || 0.5;
      let posX = clip.posX || 0; // relative coordinates (-50 to 50)
      let posY = clip.posY || 0; // relative coordinates (-50 to 50)
      let rotation = clip.rotation || 0;
      let transitionFilter = '';

      // Transition In
      if (clip.transitionIn) {
        const inDur = clip.transitionInDuration || 0.5;
        const tIn = currentTime - clip.startTime;
        if (tIn >= 0 && tIn < inDur) {
          const easeProgress = tIn / inDur;
          if (clip.transitionIn === 'fade') {
            opacity *= easeProgress;
          } else if (clip.transitionIn === 'zoom-in') {
            scale *= easeProgress;
            opacity *= easeProgress;
          } else if (clip.transitionIn === 'zoom-out') {
            scale *= (2 - easeProgress);
            opacity *= easeProgress;
          } else if (clip.transitionIn === 'spin') {
            rotation += (1 - easeProgress) * 360;
          } else if (clip.transitionIn === 'blur-fade') {
            opacity *= easeProgress;
            transitionFilter += ` blur(${(1 - easeProgress) * 10}px)`;
          } else if (clip.transitionIn === 'color-flash-white') {
            transitionFilter += ` brightness(${1 + (1 - easeProgress) * 3})`;
          } else if (clip.transitionIn === 'color-flash-black') {
            transitionFilter += ` brightness(${easeProgress})`;
          }
        }
      }

      // Transition Out
      const clipEndTime = clip.startTime + clipDuration;
      if (clip.transitionOut) {
        const outDur = clip.transitionOutDuration || 0.5;
        const tOut = clipEndTime - currentTime;
        if (tOut >= 0 && tOut <= outDur) {
          const p = (currentTime - (clipEndTime - outDur)) / outDur;
          const easeProgress = p;
          if (clip.transitionOut === 'fade') {
            opacity *= (1 - easeProgress);
          } else if (clip.transitionOut === 'zoom-in') {
            scale *= 1 + (easeProgress * 0.5);
            opacity *= (1 - easeProgress);
          } else if (clip.transitionOut === 'zoom-out') {
            scale *= Math.max(0.01, 1 - easeProgress);
            opacity *= (1 - easeProgress);
          } else if (clip.transitionOut === 'spin') {
            rotation -= easeProgress * 360;
          } else if (clip.transitionOut === 'blur-fade') {
            opacity *= (1 - easeProgress);
            transitionFilter += ` blur(${easeProgress * 10}px)`;
          } else if (clip.transitionOut === 'color-flash-white') {
            transitionFilter += ` brightness(${1 + easeProgress * 3})`;
          } else if (clip.transitionOut === 'color-flash-black') {
            transitionFilter += ` brightness(${1 - easeProgress})`;
          }
        }
      }

      // Special FX dynamic animations
      const t = localTime;
      if (clip.effect === 'effect-pulse') {
        const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.08;
        scale *= pulse;
      } else if (clip.effect === 'effect-zoom') {
        const zoomPhase = 1 + Math.abs(Math.sin(t * Math.PI * 0.2)) * 0.15;
        scale *= zoomPhase;
      } else if (clip.effect === 'effect-acid-trip') {
        rotation += Math.sin(t * Math.PI) * 4;
      } else if (clip.effect === 'effect-shake') {
        const f = t * 60;
        const shakeX = (Math.sin(f * 13) * 2 + Math.cos(f * 7) * 1);
        const shakeY = (Math.cos(f * 17) * 2 + Math.sin(f * 11) * 1);
        const shakeRot = Math.sin(f * 19) * 1;
        posX += shakeX;
        posY += shakeY;
        rotation += shakeRot;
      } else if (clip.effect === 'effect-bounce') {
        posY += Math.sin(t * Math.PI * 2) * -15;
      } else if (clip.effect === 'effect-glitch') {
        const glitchTime = Math.floor(t * 10);
        if (glitchTime % 3 === 0) {
          posX += Math.sin(t * 100) * 8;
          posY += Math.cos(t * 150) * 4;
          rotation += Math.sin(t * 50) * 2;
        }
      }

      // Translate context to center then apply offset positioning
      const canvasX = (width / 2) + (posX * (width / 100));
      const canvasY = (height / 2) + (posY * (height / 100));
      
      ctx.translate(canvasX, canvasY);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.scale(scale, scale);
      ctx.globalAlpha = opacity;

      // Filter logic
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

      // Render content
      if (clip.type === 'text') {
        ctx.fillStyle = clip.textColor || '#ffffff';
        
        let fontStyle = 'bold';
        let fontFamily = 'sans-serif';
        if (clip.fontStyle === 'font-serif') fontFamily = 'Georgia, serif';
        else if (clip.fontStyle === 'font-mono') fontFamily = 'monospace';
        else if (clip.fontStyle === 'font-display') fontFamily = 'Impact, sans-serif';
        else if (clip.fontStyle === 'font-playful') fontFamily = 'Comic Sans MS, sans-serif';
        
        ctx.font = `${fontStyle} ${Math.round(width * 0.08)}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (clip.strokeColor) {
          ctx.strokeStyle = clip.strokeColor;
          ctx.lineWidth = 4;
          ctx.strokeText(clip.textContent || clip.name || 'Texto', 0, 0);
        }
        ctx.fillText(clip.textContent || clip.name || 'Texto', 0, 0);
        
      } else if (clip.type === 'shape') {
        ctx.fillStyle = clip.shapeColor || '#6366f1';
        ctx.beginPath();
        const r = width * 0.15;
        if (clip.shapeType === 'circle') {
          ctx.arc(0, 0, r, 0, Math.PI * 2);
        } else if (clip.shapeType === 'triangle') {
          ctx.moveTo(0, -r);
          ctx.lineTo(-r, r);
          ctx.lineTo(r, r);
          ctx.closePath();
        } else {
          // square / rectangle
          ctx.rect(-r, -r, r * 2, r * 2);
        }
        ctx.fill();
        
      } else {
        // Render preloaded Video or Image
        const element = mediaCache[clip.id];
        if (element && clip.type !== 'audio') {
          let imgW = 0, imgH = 0;
          if (element instanceof HTMLImageElement) {
            imgW = element.naturalWidth;
            imgH = element.naturalHeight;
          } else if (element instanceof HTMLVideoElement) {
            imgW = element.videoWidth;
            imgH = element.videoHeight;
            if (isPlaying) {
              element.currentTime = localTime % (element.duration || 5);
            }
          }

          if (imgW > 0 && imgH > 0) {
            const targetAspect = width / height;
            const imgAspect = imgW / imgH;
            const mode = clip.scaleMode || 'cover';
            let drawW = width, drawH = height;
            
            if (mode === 'contain') {
              if (imgAspect > targetAspect) {
                drawW = width;
                drawH = width / imgAspect;
              } else {
                drawH = height;
                drawW = height * imgAspect;
              }
            } else {
              if (imgAspect > targetAspect) {
                drawH = height;
                drawW = height * imgAspect;
              } else {
                drawW = width;
                drawH = width / imgAspect;
              }
            }
            ctx.drawImage(element, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            // Loader State
            ctx.fillStyle = 'rgba(79, 70, 229, 0.2)';
            ctx.fillRect(-width/2, -height/2, width, height);
          }
        } else {
          // Fallback beautiful styled box
          ctx.fillStyle = 'rgba(79, 70, 229, 0.2)';
          ctx.strokeStyle = 'rgba(79, 70, 229, 0.4)';
          ctx.lineWidth = 2;
          ctx.fillRect(-width * 0.4, -height * 0.2, width * 0.8, height * 0.4);
          ctx.strokeRect(-width * 0.4, -height * 0.2, width * 0.8, height * 0.4);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(clip.type.toUpperCase(), 0, 0);
        }
      }

      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    });
  }, [currentTime, pub, isPlaying, mediaCache]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[110] flex items-center justify-center p-0 md:p-6 select-none animate-fade-in">
      <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl bg-[#09090d] border border-white/5 md:rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Close button for entire modal */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-slate-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Canvas Section (Left Pane) */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center p-4 relative min-h-[50vh] md:min-h-0 border-r border-white/5">
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] bg-[#030305] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            
            {/* Ambient Watermark */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full text-[8px] font-bold text-slate-400 border border-white/5">
              <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" />
              <span>MOTIONFLUX PUBLIC</span>
            </div>

            {/* Play Button Overlay */}
            {!isPlaying && (
              <button 
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl transition-all scale-105 active:scale-95 border border-indigo-400/30 cursor-pointer"
              >
                <Play className="w-7 h-7 fill-white text-white relative left-0.5" />
              </button>
            )}
          </div>

          {/* Player controls */}
          <div className="w-full max-w-[320px] mt-4 flex items-center gap-4 text-xs">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-white font-bold tracking-wider cursor-pointer transition-colors shrink-0"
            >
              {isPlaying ? 'PAUSAR' : 'PLAY'}
            </button>

            {/* Progress Bar scrubber */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden relative border border-white/5">
                <div 
                  className="bg-indigo-500 h-full absolute top-0 left-0"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>

        {/* Info & Comments Sidebar (Right Pane) */}
        <div className="w-full md:w-[380px] bg-[#0d0d12]/95 flex flex-col h-[50vh] md:h-auto min-h-0 text-left">
          
          {/* Header Info */}
          <div className="p-4 border-b border-white/5 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-indigo-400 font-extrabold tracking-wider uppercase font-mono">
                {pub.projectData?.name || 'Projeto'}
              </span>
              <h3 className="text-base font-extrabold text-white tracking-tight leading-tight">{pub.title}</h3>
              <p className="text-xs text-slate-400 leading-normal max-h-16 overflow-y-auto">{pub.description || 'Sem descrição.'}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400 font-bold">
              <span>Por {pub.userName}</span>
              <span>{(new Date(pub.createdAt)).toLocaleDateString()}</span>
            </div>

            {/* Actions Quick Row */}
            <div className="flex gap-2 pt-1">
              <button 
                onClick={onLike}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border font-bold text-xs transition-transform active:scale-95 cursor-pointer",
                  hasLiked ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-rose-400"
                )}
              >
                <Heart className={cn("w-4 h-4", hasLiked && "fill-rose-400")} />
                <span>{pub.likes?.length || 0}</span>
              </button>

              <button 
                onClick={onFavorite}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border font-bold text-xs transition-transform active:scale-95 cursor-pointer",
                  hasFav ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-amber-400"
                )}
              >
                <Star className={cn("w-4 h-4", hasFav && "fill-amber-400")} />
                <span>{pub.favorites?.length || 0}</span>
              </button>

              <button 
                onClick={onRemix}
                className="flex-[1.5] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white border border-violet-500/30 font-black text-xs transition-all cursor-pointer shadow-lg active:scale-95 shadow-violet-600/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                <span>REMIXAR</span>
              </button>
            </div>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-[#09090c]">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">Comentários ({pub.comments?.length || 0})</p>
            {pub.comments?.length === 0 ? (
              <p className="text-slate-500 text-[11px] text-center py-4 font-medium">Nenhum comentário ainda. Escreva algo bacana!</p>
            ) : (
              <div className="space-y-3">
                {pub.comments?.map((comment) => (
                  <div key={comment.id} className="space-y-0.5 bg-[#121217] border border-white/5 p-2 rounded-xl text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-indigo-300">{comment.userName}</span>
                      <span className="text-[8px] text-slate-500 font-mono">{(new Date(comment.createdAt)).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-300 leading-normal font-medium">{comment.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment Form */}
          <form onSubmit={onCommentSubmit} className="p-3 border-t border-white/5 bg-[#0d0d12] flex gap-2 shrink-0">
            <input 
              type="text" 
              placeholder="Escreva um comentário..."
              value={commentText}
              onChange={(e) => onCommentTextChange(e.target.value)}
              className="flex-1 bg-[#14141a] border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs font-semibold"
              required
            />
            <button 
              type="submit"
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white cursor-pointer active:scale-95 shrink-0 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
