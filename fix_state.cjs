const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');
content = content.replace("useState<'projects' | 'templates' | 'account'>('projects')", "useState<'home' | 'projects' | 'templates' | 'account'>('home')");
fs.writeFileSync('src/components/StartScreen.tsx', content);
