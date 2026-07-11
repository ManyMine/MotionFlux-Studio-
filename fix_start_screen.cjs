const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const importIdx = content.indexOf(`import { StartScreen, Project } from './components/StartScreen';`);
content = content.replace(`import { StartScreen, Project } from './components/StartScreen';`, `import { StartScreen, Project } from './components/StartScreen';\nimport { NostalgiaStartScreen } from './components/NostalgiaStartScreen';`);

const startRenderIdx = content.indexOf('if (currentProjectId === null) {');
const endRenderIdx = content.indexOf('return (', startRenderIdx + 100);

const newStartRender = `
  if (currentProjectId === null) {
    if (theme === 'nostalgia') {
      return (
        <NostalgiaStartScreen 
          onCreateProject={() => handleCreateProject('Projeto Novo', '16/9')}
          onSwitchTheme={handleSwitchTheme}
        />
      );
    }

    return (
      <StartScreen
        userSession={userSession}
        setUserSession={setUserSession}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onCreateProject={handleCreateProject}
        onRemixProject={handleRemixProject}
        onSwitchTheme={handleSwitchTheme}
      />
    );
  }
`;

// wait, I need to replace the exact block. Let's do it with replace.
const oldStartRender = `if (currentProjectId === null) {
    return (
      <StartScreen
        userSession={userSession}
        setUserSession={setUserSession}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onCreateProject={handleCreateProject}
        onRemixProject={handleRemixProject}
      />
    );
  }`;

content = content.replace(oldStartRender, newStartRender);
fs.writeFileSync('src/App.tsx', content);
console.log('Fixed start screen rendering');
