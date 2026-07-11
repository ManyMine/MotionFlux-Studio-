const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

// replace the Novos Modelos section
const start = content.indexOf('{/* NOVOS MODELOS */}');
const end = content.indexOf('{/* PROJETOS RECENTES */}');
if (start !== -1 && end !== -1) {
  content = content.substring(0, start) + content.substring(end);
}

// and the "Projetos recentes" text to "Projetos Salvos"
content = content.replace(/<h2 className="text-lg font-semibold text-slate-900">Projetos recentes<\/h2>/, '<h2 className="text-lg font-semibold text-slate-900">Projetos Salvos</h2>');

fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Fixed');
