const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add theme state
const stateIdx = content.indexOf('const [currentProjectId, setCurrentProjectIdState] = useState<string | null>');
content = content.substring(0, stateIdx) + 
  `const [theme, setTheme] = useState<'padrão' | 'nostalgia'>(() => (localStorage.getItem('mf-theme') as 'padrão' | 'nostalgia') || 'padrão');\n  ` + 
  content.substring(stateIdx);

// Add Theme switch handler
const handlerIdx = content.indexOf('const handleCreateProject =');
content = content.substring(0, handlerIdx) + 
  `const handleSwitchTheme = () => {\n    const newTheme = theme === 'padrão' ? 'nostalgia' : 'padrão';\n    setTheme(newTheme);\n    localStorage.setItem('mf-theme', newTheme);\n  };\n\n  ` + 
  content.substring(handlerIdx);

fs.writeFileSync('src/App.tsx', content);
console.log('Added theme state');
