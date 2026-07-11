const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

// Fix Home button
content = content.replace(
  /<button onClick=\{\(\) => setActiveTab\('home'\)\} className="flex flex-col items-center gap-1 min-w-\[64px\] text-slate-900 cursor-pointer">/g,
  '<button onClick={() => setActiveTab(\'home\')} className={`flex flex-col items-center gap-1 min-w-[64px] cursor-pointer transition-colors ${activeTab === \'home\' ? \'text-slate-900\' : \'text-slate-500 hover:text-slate-900\'}`}>'
);

// Fix Projetos Salvos button
content = content.replace(
  /<button \n          onClick=\{\(\) => setActiveTab\('projects'\)\}\n          className="flex flex-col items-center gap-1 min-w-\[64px\] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer relative"\n        >/g,
  '<button onClick={() => setActiveTab(\'projects\')} className={`flex flex-col items-center gap-1 min-w-[64px] cursor-pointer relative transition-colors ${activeTab === \'projects\' ? \'text-slate-900\' : \'text-slate-500 hover:text-slate-900\'}`}>'
);

fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Fixed nav active states');
