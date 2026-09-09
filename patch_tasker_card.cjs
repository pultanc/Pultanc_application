const fs = require('fs');
let content = fs.readFileSync('src/components/matrix/TaskerCardStudio.tsx', 'utf8');

// Right column class
content = content.replace(
  '<div className="lg:col-span-7 flex flex-col items-center">',
  '<div className="lg:col-span-7 flex flex-col items-center justify-start pt-0">'
);

// Wrapper max width
content = content.replace(
  '<div className="relative w-full max-w-sm overflow-hidden bg-zinc-950 rounded-3xl border-4 border-zinc-900 flex items-center justify-center">',
  '<div className="relative w-full max-w-[280px] overflow-hidden bg-zinc-950 rounded-3xl border-4 border-zinc-900 flex items-center justify-center">'
);

// We need to add the copy link section here too.
// Let's find where the wrapper ends.
// In TaskerCardStudio, it might be right after the `<canvas className="hidden" />` or something. Let's see the end of the file.
