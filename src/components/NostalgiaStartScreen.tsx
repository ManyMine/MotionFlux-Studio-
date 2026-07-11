import React, { useState, useEffect } from 'react';
import { 
  Crown, Youtube, HelpCircle, Volume2, Settings, Plus, Home, Infinity, Bell, User, 
  Trash2, Edit2, Play, UserCircle, LogIn, Mail, Lock, ShieldCheck, Check, Clock, X, Video
} from 'lucide-react';
import { Project } from './StartScreen';
import { loginWithGoogle, syncUserProjectsWithFirestore } from '../utils/firebase';

interface Props {
  onCreateProject: (name: string, ratio: string, bgColor?: string) => void;
  onSwitchTheme: () => void;
  onOpenProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onRemixProject?: (project: any) => void;
  userSession?: any;
  setUserSession?: any;
}

export function NostalgiaStartScreen({ 
  onCreateProject, 
  onSwitchTheme,
  onOpenProject,
  onDeleteProject,
  onRenameProject,
  onRemixProject,
  userSession = { email: '', name: '', isLoggedIn: false },
  setUserSession
}: Props) {
  const [activeTab, setActiveTab] = useState<'home' | 'mix' | 'create' | 'notification' | 'eu'>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Local creation dialog
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectRatio, setProjectRatio] = useState('9/16');

  // Help FAQ Modal
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Authentication State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

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

  // Retro Profile Name Editing
  const [isEditingRetroName, setIsEditingRetroName] = useState(false);
  const [retroTempName, setRetroTempName] = useState(userSession.name || '');

  const handleSaveRetroName = () => {
    if (!retroTempName.trim()) return;
    const updated = { ...userSession, name: retroTempName.trim() };
    setUserSession(updated);
    localStorage.setItem('vid-user-session', JSON.stringify(updated));
    setIsEditingRetroName(false);
  };

  // Load and sync projects/templates
  const loadData = () => {
    const savedProjects = localStorage.getItem('vid-editor-projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects) as Project[];
        parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        setProjects(parsed);
      } catch (e) {}
    }
    const savedTemplates = localStorage.getItem('vid-editor-templates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {}
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreateProject(projectName.trim(), projectRatio);
    setIsCreateModalOpen(false);
    setProjectName('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    
    const session = {
      email: emailInput,
      name: isRegister ? (nameInput || 'Editor Retro') : emailInput.split('@')[0],
      isLoggedIn: true,
      method: 'E-mail'
    };
    
    if (setUserSession) {
      setUserSession(session);
    }
    localStorage.setItem('vid-user-session', JSON.stringify(session));
    syncUserProjectsWithFirestore(session.email);
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
      if (!displayName) displayName = user.email?.split('@')[0] || 'Editor Retro';

      const session = {
        email: user.email || '',
        name: displayName,
        isLoggedIn: true,
        method: 'google'
      };
      localStorage.setItem('vid-user-session', JSON.stringify(session));
      if (setUserSession) {
        setUserSession(session);
      }
      if (user.email) {
        await syncUserProjectsWithFirestore(user.email);
      }
    } catch (err: any) {
      console.error("Erro no login com o Google (Retro):", err);
      setAuthError(err.message || 'Erro ao autenticar com o Google. Tente novamente.');
      alert(err.message || 'Erro ao autenticar com o Google. Tente novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    const empty = { email: '', name: '', isLoggedIn: false };
    if (setUserSession) {
      setUserSession(empty);
    }
    localStorage.setItem('vid-user-session', JSON.stringify(empty));
  };

  const ratioPresets = [
    { value: '16/9', label: '16:9', desc: 'YouTube / Widescreen' },
    { value: '9/16', label: '9:16', desc: 'TikTok / Shorts / Reels' },
    { value: '1/1', label: '1:1', desc: 'Instagram Post Quadrado' },
    { value: '4/3', label: '4:3', desc: 'Televisão Antiga / iPad' },
    { value: '4/5', label: '4:5', desc: 'Instagram Feed Vertical' }
  ];

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#141416] text-slate-100 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#1c1c1f] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#fbbc05] flex items-center justify-center text-black">
            <Crown className="w-5 h-5 fill-current" />
          </div>
          <span className="font-bold text-lg text-white uppercase tracking-wider">Premium Retro</span>
        </div>
        
        <div className="flex items-center gap-4 text-slate-400">
          <Youtube 
            onClick={() => alert("Inscreva-se no canal da MasterFlux & MotionFlux para dicas e tutoriais rápidos!")} 
            className="w-6 h-6 hover:text-white transition-colors cursor-pointer" 
          />
          <HelpCircle 
            onClick={() => setIsHelpOpen(true)} 
            className="w-6 h-6 hover:text-white transition-colors cursor-pointer" 
          />
          <Volume2 
            onClick={() => alert("Efeitos sonoros vintage ativos na exportação.")} 
            className="w-6 h-6 hover:text-white transition-colors cursor-pointer" 
          />
          <button 
            onClick={onSwitchTheme} 
            className="p-1 bg-white/5 hover:bg-white/10 rounded-lg text-amber-400 hover:text-amber-300 transition-colors cursor-pointer" 
            title="Alternar Tema"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* Render Tab View */}
        {activeTab === 'home' && (
          <div className="p-4 flex flex-col gap-6">
            
            {/* Promo Banner */}
            <div className="h-28 rounded-2xl overflow-hidden relative bg-gradient-to-r from-amber-600 via-[#ca3a1a] to-amber-700 border border-white/10 flex items-center px-6 cursor-pointer shadow-lg hover:brightness-110 transition-all">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
              <div className="relative z-10 flex flex-col justify-center w-full">
                <span className="bg-white/20 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full w-fit mb-1.5 uppercase tracking-widest">Oferta Exclusiva</span>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="text-xl font-black text-white tracking-tight">MasterFlux Premium Grátis</p>
                    <p className="text-xs text-white/80">Acesso a todos os modelos, filtros retro e exportação 4K</p>
                  </div>
                  <div className="bg-white text-black font-black text-sm px-6 py-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-transform">ATIVAR</div>
                </div>
              </div>
            </div>

            {/* Quick Action Circle Buttons */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex-1 bg-[#ff5c35] hover:bg-[#ff704d] text-white rounded-2xl py-5 flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer border-0"
              >
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6" strokeWidth={3} />
                </div>
                <span className="font-extrabold text-base tracking-wide">Criar Novo</span>
              </button>

              <button 
                onClick={() => setActiveTab('mix')}
                className="flex-1 bg-[#282830] hover:bg-[#34343e] text-amber-200 rounded-2xl py-5 flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer border border-white/5"
              >
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-400">
                  <Infinity className="w-6 h-6" />
                </div>
                <span className="font-extrabold text-base tracking-wide">Remix Galeria</span>
              </button>
            </div>

            {/* Recent Projects Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-black text-base text-white/90 tracking-wide uppercase">Meus Projetos Recentes</h3>
                <span className="text-xs text-[#ff5c35] font-bold">Total: {projects.length}</span>
              </div>

              {projects.length === 0 ? (
                <div className="bg-[#1c1c1f] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-300">Nenhum projeto ainda</p>
                    <p className="text-xs text-slate-500 mt-0.5">Clique em 'Criar Novo' para inaugurar sua timeline!</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {projects.map((proj) => {
                    const aspectLabel = proj.settings?.aspectRatio || '16/9';
                    const lastUpdatedStr = new Date(proj.updatedAt).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    
                    return (
                      <div 
                        key={proj.id}
                        className="bg-[#1c1c1f] hover:bg-[#252529] border border-white/5 rounded-2xl p-4 flex gap-4 transition-all hover:scale-[1.02] shadow-sm relative group"
                      >
                        {/* Aspect Ratio Box Preset Graphic */}
                        <div 
                          onClick={() => onOpenProject && onOpenProject(proj.id)}
                          className="w-20 h-20 bg-[#282830] border border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer shrink-0 text-[#ff5c35] hover:text-white transition-colors"
                        >
                          <Video className="w-8 h-8 opacity-80" />
                          <span className="text-[10px] font-bold mt-1 text-slate-400">{aspectLabel}</span>
                        </div>

                        {/* Project Info details */}
                        <div className="flex-1 flex flex-col justify-between overflow-hidden">
                          <div onClick={() => onOpenProject && onOpenProject(proj.id)} className="cursor-pointer overflow-hidden">
                            <h4 className="font-bold text-white text-sm truncate pr-14 group-hover:text-[#ff5c35] transition-colors">{proj.name}</h4>
                            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{lastUpdatedStr}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3 mt-2 border-t border-white/5 pt-2">
                            <button 
                              onClick={() => {
                                if (onOpenProject) onOpenProject(proj.id);
                              }}
                              className="text-xs font-bold text-[#ff5c35] hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-current" /> Open
                            </button>
                            
                            <button 
                              onClick={() => {
                                if (!onRenameProject) return;
                                const newN = prompt("Digite o novo nome para o projeto:", proj.name);
                                if (newN && newN.trim()) {
                                  onRenameProject(proj.id, newN.trim());
                                  loadData();
                                }
                              }}
                              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center gap-1"
                              title="Renomear"
                            >
                              <Edit2 className="w-3 h-3" /> Renomear
                            </button>
                            
                            <button 
                              onClick={() => {
                                if (!onDeleteProject) return;
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'Excluir Projeto',
                                  message: `Deseja realmente excluir permanentemente o projeto "${proj.name}"? Esta ação não pode ser desfeita.`,
                                  onConfirm: async () => {
                                    onDeleteProject(proj.id);
                                    if (userSession.isLoggedIn && userSession.email) {
                                      const { deleteProjectFromCloud } = await import('../utils/firebase');
                                      await deleteProjectFromCloud(userSession.email, proj.id);
                                    }
                                    loadData();
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                  }
                                });
                              }}
                              className="text-xs font-medium text-slate-500 hover:text-red-400 transition-colors cursor-pointer border-0 bg-transparent ml-auto flex items-center gap-1"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" /> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'mix' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-1">
              <div>
                <h3 className="font-black text-lg text-white uppercase tracking-wider flex items-center gap-2">
                  <Infinity className="w-5 h-5 text-amber-400" />
                  <span>Mix de Modelos</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Use modelos criados e publicados por você para remixes instantâneos.</p>
              </div>
            </div>

            {templates.length === 0 ? (
              <div className="bg-[#1c1c1f] border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-amber-400">
                  <Infinity className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-300">Nenhum modelo publicado</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">No editor, você pode publicar seu projeto como modelo na galeria para vê-lo listado aqui!</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {templates.map((tpl) => (
                  <div 
                    key={tpl.id}
                    className="bg-gradient-to-r from-[#1c1c1f] to-[#25252a] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:scale-[1.01]"
                  >
                    <div>
                      <h4 className="font-bold text-white text-base">{tpl.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xl">{tpl.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">{tpl.aspectRatio}</span>
                        <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{tpl.clipsCount} Clipes</span>
                        <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">Duração: {Math.round(tpl.estimatedDuration)}s</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        if (onRemixProject) {
                          onRemixProject({
                            name: `Remix de ${tpl.title.replace('Modelo ', '')}`,
                            clips: tpl.clips,
                            media: tpl.media,
                            settings: {
                              aspectRatio: tpl.aspectRatio,
                              quality: '1080p',
                              fps: 30
                            }
                          });
                        }
                      }}
                      className="bg-[#ff5c35] hover:bg-[#ff704d] text-white font-extrabold text-sm px-5 py-2.5 rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform border-0"
                    >
                      Remixar Modelo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="p-4 flex flex-col gap-4">
            <h3 className="font-black text-lg text-white uppercase tracking-wider">Criar Novo Projeto</h3>
            <p className="text-xs text-slate-400 -mt-2">Configure o formato e o nome do seu vídeo social.</p>
            
            <form onSubmit={handleCreateSubmit} className="bg-[#1c1c1f] border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome do Projeto</label>
                <input 
                  type="text"
                  placeholder="Ex: Meu Vídeo Incrível"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#272730] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff5c35]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Selecione a Proporção (Aspect Ratio)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ratioPresets.map((preset) => (
                    <div 
                      key={preset.value}
                      onClick={() => setProjectRatio(preset.value)}
                      className={`cursor-pointer border p-4 rounded-xl flex items-center gap-3.5 transition-all ${projectRatio === preset.value ? 'bg-[#ff5c35]/10 border-[#ff5c35] text-[#ff5c35]' : 'bg-[#272730] border-white/5 hover:bg-[#2e2e38] text-slate-300'}`}
                    >
                      <div className="font-extrabold text-lg bg-white/5 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                        {preset.label}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-xs text-white">{preset.label}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{preset.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-[#ff5c35] hover:bg-[#ff704d] text-white font-extrabold py-3.5 rounded-xl tracking-wider text-sm mt-2 transition-colors cursor-pointer border-0 shadow-md"
              >
                CRIAR PROJETO
              </button>
            </form>
          </div>
        )}

        {activeTab === 'notification' && (
          <div className="p-4 flex flex-col gap-4">
            <h3 className="font-black text-lg text-white uppercase tracking-wider">Mural de Notificações</h3>
            <p className="text-xs text-slate-400 -mt-2">Confira as últimas novidades da MotionFlux & MasterFlux.</p>
            
            <div className="flex flex-col gap-3">
              {[
                { title: "Versão 4.0 Lançada com Sucesso!", date: "Hoje", desc: "Agora o tema MasterFlux possui total controle do playhead, gravação de voz instantânea e suporte de importação multimídia de áudio, vídeo e fotos diretamente da central.", tag: "Novidades", color: "text-amber-400" },
                { title: "Modelos Customizados Compartilháveis", date: "Ontem", desc: "Publique seu trabalho como modelo reutilizável e remixável direto da galeria pública do app. Economize tempo com fluxos otimizados.", tag: "Recurso", color: "text-blue-400" },
                { title: "Mídia e Áudio Unificados no Storage local", date: "3 dias atrás", desc: "A tecnologia de armazenamento em cache local armazena fotos e trilhas sonoras com integridade, prevenindo perda de progresso.", tag: "Segurança", color: "text-emerald-400" }
              ].map((notif, idx) => (
                <div key={idx} className="bg-[#1c1c1f] border border-white/5 rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${notif.color}`}>{notif.tag}</span>
                    <span className="text-[10px] text-slate-500">{notif.date}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">{notif.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{notif.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'eu' && (
          <div className="p-4 flex flex-col gap-4">
            <h3 className="font-black text-lg text-white uppercase tracking-wider">Minha Conta (Perfil)</h3>
            
            {userSession && userSession.isLoggedIn ? (
              <div className="bg-[#1c1c1f] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-[#ca3a1a] rounded-full flex items-center justify-center text-white font-black text-2xl">
                    {userSession.name ? userSession.name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{userSession.name || 'Usuário Premium'}</h4>
                    <p className="text-xs text-[#ff5c35] font-black uppercase tracking-widest mt-0.5">Criador Verificado Retro</p>
                  </div>
                </div>

                {isEditingRetroName ? (
                  <div className="space-y-3 bg-[#272730] p-4 rounded-xl border border-white/5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Novo Nome de Criador</label>
                    <input 
                      type="text"
                      value={retroTempName}
                      onChange={(e) => setRetroTempName(e.target.value)}
                      className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#ff5c35]"
                      placeholder="Nome do Criador"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveRetroName}
                        className="flex-1 bg-[#ff5c35] hover:bg-[#ff5c35]/80 text-white font-bold text-xs py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Salvar
                      </button>
                      <button 
                        onClick={() => setIsEditingRetroName(false)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setRetroTempName(userSession.name || ''); setIsEditingRetroName(true); }}
                    className="w-full text-center bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 px-4 rounded-xl border border-white/5 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#ff5c35]" />
                    <span>Mudar Nome do Perfil</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-[#272730] p-4 rounded-xl border border-white/5">
                    <p className="text-2xl font-black text-[#ff5c35]">{projects.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-1">Projetos Locais</p>
                  </div>
                  <div className="bg-[#272730] p-4 rounded-xl border border-white/5">
                    <p className="text-2xl font-black text-amber-400">Ativo</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-1">Nível de Assinatura</p>
                  </div>
                </div>

                <button 
                  onClick={handleLogout}
                  className="w-full bg-[#ca3a1a]/20 hover:bg-[#ca3a1a]/30 border border-[#ca3a1a]/30 text-[#ca3a1a] hover:text-red-400 font-bold text-xs py-3 rounded-xl transition-all tracking-wider mt-2 cursor-pointer"
                >
                  LOGOUT / DESCONECTAR CONTA
                </button>
              </div>
            ) : (
              <div className="bg-[#1c1c1f] border border-white/5 rounded-2xl p-6">
                <div className="flex flex-col items-center text-center gap-2 mb-6">
                  <UserCircle className="w-12 h-12 text-slate-500" />
                  <h4 className="font-bold text-white text-base">Faça login no MasterFlux Retro</h4>
                  <p className="text-xs text-slate-400 max-w-sm">Acesse e sincronize seus modelos na nuvem em múltiplos dispositivos com facilidade.</p>
                </div>

                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                  {isRegister && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Seu Nome</label>
                      <input 
                        type="text" 
                        placeholder="Ex: João da Silva"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full bg-[#272730] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Endereço de E-mail</label>
                    <input 
                      type="email" 
                      placeholder="usuario@dominio.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-[#272730] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Senha de Acesso</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-[#272730] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-[#ff5c35] hover:bg-[#ff704d] text-white font-bold py-3 rounded-xl text-xs tracking-wider border-0 shadow-md cursor-pointer mt-2"
                  >
                    {isRegister ? 'REGISTRAR NOVA CONTA' : 'LOGAR NO SISTEMA'}
                  </button>

                  <div className="relative flex items-center justify-center my-1.5">
                    <div className="border-t border-white/5 w-full absolute" />
                    <span className="bg-[#1c1c1f] text-slate-500 text-[9px] font-bold uppercase tracking-widest px-3 relative z-10 font-mono">OU</span>
                  </div>

                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={triggerGoogleLoginFlow}
                    className="w-full bg-[#272730] hover:bg-[#32323e] border border-white/10 text-white font-bold py-3 rounded-xl text-xs tracking-wider cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                    <span>{isAuthenticating ? 'CONECTANDO...' : 'ENTRAR COM O GOOGLE'}</span>
                  </button>

                  <p className="text-center text-xs text-slate-400 mt-2">
                    {isRegister ? 'Já possui login?' : 'Não possui uma conta?'}
                    <button 
                      type="button" 
                      onClick={() => setIsRegister(!isRegister)} 
                      className="text-[#ff5c35] font-bold ml-1 hover:underline bg-transparent border-0 cursor-pointer"
                    >
                      {isRegister ? 'Fazer Login' : 'Criar Conta Grátis'}
                    </button>
                  </p>
                </form>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bottom Nav Tabs Bar */}
      <nav className="flex items-center justify-between px-6 py-2 bg-[#1c1c1f] border-t border-white/5 pb-safe shrink-0">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer border-0 bg-transparent ${activeTab === 'home' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold">Início</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('mix')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer border-0 bg-transparent ${activeTab === 'mix' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Infinity className="w-6 h-6" />
          <span className="text-[10px] font-bold">Mix</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('create')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer border-0 bg-transparent ${activeTab === 'create' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <div className="w-8 h-8 bg-[#ff5c35] text-white rounded-full flex items-center justify-center mb-0.5 shadow-md">
            <Plus className="w-5 h-5" strokeWidth={3} />
          </div>
          <span className="text-[10px] font-bold">Crie</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('notification')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer border-0 bg-transparent ${activeTab === 'notification' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Bell className="w-6 h-6" />
          <span className="text-[10px] font-bold">Aviso</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('eu')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer border-0 bg-transparent ${activeTab === 'eu' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Eu</span>
        </button>
      </nav>

      {/* Creation Modal Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1c1f] border border-amber-500/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-[#27272b] px-6 py-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-white text-base">Selecione Aspect Ratio</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer border-0 bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nome do Projeto</label>
                <input 
                  type="text" 
                  placeholder="Projeto Retro MasterFlux"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#272730] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Formato Recomendado</label>
                <div className="grid grid-cols-2 gap-2">
                  {ratioPresets.slice(0, 4).map((preset) => (
                    <div 
                      key={preset.value}
                      onClick={() => setProjectRatio(preset.value)}
                      className={`cursor-pointer border p-3 rounded-xl text-center transition-all ${projectRatio === preset.value ? 'bg-[#ff5c35]/15 border-[#ff5c35] text-[#ff5c35]' : 'bg-[#272730] border-white/5 text-slate-300'}`}
                    >
                      <p className="font-bold text-sm">{preset.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">{preset.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-[#ff5c35] hover:bg-[#ff704d] text-white font-extrabold py-3 rounded-xl text-xs tracking-wider border-0 shadow-md cursor-pointer mt-2"
              >
                CRIAR AGORA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Retro Help FAQ Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1c1f] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-[#27272b] px-6 py-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-amber-400 text-sm tracking-wider uppercase">Ajuda & FAQ - MasterFlux</h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white cursor-pointer border-0 bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 text-xs text-slate-300 overflow-y-auto max-h-[60vh] leading-relaxed">
              <div>
                <h4 className="font-bold text-white mb-1">Como adiciono mídias no editor?</h4>
                <p>Clique no botão superior "Mídia" no controle circular (roda) para abrir a biblioteca e importar vídeos, fotos ou trilhas sonoras. Em seguida, clique em 'Add' para adicionar à timeline ou 'Overlay' para adicioná-los como camada.</p>
              </div>
              
              <div>
                <h4 className="font-bold text-white mb-1">Como usar a gravação de voz (REC)?</h4>
                <p>Mova o playhead para a posição desejada na linha de tempo. Clique no botão "REC" na roda para iniciar a gravação. Ao finalizar, clique em "PARAR" para inserir a nova trilha de voz no local correto.</p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">O que são as camadas de texto e formas?</h4>
                <p>Clique em "Camada" na roda e escolha "Texto" ou "Formas". Elas são inseridas acima do vídeo de fundo e podem ser animadas com efeitos exclusivos da Loja de Recursos!</p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">Onde mudo de tema?</h4>
                <p>Clique no ícone de Engrenagem / Configurações no canto superior direito do painel de início, ou no menu superior esquerdo dentro do editor, para alternar livremente entre o tema Padrão e o tema Nostalgia (MasterFlux).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#1c1c1f] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-white">
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
                className="px-4 py-2 text-xs font-bold bg-[#ff5c35] hover:bg-[#e04b24] active:bg-[#c23d1a] text-white rounded-xl transition-colors shadow-lg shadow-[#ff5c35]/20 cursor-pointer"
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
