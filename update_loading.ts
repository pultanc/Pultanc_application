import * as fs from 'fs';

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `  if (authLoading) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-red-500/80 border-t-transparent animate-spin" />
          <span className="text-sm font-bold text-neutral-400 font-mono tracking-widest uppercase">Initializing Secure Platform...</span>
        </div>
      </div>
    );
  }`;

const replacement = `  if (authLoading) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <motion.div 
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.8,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
          }}
        >
          <Logo className="text-6xl text-red-500 drop-shadow-md" />
        </motion.div>
      </div>
    );
  }`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
