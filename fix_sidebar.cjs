const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

// Sidebar toggle button
content = content.replace(
  '<button className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">',
  '<button className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer" onClick={() => setIsSidebarOpen(true)}>'
);

// Add the sidebar element right inside the main container before HEADER
const sidebarJSX = `
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
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <UserCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-tight">{userSession.name || 'Convidado'}</p>
                    <p className="text-[10px] text-slate-500">{userSession.email}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left text-sm font-medium">
                  <LogOut className="w-4 h-4" /> Sair da conta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace('{/* HEADER */}', sidebarJSX + '\n      {/* HEADER */}');

fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Added sidebar');
