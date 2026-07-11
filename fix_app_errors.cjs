const fs = require('fs');

// 1. Fix StartScreen Props
let ssContent = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');
if (!ssContent.includes('onSwitchTheme?: () => void;')) {
  ssContent = ssContent.replace('onRemixProject: (projectData: Omit<Project, \'id\' | \'updatedAt\'> & { name: string }) => void;', 'onRemixProject: (projectData: Omit<Project, \'id\' | \'updatedAt\'> & { name: string }) => void;\n  onSwitchTheme?: () => void;');
  fs.writeFileSync('src/components/StartScreen.tsx', ssContent);
}

// 2. Fix App.tsx missing functions
let appContent = fs.readFileSync('src/App.tsx', 'utf-8');

const missingFuncs = `
  const handleUpdateClip = (id: string, updates: Partial<TimelineClip>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c), false);
  };

  const handleDuplicateClip = (id: string) => {
    const clipToDup = clips.find(c => c.id === id);
    if (!clipToDup) return;
    const newClip = {
      ...clipToDup,
      id: Math.random().toString(36).substring(7),
      startTime: clipToDup.startTime + (clipToDup.clipEndOffset - clipToDup.clipStartOffset)
    };
    setClips(prev => [...prev, newClip]);
  };
`;

const insertTarget = 'const handleSplitClip = () => {';
appContent = appContent.replace(insertTarget, missingFuncs + '\n  ' + insertTarget);
fs.writeFileSync('src/App.tsx', appContent);

// 3. Fix Timeline Props in NostalgiaEditor
let neContent = fs.readFileSync('src/components/NostalgiaEditor.tsx', 'utf-8');
neContent = neContent.replace('onTimeChange={props.setCurrentTime}', 'onTimeChange={(t) => props.setCurrentTime(t)}');
fs.writeFileSync('src/components/NostalgiaEditor.tsx', neContent);

console.log('Fixed errors');
