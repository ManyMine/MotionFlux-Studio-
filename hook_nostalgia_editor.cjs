const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const importTarget = `import { NostalgiaStartScreen } from './components/NostalgiaStartScreen';`;
content = content.replace(importTarget, importTarget + `\nimport { NostalgiaEditor } from './components/NostalgiaEditor';`);

const renderTarget = `return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-100 font-sans overflow-hidden selection:bg-indigo-500/30">`;
const renderTargetWithTheme = `
  if (theme === 'nostalgia') {
    return (
      <NostalgiaEditor
        clips={clips}
        currentTime={currentTime}
        isPlaying={isPlaying}
        duration={duration}
        selectedClipId={selectedClipId}
        settings={settings}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onStop={() => setIsPlaying(false)}
        setCurrentTime={setCurrentTime}
        setSelectedClipId={setSelectedClipId}
        onUpdateClip={handleUpdateClip}
        onAddMedia={handleAddMedia}
        onDeleteClip={handleDeleteClip}
        onSplitClip={handleSplitClip}
        onDuplicateClip={handleDuplicateClip}
        onClose={() => setCurrentProjectId(null)}
        onExport={() => setIsExporting(true)}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-100 font-sans overflow-hidden selection:bg-indigo-500/30">`;

content = content.replace(renderTarget, renderTargetWithTheme);
fs.writeFileSync('src/App.tsx', content);
console.log('Hooked Nostalgia Editor');
