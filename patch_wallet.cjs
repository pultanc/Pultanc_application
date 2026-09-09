const fs = require('fs');

let content = fs.readFileSync('src/components/wallet/WalletView.tsx', 'utf8');

// 1. Withdrawal History -> Payout History and remove Export CSV
content = content.replace(
  /<h2 className="text-xl font-bold text-gray-900">Withdrawal History<\/h2>\s*<button onClick=\{\(\) => \{\}\} disabled=\{history\.length === 0\} className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1\.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">\s*<Download className="w-4 h-4" \/>\s*Export CSV\s*<\/button>/g,
  '<h2 className="text-xl font-bold text-gray-900">Payout History</h2>'
);

// 2. Add accountName to state
if (!content.includes('const [accountName, setAccountName]')) {
    content = content.replace('const [bankName, setBankName]', 'const [accountName, setAccountName] = useState(\'\');\n  const [bankName, setBankName]');
}

// 3. Add account name input for Bank Transfer
const bankTransferInputs = `{paymentType === 'Bank Transfer' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Account Name</label>
                  <input 
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-medium text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Bank Name</label>
                    <input 
                      type="text"`;

content = content.replace(
  /\{paymentType === 'Bank Transfer' && \(\s*<div className="flex gap-4">\s*<div className="flex-1">\s*<label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Bank Name<\/label>\s*<input \s*type="text"/g,
  bankTransferInputs
);

// Close the extra div for the space-y-4 wrapper added around bank inputs
content = content.replace(
  /className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1\.5 font-mono text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"\s*\/>\s*<\/div>\s*<\/div>\s*\)\}/g,
  'className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"\n                    />\n                  </div>\n                </div>\n              </div>\n            )}'
);

// 4. Update the Bank Details summary
content = content.replace(
  /\{paymentType === 'Bank Transfer' && \(bankName \|\| branchName\) && \(\s*<div className="space-y-1 bg-white p-3\.5 rounded-xl border border-gray-200">\s*<p className="text-\[10px\] text-gray-400 font-bold uppercase tracking-widest">Bank Details<\/p>\s*\{bankName && <p className="text-xs text-gray-700">Bank: \{bankName\}<\/p>\}\s*\{branchName && <p className="text-xs text-gray-500">Branch: \{branchName\}<\/p>\}\s*<\/div>\s*\)\}/g,
  `{paymentType === 'Bank Transfer' && (bankName || branchName || accountName) && (
                  <div className="space-y-1 bg-white p-3.5 rounded-xl border border-gray-200">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Bank Details</p>
                    {accountName && <p className="text-xs text-gray-700">Name: {accountName}</p>}
                    {bankName && <p className="text-xs text-gray-700">Bank: {bankName}</p>}
                    {branchName && <p className="text-xs text-gray-500">Branch: {branchName}</p>}
                  </div>
                )}`
);

fs.writeFileSync('src/components/wallet/WalletView.tsx', content);

