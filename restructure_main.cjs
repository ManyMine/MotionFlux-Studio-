const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

const mainStart = content.indexOf('{/* MAIN CONTENT */}');
const bottomNavStart = content.indexOf('{/* BOTTOM NAVIGATION */}');

const newMain = `      {/* MAIN CONTENT */}
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
      </main>

`;

content = content.substring(0, mainStart) + newMain + content.substring(bottomNavStart);
fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Restructured main');
