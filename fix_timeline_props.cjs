const fs = require('fs');
let content = fs.readFileSync('src/components/NostalgiaEditor.tsx', 'utf-8');

content = content.replace(
`        <Timeline 
          clips={props.clips}
          currentTime={props.currentTime}
          duration={props.duration}
          onTimeChange={(t) => props.setCurrentTime(t)}
          selectedClipId={props.selectedClipId}
          onSelectClip={props.setSelectedClipId}
          onUpdateClip={props.onUpdateClip}
          onDeleteClip={props.onDeleteClip}
          onSplitClip={props.onSplitClip}
          onDuplicateClip={props.onDuplicateClip}
        />`, 
`        <Timeline 
          clips={props.clips}
          currentTime={props.currentTime}
          duration={props.duration}
          onTimeUpdate={(t) => props.setCurrentTime(t)}
          selectedClipId={props.selectedClipId}
          onSelectClip={props.setSelectedClipId}
          onUpdateClip={props.onUpdateClip}
          onRemoveClip={props.onDeleteClip}
          onAddClip={() => {}}
        />`);

fs.writeFileSync('src/components/NostalgiaEditor.tsx', content);
console.log('Fixed timeline props');
