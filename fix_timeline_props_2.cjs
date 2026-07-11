const fs = require('fs');
let neContent = fs.readFileSync('src/components/NostalgiaEditor.tsx', 'utf-8');

neContent = neContent.replace('onTimeChange={(t) => props.setCurrentTime(t)}', 'onTimeUpdate={(t) => props.setCurrentTime(t)}');

// Also remove onSplitClip and onDuplicateClip if they are still there
neContent = neContent.replace('onSplitClip={props.onSplitClip}', '');
neContent = neContent.replace('onDuplicateClip={props.onDuplicateClip}', '');

fs.writeFileSync('src/components/NostalgiaEditor.tsx', neContent);
console.log('Fixed timeline props 2');
