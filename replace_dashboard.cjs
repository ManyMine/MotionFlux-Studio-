const fs = require('fs');

let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

const returnStart = content.indexOf('  return (\n    <div className="flex-1 flex flex-col md:flex-row h-screen bg-[#050508]');
const lastBrace = content.lastIndexOf('}');

const newDashboard = `  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <button className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
          <Menu className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2">
          <Hexagon className="w-6 h-6 text-slate-800" strokeWidth={2.5} />
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            Alight Motion
          </h1>
        </div>
        <button className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer" onClick={handleLogout}>
          <UserCircle className="w-7 h-7 text-slate-500" strokeWidth={2} />
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto pb-24">
        
        {/* NOVOS MODELOS */}
        <section className="pt-6 pb-2">
          <div className="flex items-center justify-between px-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Novos Modelos</h2>
            <button className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer">Ver todos</button>
          </div>
          <div className="flex overflow-x-auto px-4 pb-4 gap-4 snap-x hide-scrollbar">
            {[
              { id: '1', title: 'Para você', color: 'bg-green-100', borderColor: 'border-emerald-400', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop' },
              { id: '2', title: 'Anime Romântico', color: 'bg-orange-100', borderColor: 'border-orange-400', image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=200&auto=format&fit=crop' },
              { id: '3', title: 'Chibi', color: 'bg-blue-100', borderColor: 'border-emerald-400', image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=200&auto=format&fit=crop' },
              { id: '4', title: 'Carro', color: 'bg-purple-100', borderColor: 'border-emerald-400', image: 'https://images.unsplash.com/photo-1493238792000-8113da705763?q=80&w=200&auto=format&fit=crop' },
              { id: '5', title: 'Esportes', color: 'bg-emerald-100', borderColor: 'border-emerald-400', image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=200&auto=format&fit=crop' },
            ].map(item => (
              <div key={item.id} className="flex flex-col items-center gap-2 snap-start shrink-0 cursor-pointer group">
                <div className={\`w-20 h-20 rounded-full border-[3px] \${item.borderColor} p-0.5 overflow-hidden shadow-sm group-active:scale-95 transition-transform\`}>
                  <div className={\`w-full h-full rounded-full \${item.color} overflow-hidden\`}>
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover mix-blend-multiply opacity-90" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-700 whitespace-nowrap">{item.title}</span>
              </div>
            ))}
          </div>
        </section>

        {/* PROJETOS RECENTES */}
        <section className="pt-4 pb-6">
          <div className="flex items-center justify-between px-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Projetos recentes</h2>
            <button className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer" onClick={() => setActiveTab('projects')}>Ver todos</button>
          </div>
          
          <div className="px-4">
            <button 
              onClick={() => setIsCreating(true)}
              className="w-full h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-white hover:bg-emerald-50 transition-colors flex items-center justify-center gap-3 cursor-pointer group shadow-sm active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" strokeWidth={3} />
              </div>
              <span className="text-base font-medium text-slate-800">Criar Novo Projeto</span>
            </button>
            
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
              <p className="text-sm text-slate-700 leading-snug">Assista tutoriais do Alight Motion</p>
              
              <div className="mt-auto flex items-center justify-end gap-3">
                <span className="text-sm font-bold text-slate-900">15 min</span>
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
              <p className="text-sm text-slate-700 leading-snug">Criar um projeto com Alight Motion</p>
              
              <div className="mt-auto flex items-center justify-end gap-3">
                <span className="text-sm font-bold text-slate-900">2 min</span>
                <div className="w-10 h-10 bg-slate-500/20 rounded-full flex items-center justify-center text-slate-700">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 px-6 py-2 flex items-center justify-between pb-safe z-50">
        <button className="flex flex-col items-center gap-1 min-w-[64px] text-slate-900 cursor-pointer">
          <Home className="w-6 h-6" strokeWidth={2.5} />
          <span className="text-[10px] font-medium">Página inicial</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 min-w-[64px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
          <GraduationCap className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">Tutoriais</span>
        </button>

        <div className="relative -top-5">
          <button 
            onClick={() => setIsCreating(true)}
            className="w-14 h-14 bg-emerald-400 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-8 h-8" strokeWidth={2.5} />
          </button>
        </div>

        <button 
          onClick={() => setActiveTab('projects')}
          className="flex flex-col items-center gap-1 min-w-[64px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer relative"
        >
          <div className="relative">
            <PlaySquare className="w-6 h-6" strokeWidth={2} />
            <div className="absolute -top-1.5 -right-3 bg-amber-400 text-white text-[8px] font-bold px-1 rounded-sm uppercase transform scale-90">New</div>
          </div>
          <span className="text-[10px] font-medium">Projetos</span>
        </button>

        <button 
          onClick={() => setActiveTab('templates')}
          className="flex flex-col items-center gap-1 min-w-[64px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">Modelos</span>
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
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: '9/16', label: '9:16', sub: 'TikTok', icon: <Smartphone className="w-4 h-4" /> },
                    { value: '16/9', label: '16:9', sub: 'YouTube', icon: <Video className="w-4 h-4" /> },
                    { value: '1/1', label: '1:1', sub: 'Post', icon: <LayoutGrid className="w-4 h-4" /> },
                    { value: '4/5', label: '4:5', sub: 'Insta', icon: <User className="w-4 h-4" /> }
                  ].map(item => (
                    <button
                      key={item.value}
                      onClick={() => setNewProjectRatio(item.value)}
                      className={\`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer \${newProjectRatio === item.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}\`}
                    >
                      {item.icon}
                      <span className="text-[11px] font-bold">{item.label}</span>
                    </button>
                  ))}
                </div>
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
                      className={\`w-10 h-10 rounded-full flex items-center justify-center \${newProjectBgColor === c.color ? 'ring-2 ring-offset-2 ring-emerald-500' : ''} \${c.border ? 'border border-slate-200' : ''}\`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 sm:rounded-b-2xl">
              <button 
                onClick={() => onCreateProject(newProjectName.trim(), newProjectRatio)}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-all"
              >
                Criar Projeto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
`;

const finalContent = content.substring(0, returnStart) + newDashboard + "\n}\n";
fs.writeFileSync('src/components/StartScreen.tsx', finalContent);
console.log('Replaced');
