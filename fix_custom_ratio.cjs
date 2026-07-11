const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

const ratioStart = content.indexOf('{/* Aspect Ratio */}');
const ratioEnd = content.indexOf('{/* Resolução e FPS (simplified) */}');

const newRatio = `              {/* Aspect Ratio */}
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
                      className={\`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border-2 transition-all cursor-pointer \${newProjectRatio === item.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}\`}
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
              
              `;

content = content.substring(0, ratioStart) + newRatio + content.substring(ratioEnd);

// Also fix the onCreateProject call to handle 'custom'
const btnIndex = content.indexOf('onClick={() => onCreateProject(newProjectName.trim(), newProjectRatio)}');
content = content.replace(
  'onClick={() => onCreateProject(newProjectName.trim(), newProjectRatio)}',
  'onClick={() => onCreateProject(newProjectName.trim(), newProjectRatio === \'custom\' ? `${customRatioW}/${customRatioH}` : newProjectRatio)}'
);

// and for Enter key:
content = content.replace(
  'onCreateProject(newProjectName.trim(), newProjectRatio);',
  'onCreateProject(newProjectName.trim(), newProjectRatio === \'custom\' ? `${customRatioW}/${customRatioH}` : newProjectRatio);'
);


fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Fixed custom ratio');
