const fs = require('fs');
let content = fs.readFileSync('src/components/matrix/SocialShareStudio.tsx', 'utf8');

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

content = content.replace(
  'Click the download button to export the ultra-sharp native PNG\n          </div>\n        </div>\n      </div>',
  'Click the download button to export the ultra-sharp native PNG\n          </div>\n        </div>\n' + copyLinkBlock + '\n      </div>'
);

if (!content.includes('import { Copy')) {
    content = content.replace('import {', 'import { Copy,');
}

fs.writeFileSync('src/components/matrix/SocialShareStudio.tsx', content);
