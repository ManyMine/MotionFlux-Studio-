import React, { useState, useEffect } from 'react';
import { 
  Video, Plus, Folder, User, Clock, Sparkles, BookOpen, 
  Trash2, Edit2, Settings, ChevronRight, LogIn, Award, 
  Flame, HardDrive, Cpu, Play, Check, Copy, ArrowRight,
  LogOut, ShieldCheck, Mail, Lock, Smartphone, Chrome,
  Menu, UserCircle, GraduationCap, LayoutGrid, PlaySquare, Hexagon,
  Home, X
} from 'lucide-react';
import { cn } from '../utils';
import { MediaItem, TimelineClip } from '../types';
import { loginWithGoogle, syncUserProjectsWithFirestore } from '../utils/firebase';
import { PublicationsFeed } from './PublicationsFeed';

export interface Project {
  id: string;
  name: string;
  media: MediaItem[];
  clips: TimelineClip[];
  settings: {
    aspectRatio: string;
    quality: '720p' | '1080p' | '4K';
    fps: number;
    bgColor?: string;
    globalAnimationSpeed?: number;
  };
  updatedAt: number;
}

interface StartScreenProps {
  userSession: { email: string; name: string; isLoggedIn: boolean; method?: string };
  setUserSession: React.Dispatch<React.SetStateAction<{ email: string; name: string; isLoggedIn: boolean; method?: string }>>;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onCreateProject: (name: string, aspectRatio: string, bgColor?: string) => void;
  onRemixProject: (project: Omit<Project, 'id' | 'updatedAt'> & { name: string }) => void;
  onSwitchTheme?: () => void;
}

