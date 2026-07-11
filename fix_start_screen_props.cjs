const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');
content = content.replace('onRemixProject: (id: string) => void;', 'onRemixProject: (id: string) => void;\n  onSwitchTheme?: () => void;');
content = content.replace('onRemixProject\n}: StartScreenProps) {', 'onRemixProject,\n  onSwitchTheme\n}: StartScreenProps) {');

const renderIdx = content.indexOf('<div className="flex items-center gap-2">');
content = content.replace('<Hexagon className="w-6 h-6 text-slate-800" strokeWidth={2.5} />', '<Hexagon className="w-6 h-6 text-slate-800" strokeWidth={2.5} onClick={onSwitchTheme} />');

fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Fixed props');
