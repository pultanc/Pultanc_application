const fs = require('fs');

let content = fs.readFileSync('src/components/matrix/SocialShareStudio.tsx', 'utf8');

// Cash reward text
content = content.replace(
  "{ id: 'bonus', label: 'Cash Reward', desc: 'GHS 10.00 signup bonus' },",
  "{ id: 'bonus', label: 'Cash Reward', desc: '100 GHS signup bonus (once)' },"
);

// Right column class
content = content.replace(
  '<div className="lg:col-span-7 flex flex-col items-center justify-center">',
  '<div className="lg:col-span-7 flex flex-col items-center justify-start pt-0 space-y-6">'
);

// Wrapper max width
content = content.replace(
  '<div className="relative w-full max-w-sm overflow-hidden bg-zinc-950 rounded-3xl border-4 border-zinc-900 flex items-center justify-center p-2.5 group">',
  '<div className="relative w-full max-w-[280px] overflow-hidden bg-zinc-950 rounded-3xl border-4 border-zinc-900 flex items-center justify-center p-2.5 group">'
);

// Add the copy link button after the wrapper
const copyLinkBlock = `</div>

          {/* Separate Copy Link Section */}
          <div className="w-full max-w-[280px] bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 mt-4">
            <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider">Shareable Link</span>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={\`https://\${referralUrl}\`} 
                className="flex-1 bg-transparent border-none outline-none text-xs text-gray-700 dark:text-zinc-300 truncate"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(\`https://\${referralUrl}\`);
                  toast.success('Link copied to clipboard!');
                }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-md transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white"
                title="Copy Link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
`;

content = content.replace('</div>\n        </div>\n      </div>\n    </div>\n  );\n}', copyLinkBlock + '        </div>\n      </div>\n    </div>\n  );\n}');

// Let's add Copy import to SocialShareStudio if it doesn't exist
if (!content.includes('Copy')) {
    content = content.replace('import { ', 'import { Copy, ');
}

// Ensure toast is imported
if (!content.includes('import { toast }')) {
    content = content.replace('import React', "import { toast } from 'sonner';\nimport React");
}

fs.writeFileSync('src/components/matrix/SocialShareStudio.tsx', content);