export function StartScreen({
  userSession,
  setUserSession,
  onOpenProject,
  onDeleteProject,
  onRenameProject,
  onCreateProject,
  onRemixProject,
  onSwitchTheme
}: StartScreenProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'projects' | 'publications' | 'templates' | 'account'>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Custom templates state loaded from localStorage - defaults to [] (empty) as requested!
  const [templates, setTemplates] = useState<any[]>(() => {
    const saved = localStorage.getItem('vid-editor-templates');
    return saved ? JSON.parse(saved) : [];
  });

  // Create Project State (With MotionFlux Studio style advanced configurations!)
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectRatio, setNewProjectRatio] = useState<string>('9/16');
  const [newProjectQuality, setNewProjectQuality] = useState<'720p' | '1080p' | '4K'>('1080p');
  const [newProjectFps, setNewProjectFps] = useState<number>(30);
  const [newProjectBgColor, setNewProjectBgColor] = useState<string>('#000000');
  const [isCreating, setIsCreating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [customRatioW, setCustomRatioW] = useState(1);
  const [customRatioH, setCustomRatioH] = useState(1);
  
  // Login / Registration Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isGooglePopupOpen, setIsGooglePopupOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('editor.convidado@gmail.com');
  const [customGoogleName, setCustomGoogleName] = useState('Editor Convidado');

  // Rename State
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Profile Name Editing
  const [isEditingProfileName, setIsEditingProfileName] = useState(false);
  const [profileTempName, setProfileTempName] = useState(userSession.name || '');

  const handleSaveProfileName = () => {
    if (!profileTempName.trim()) return;
    const updated = { ...userSession, name: profileTempName.trim() };
    setUserSession(updated);
    localStorage.setItem('vid-user-session', JSON.stringify(updated));
    setIsEditingProfileName(false);
  };

  // Anti-Lag State
  const [isAntiLag, setIsAntiLag] = useState<boolean>(() => {
    return localStorage.getItem('vid-anti-lag') === 'true';
  });

  const toggleAntiLag = () => {
    const nextVal = !isAntiLag;
    setIsAntiLag(nextVal);
    localStorage.setItem('vid-anti-lag', String(nextVal));
  };

  // Load projects from localStorage
  useEffect(() => {
    const loadProjects = () => {
      const saved = localStorage.getItem('vid-editor-projects');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Project[];
          parsed.sort((a, b) => b.updatedAt - a.updatedAt);
          setProjects(parsed);
        } catch (e) {
          console.error("Error reading stored projects:", e);
        }
      }
    };
    loadProjects();
    
    // Keep templates synced
    const savedTemplates = localStorage.getItem('vid-editor-templates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {}
    }

    window.addEventListener('storage', loadProjects);
    return () => window.removeEventListener('storage', loadProjects);
  }, []);

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    onCreateProject(newProjectName.trim(), newProjectRatio === 'custom' ? `${customRatioW}/${customRatioH}` : newProjectRatio);

    // Apply advanced MotionFlux Studio specifications to newest project
    setTimeout(() => {
      const saved = localStorage.getItem('vid-editor-projects');
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (list.length > 0) {
            const newest = list[list.length - 1];
            newest.settings = {
              aspectRatio: newProjectRatio,
              quality: newProjectQuality,
              fps: newProjectFps,
              bgColor: newProjectBgColor,
              globalAnimationSpeed: 1.0
            };
            localStorage.setItem('vid-editor-projects', JSON.stringify(list));
            window.dispatchEvent(new Event('storage'));
          }
        } catch (err) {
          console.error(err);
        }
      }
    }, 100);

    setNewProjectName('');
    setIsCreating(false);
  };

  const handleRenameSubmit = (id: string) => {
    if (!renamingName.trim()) return;
    onRenameProject(id, renamingName.trim());
    
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: renamingName.trim(), updatedAt: Date.now() } : p));
    setRenamingProjectId(null);
    setRenamingName('');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Projeto',
      message: 'Tem certeza que deseja excluir permanentemente este projeto? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        onDeleteProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
        if (userSession.isLoggedIn && userSession.email) {
          const { deleteProjectFromCloud } = await import('../utils/firebase');
          await deleteProjectFromCloud(userSession.email, id);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Custom login handlers
  const handleEmailAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    if (isRegisterMode && !loginName.trim()) {
      setAuthError('Por favor, preencha o seu nome.');
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');

    setTimeout(async () => {
      const session = {
        email: loginEmail.toLowerCase().trim(),
        name: isRegisterMode ? loginName.trim() : loginEmail.split('@')[0],
        isLoggedIn: true,
        method: 'email'
      };
      
      localStorage.setItem('vid-user-session', JSON.stringify(session));
      setUserSession(session);
      await syncUserProjectsWithFirestore(session.email);
      setIsAuthenticating(false);
    }, 800);
  };

  const triggerGoogleLoginFlow = async () => {
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const user = await loginWithGoogle();
      
      let displayName = user.displayName;
      if (!displayName && user.email?.toLowerCase() === 'nubbyentertainment@gmail.com') {
        displayName = 'Nubby Entertainment';
      }
      if (!displayName) displayName = user.email?.split('@')[0] || 'Usuário Google';

      const session = {
        email: user.email || '',
        name: displayName,
        isLoggedIn: true,
        method: 'google'
      };
      
      localStorage.setItem('vid-user-session', JSON.stringify(session));
      setUserSession(session);
      if (user.email) {
        await syncUserProjectsWithFirestore(user.email);
      }
    } catch (err: any) {
      console.warn("Real Google Sign-In failed or was blocked by iframe constraints. Falling back to account simulation:", err);
      // Fallback: If popup is blocked/unsupported in iframe, show the choice modal
      setIsGooglePopupOpen(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const selectGoogleAccount = (email: string, name: string) => {
    setIsAuthenticating(true);
    setIsGooglePopupOpen(false);

    setTimeout(async () => {
      const session = {
        email,
        name,
        isLoggedIn: true,
        method: 'google'
      };
      
      localStorage.setItem('vid-user-session', JSON.stringify(session));
      setUserSession(session);
      await syncUserProjectsWithFirestore(email);
      setIsAuthenticating(false);
    }, 600);
  };

  const enterAsGuest = () => {
    const session = {
      email: 'editor.convidado@gmail.com',
      name: 'Editor Convidado',
      isLoggedIn: true,
      method: 'guest'
    };
    localStorage.setItem('vid-user-session', JSON.stringify(session));
    setUserSession(session);
  };

  const handleLogout = () => {
    
      const session = { email: '', name: '', isLoggedIn: false, method: '' };
      localStorage.setItem('vid-user-session', JSON.stringify(session));
      setUserSession(session);
      setActiveTab('projects');
  };

  const getRatioBadge = (ratio: string) => {
    switch (ratio) {
      case '9/16': return '9:16 (TikTok/Celular)';
      case '16/9': return '16:9 (YouTube Widescreen)';
      case '1/1': return '1:1 (Quadrado)';
      case '4/5': return '4:5 (Instagram Portrait)';
      case '21/9': return '21:9 (Cinemático)';
      default: return ratio;
    }
  };

  const [profileName, setProfileName] = useState(() => localStorage.getItem('vid-profile-name') || userSession.name || 'Nubby Creator');
  const [profileColor, setProfileColor] = useState(() => localStorage.getItem('vid-profile-color') || 'bg-violet-600');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    if (userSession.name) {
      setProfileName(userSession.name);
    }
  }, [userSession]);

  const saveProfile = () => {
    localStorage.setItem('vid-profile-name', profileName);
    localStorage.setItem('vid-profile-color', profileColor);
    
    // Sync with session
    const updatedSession = { ...userSession, name: profileName };
    localStorage.setItem('vid-user-session', JSON.stringify(updatedSession));
    setUserSession(updatedSession);
    
    setIsEditingProfile(false);
  };

  // If NOT logged in, show the spectacular CapCut + MotionFlux Studio Login Portal
  if (!userSession.isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050508] text-white font-sans flex items-center justify-center p-4 relative overflow-hidden selection:bg-violet-500/30">
        
        {/* Glowing Background Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-600/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#0d0d14]/80 border border-white/5 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl relative z-10 space-y-6">
          
          {/* Brand Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 shadow-[0_0_30px_rgba(139,92,246,0.3)] animate-pulse mb-1">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                MotionFlux Studio
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                CapCut + MotionFlux Studio Render Engine
              </p>
            </div>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-center text-[11px] font-semibold leading-relaxed">
              {authError}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5 text-xs">
            {isRegisterMode && (
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold block uppercase tracking-wider text-[8px]">Seu Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubby Creator"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors font-semibold"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold block uppercase tracking-wider text-[8px]">E-mail de Usuário</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold block uppercase tracking-wider text-[8px]">Senha Secreta</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black py-2.5 rounded-xl shadow-[0_4px_20px_rgba(124,58,237,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Criar Nova Conta' : 'Acessar Workspace'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Social Sign-in or Alternative */}
          <div className="space-y-3 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/5 w-full absolute" />
              <span className="bg-[#0d0d14] text-slate-500 text-[9px] font-bold uppercase tracking-widest px-3 relative z-10">OU</span>
            </div>

            {/* Simulated Google SSO Button */}
            <button
              onClick={triggerGoogleLoginFlow}
              className="w-full bg-[#1e1e24] hover:bg-[#25252e] border border-white/5 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-98"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Entrar com o Google</span>
            </button>

            {/* Guest Entry Option */}
            <div className="text-center pt-2">
              <button
                onClick={enterAsGuest}
                className="text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer block mx-auto"
              >
                Continuar sem Login (Modo Convidado)
              </button>
            </div>
          </div>

          {/* Toggle register mode */}
          <div className="text-center text-[10px] text-slate-500 border-t border-white/5 pt-4">
            {isRegisterMode ? (
              <span>Já possui uma conta?{' '}
                <button onClick={() => setIsRegisterMode(false)} className="text-violet-400 hover:text-violet-300 font-bold underline">
                  Acessar estúdio
                </button>
              </span>
            ) : (
              <span>Primeira vez aqui?{' '}
                <button onClick={() => setIsRegisterMode(true)} className="text-violet-400 hover:text-violet-300 font-bold underline">
                  Criar conta grátis
                </button>
              </span>
            )}
          </div>
        </div>

        {/* GOOGLE ACCOUNTS SIMULATED CHOOSE DIALOG POPUP */}
        {isGooglePopupOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-5 animate-scale-up text-left">
              
              {/* Google Brand Header */}
              <div className="flex flex-col items-center text-center space-y-1 pb-2 border-b border-white/5">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <h3 className="font-extrabold text-slate-100 text-sm tracking-tight pt-2">Escolha uma conta Google</h3>
                <p className="text-[10px] text-slate-400">para continuar em <span className="text-violet-400 font-bold">MotionFlux Studio</span></p>
              </div>

              {/* Accounts Choices list */}
              <div className="space-y-2.5 text-xs">
                {/* Real Google Account Option */}
                <button
                  onClick={async () => {
                    setIsGooglePopupOpen(false);
                    await triggerGoogleLoginFlow();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/30 hover:border-violet-500 text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-[10px] font-black uppercase text-white shadow-inner">
                    G
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold text-violet-300 group-hover:text-violet-200 leading-tight">Fazer login real com o Google</span>
                    <span className="block text-[10px] text-slate-400">Usar sua própria conta do Google</span>
                  </div>
                  <Chrome className="w-3.5 h-3.5 text-violet-400 shrink-0 animate-pulse" />
                </button>

                {/* Choice 1: Interactive Custom Google Sign-In Card */}
                <div className="w-full p-3 rounded-xl bg-slate-900/40 border border-violet-500/30 text-left space-y-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-black uppercase text-white shadow-inner">
                      {customGoogleName ? customGoogleName.slice(0, 2).toUpperCase() : 'G'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-100 leading-tight">Configurar Conta Google</span>
                      <span className="block text-[10px] text-slate-400">Insira seus dados para simular o login do Google</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Nome do Google</label>
                      <input 
                        type="text" 
                        value={customGoogleName}
                        onChange={(e) => setCustomGoogleName(e.target.value)}
                        className="w-full bg-[#1e1e2e]/60 text-white text-xs px-2.5 py-1.5 rounded border border-white/10 focus:border-violet-500 outline-none"
                        placeholder="Ex: Nubby Entertainment"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">E-mail do Google</label>
                      <input 
                        type="email" 
                        value={customGoogleEmail}
                        onChange={(e) => setCustomGoogleEmail(e.target.value)}
                        className="w-full bg-[#1e1e2e]/60 text-white text-xs px-2.5 py-1.5 rounded border border-white/10 focus:border-violet-500 outline-none"
                        placeholder="Ex: nubbyentertainment@gmail.com"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => selectGoogleAccount(customGoogleEmail, customGoogleName)}
                    className="w-full h-8 mt-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    Entrar com esta Conta
                  </button>
                </div>

                {/* Choice 2: Custom Developer sign-in */}
                <button
                  onClick={() => selectGoogleAccount('dev.creator@gmail.com', 'Dev Motion')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-violet-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-black uppercase text-white shadow-inner">
                    DM
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-100 group-hover:text-white leading-tight">Dev Motion</span>
                    <span className="block text-[10px] text-slate-400">dev.creator@gmail.com</span>
                  </div>
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </button>

                {/* Option to cancel */}
                <button
                  onClick={() => setIsGooglePopupOpen(false)}
                  className="w-full text-center text-slate-400 hover:text-white py-1 text-[11px] font-semibold tracking-wider uppercase pt-4 transition-colors"
                >
                  Voltar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      
      {/* SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)}>
          <div 
            className="w-64 h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hexagon className="w-6 h-6 text-emerald-500" strokeWidth={2.5} />
                <span className="font-bold text-slate-800">Menu</span>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-800 rounded-full cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4">
              <div className="px-3 space-y-1">
                <button onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer text-left font-medium">
                  <Home className="w-5 h-5" /> Início
                </button>
                <button onClick={() => { setActiveTab('projects'); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer text-left font-medium">
                  <PlaySquare className="w-5 h-5" /> Projetos Salvos
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer text-left font-medium">
                  <GraduationCap className="w-5 h-5" /> Tutoriais
                </button>
              </div>

              <div className="px-6 py-4 mt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sua Conta</p>
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 mb-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <UserCircle className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{userSession.name || 'Convidado'}</p>
                      <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest mt-0.5">Criador MotionFlux</p>
                    </div>
                  </div>

                  {isEditingProfileName ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <input 
                        type="text"
                        value={profileTempName}
                        onChange={(e) => setProfileTempName(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-800"
                        placeholder="Nome do Criador"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSaveProfileName}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] py-1 px-2 rounded-lg cursor-pointer transition-colors"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={() => setIsEditingProfileName(false)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] py-1 px-2 rounded-lg cursor-pointer transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setProfileTempName(userSession.name || ''); setIsEditingProfileName(true); }}
                      className="w-full text-center text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> Alterar Nome de Criador
                    </button>
                  )}
                </div>

                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left text-sm font-medium">
                  <LogOut className="w-4 h-4" /> Sair da conta
                </button>
                <button onClick={onSwitchTheme} className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left text-sm font-medium">
                  <LayoutGrid className="w-4 h-4" /> Alternar Tema
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <button className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
          <Menu className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2">
          <Hexagon className="w-6 h-6 text-slate-800" strokeWidth={2.5} onClick={onSwitchTheme} />
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            MotionFlux Studio
          </h1>
        </div>
        <button className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer" onClick={handleLogout}>
          <UserCircle className="w-7 h-7 text-slate-500" strokeWidth={2} />
        </button>
      </header>

            {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <>
            {/* PROJETOS RECENTES (HOME) */}
            <section className="pt-4 pb-6">
              <div className="flex items-center justify-between px-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Projetos Recentes</h2>
                <button className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer" onClick={() => setActiveTab('projects')}>Ver todos</button>
              </div>
              
              <div className="px-4">
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="flex-1 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-white hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2.5 cursor-pointer group shadow-sm active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform shrink-0">
                      <Plus className="w-4 h-4" strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Novo Projeto</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('publications')}
                    className="flex-1 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 transition-colors flex items-center justify-center gap-2.5 cursor-pointer group shadow-sm active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform shrink-0">
                      <Sparkles className="w-4 h-4 text-white animate-pulse" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Publicações</span>
                  </button>
                </div>
                
                {/* Lista de Projetos (se houver) */}
                {projects.slice(0, 2).map((project) => (
                  <div 
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    className="mt-3 bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Video className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{project.name}</h3>
                        <p className="text-xs text-slate-500">{(new Date(project.updatedAt)).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                ))}
              </div>
            </section>

            {/* COMEÇAR */}
            <section className="pt-2 pb-8">
              <div className="px-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Começar</h2>
              </div>
              
              <div className="flex overflow-x-auto px-4 pb-4 gap-4 snap-x hide-scrollbar">
                
                {/* Card 1 */}
                <div className="w-64 h-64 shrink-0 snap-start bg-[#ece5ff] rounded-2xl p-6 flex flex-col relative cursor-pointer active:scale-95 transition-transform overflow-hidden">
                  <div className="w-10 h-10 mb-4 text-slate-800">
                    <GraduationCap className="w-full h-full" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2">Assista Nossos Tutoriais</h3>
                  <p className="text-sm text-slate-700 leading-snug">Em breve</p>
                  <div className="mt-auto flex items-center justify-end gap-3">
                    <span className="text-sm font-bold text-slate-900">Em breve</span>
                    <div className="w-10 h-10 bg-slate-500/20 rounded-full flex items-center justify-center text-slate-700">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="w-64 h-64 shrink-0 snap-start bg-[#e5f6ff] rounded-2xl p-6 flex flex-col relative cursor-pointer active:scale-95 transition-transform overflow-hidden">
                  <div className="w-10 h-10 mb-4 text-slate-800">
                    <Sparkles className="w-full h-full" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2">Criar um Projeto</h3>
                  <p className="text-sm text-slate-700 leading-snug">Criar um projeto com MotionFlux Studio</p>
                  
                  <div className="mt-auto flex items-center justify-end gap-3">
                    <span className="text-sm font-bold text-slate-900">2 min</span>
                    <div className="w-10 h-10 bg-slate-500/20 rounded-full flex items-center justify-center text-slate-700">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

              </div>
            </section>
          </>
        )}

        {activeTab === 'projects' && (
          <section className="pt-6 pb-6 animate-in fade-in">
            <div className="px-4 mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Projetos Salvos</h2>
              <p className="text-slate-500 text-sm mt-1">{projects.length} projeto(s)</p>
            </div>

            <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full h-32 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" strokeWidth={3} />
                </div>
                <span className="text-sm font-bold text-emerald-700">Novo Projeto</span>
              </button>

              {projects.map((project) => (
                <div 
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-[0.98] group relative"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                      <Video className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1 truncate">{project.name}</h3>
                  <div className="flex items-center text-xs font-medium text-slate-500 gap-3">
                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Settings className="w-3 h-3" /> {project.settings?.aspectRatio || '9/16'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'publications' && (
          <div className="absolute inset-0 z-40 bg-[#07070a] flex flex-col pb-16">
            <PublicationsFeed 
              userSession={userSession}
              setUserSession={setUserSession}
              onBack={() => setActiveTab('home')}
              onRemixProject={(projectData) => {
                onRemixProject(projectData);
              }}
            />
          </div>
        )}
      </main>

{/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between pb-safe z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 min-w-[56px] cursor-pointer transition-colors ${activeTab === 'home' ? 'text-emerald-500 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>
          <Home className="w-5.5 h-5.5" strokeWidth={2.5} />
          <span className="text-[9px] font-medium">Início</span>
        </button>
        
        <button onClick={() => setActiveTab('publications')} className={`flex flex-col items-center gap-1 min-w-[56px] cursor-pointer transition-colors ${activeTab === 'publications' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-indigo-500'}`}>
          <Sparkles className="w-5.5 h-5.5 text-indigo-500 animate-pulse" strokeWidth={2.5} />
          <span className="text-[9px] font-medium">Publicações</span>
        </button>

        <div className="relative -top-5">
          <button 
            onClick={() => setIsCreating(true)}
            className="w-13 h-13 bg-emerald-400 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </button>
        </div>

        <button onClick={() => setActiveTab('projects')} className={`flex flex-col items-center gap-1 min-w-[56px] cursor-pointer relative transition-colors ${activeTab === 'projects' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
          <div className="relative">
            <PlaySquare className="w-5.5 h-5.5" strokeWidth={2} />
            <div className="absolute -top-1.5 -right-3 bg-amber-400 text-white text-[7px] font-bold px-0.5 rounded-sm uppercase transform scale-90">New</div>
          </div>
          <span className="text-[9px] font-medium">Projetos</span>
        </button>

        <button className="flex flex-col items-center gap-1 min-w-[56px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
          <GraduationCap className="w-5.5 h-5.5" strokeWidth={2} />
          <span className="text-[9px] font-medium">Tutoriais</span>
        </button>
      </nav>

      {/* CREATION MODAL OVERLAY */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:w-[480px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Novo Projeto</h3>
              <button 
                onClick={() => setIsCreating(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Nome do Projeto */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">Nome do Projeto</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                  placeholder="Projeto Sem Nome"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onCreateProject(newProjectName.trim(), newProjectRatio);
                    }
                  }}
                />
              </div>

                            {/* Aspect Ratio */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">Formato (Proporção)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { value: '9/16', label: '9:16', sub: 'TikTok', icon: <Smartphone className="w-4 h-4" /> },
                    { value: '16/9', label: '16:9', sub: 'YouTube', icon: <Video className="w-4 h-4" /> },
                    { value: '1/1', label: '1:1', sub: 'Post', icon: <LayoutGrid className="w-4 h-4" /> },
                    { value: '4/5', label: '4:5', sub: 'Insta', icon: <User className="w-4 h-4" /> },
                    { value: 'custom', label: 'Custom', sub: 'Livre', icon: <Settings className="w-4 h-4" /> }
                  ].map(item => (
                    <button
                      key={item.value}
                      onClick={() => setNewProjectRatio(item.value)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border-2 transition-all cursor-pointer ${newProjectRatio === item.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      {item.icon}
                      <span className="text-[10px] font-bold">{item.label}</span>
                    </button>
                  ))}
                </div>
                {newProjectRatio === 'custom' && (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500">Largura</label>
                      <input 
                        type="number" min="1" 
                        value={customRatioW} 
                        onChange={e => setCustomRatioW(Number(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <span className="text-slate-400 font-bold mt-5">:</span>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500">Altura</label>
                      <input 
                        type="number" min="1" 
                        value={customRatioH} 
                        onChange={e => setCustomRatioH(Number(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Resolução e FPS (simplified) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">Resolução</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                    value={newProjectQuality}
                    onChange={(e) => setNewProjectQuality(e.target.value as any)}
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (FHD)</option>
                    <option value="4K">4K (UHD)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">Taxa de Quadros</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                    value={newProjectFps}
                    onChange={(e) => setNewProjectFps(Number(e.target.value))}
                  >
                    <option value={24}>24 fps (Cinema)</option>
                    <option value={30}>30 fps (Padrão)</option>
                    <option value={60}>60 fps (Fluido)</option>
                  </select>
                </div>
              </div>

              {/* Fundo */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">Cor de Fundo</label>
                <div className="flex gap-2">
                  {[
                    { color: '#000000', label: 'Preto' },
                    { color: '#ffffff', label: 'Branco', border: true },
                    { color: '#e2e8f0', label: 'Cinza' },
                    { color: '#00ff00', label: 'Verde (Chroma)' },
                  ].map(c => (
                    <button
                      key={c.color}
                      onClick={() => setNewProjectBgColor(c.color)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${newProjectBgColor === c.color ? 'ring-2 ring-offset-2 ring-emerald-500' : ''} ${c.border ? 'border border-slate-200' : ''}`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 sm:rounded-b-2xl">
              <button 
                onClick={() => onCreateProject(newProjectName.trim(), newProjectRatio === 'custom' ? `${customRatioW}/${customRatioH}` : newProjectRatio)}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-all"
              >
                Criar Projeto
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0e0e16] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-white">
            <h3 className="text-base font-bold tracking-tight text-white">{confirmModal.title}</h3>
            <p className="text-xs text-slate-400 leading-normal">{confirmModal.message}</p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className="px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
