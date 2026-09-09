const fs = require('fs');

let content = fs.readFileSync('src/components/wallet/WalletView.tsx', 'utf8');

// I need to find the specific block and close it.
const search = `className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:border-gray-900"
 />
 </div>
 </div>
 )}`;

const replace = `className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:border-gray-900"
 />
 </div>
 </div>
 </div>
 )}`;

content = content.replace(search, replace);

// Let's also check if there's any other syntax errors.
// "src/components/wallet/WalletView.tsx(745,3): error TS1381: Unexpected token. Did you mean `{'}'}` or `&rbrace;`?"
// It seems `)}` around line 745 is also broken because of my payout history regex.
// Let's print around 745.
fs.writeFileSync('src/components/wallet/WalletView.tsx', content);

