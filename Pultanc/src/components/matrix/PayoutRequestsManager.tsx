import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Banknote, CheckCircle, Clock, Send, Smartphone, Landmark, FileSpreadsheet, 
  Download, Copy, Check, Search, Sparkles, Building2, Filter, AlertTriangle, 
  ShieldCheck, Calendar, Link, Share2, Eye, Coins, Wallet, Percent
} from 'lucide-react';

const GHANA_NAMES = [
  "Kwesi Mensah", "Abena Osei", "Yaw Addo", "Kofi Boateng", "Ama Serwaa",
  "Akua Danso", "Kwame Nkrumah", "Kojo Antwi", "Efia Odo", "Ebenezer Quaye",
  "Adwoa Mansa", "Akwasi Frimpong", "Naa Koshie", "Fiifi Pratt", "Sampson Appiah",
  "Esi Sutherland", "Kwabena Yeboah", "Akosua Agyapong", "Kwadwo Asamoah", "Gifty Anti",
  "Nana Aba Anamoah", "Bernard Avle", "Shatta Wale", "Stonebwoy", "Sarkodie",
  "John Dumelo", "Yvonne Nelson", "Joselyn Dumas", "Jackie Appiah", "Majid Michel"
];

const PROVIDERS = ['MTN', 'VOD', 'ATL'];

const BANK_CODES = [
  { name: 'GCB Bank', code: '040100' },
  { name: 'Ecobank Ghana', code: '130100' },
  { name: 'Absa Bank Ghana', code: '030100' },
  { name: 'Stanbic Bank', code: '090100' },
  { name: 'Fidelity Bank Ghana', code: '240100' },
  { name: 'CalBank', code: '140100' },
  { name: 'Standard Chartered Bank', code: '020100' },
  { name: 'Zenith Bank Ghana', code: '120100' },
  { name: 'Access Bank Ghana', code: '280100' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '180100' },
  { name: 'Consolidated Bank Ghana (CBG)', code: '340100' },
  { name: 'United Bank for Africa (UBA)', code: '060100' }
];

const PAST_MONTHS = ['May 2026', 'June 2026', 'July 2026', 'August 2026'];

// Sample gross monthly revenues
const GROSS_REVENUE_SAMPLES = [
  150.00, // < 200 (Ineligible if bonus claimed)
  250.00, // > 200 -> 70% = 175, minus 5 = 170 net payout
  180.00, // < 200 (Ineligible if bonus claimed)
  300.00, // > 200 -> 70% = 210, minus 5 = 205 net payout
  500.00, // > 200 -> 70% = 350, minus 5 = 345 net payout
  120.00, // < 200 (Ineligible)
  450.00, // > 200
  800.00, // > 200
  190.00, // < 200
  600.00, // > 200
  1000.00,
  350.00
];

export function PayoutRequestsManager() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Active View Tab: 'momo' | 'bank' | 'queue'
  const [activeTab, setActiveTab] = useState<'momo' | 'bank' | 'queue'>('momo');
  
  // Filters & State
  const [filterEligibility, setFilterEligibility] = useState<'all' | 'eligible' | 'ineligible'>('eligible');
  const [selectedMonth, setSelectedMonth] = useState<string>('June 2026'); // Filter by past month
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'payouts'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPayouts(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkProcessed = async (payout: any) => {
    if (!payout?.id || !payout?.creatorId) return;
    setProcessingId(payout.id);
    try {
      const payoutRef = doc(db, 'payouts', payout.id);
      await updateDoc(payoutRef, { status: 'processed' });

      // Mark bonus as deducted on user document
      const userRef = doc(db, 'users', payout.creatorId);
      await updateDoc(userRef, { bonusDeducted: true }).catch(() => {});

      const notifRef = collection(db, 'users', payout.creatorId, 'notifications');
      await addDoc(notifRef, {
        title: "Payout Completed! 💸",
        message: `Your requested payout of GHS ${payout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (70% net revenue share) has been processed and successfully deposited.`,
        timestamp: Date.now(),
        read: false,
        type: "payout"
      });

      alert(`Success! Payout marked as paid and alert notification sent to creator.`);
    } catch (error: any) {
      console.error(error);
      alert("Error processing payout: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Helper to compute 70% share, bonus status, 2x threshold eligibility & net payout
  const computePayoutDetails = (grossAmt: number, usedBonusHook: boolean) => {
    const revenue70 = grossAmt * 0.70;
    const isEligible = !usedBonusHook || grossAmt >= 200.00;
    const bonusDeduction = 0;
    const netPayout = isEligible ? revenue70 : 0;
    const paystackCentAmount = (netPayout * 100).toFixed(2);

    return {
      grossRevenue: grossAmt,
      revenue70,
      usedBonusHook,
      isEligible,
      bonusDeduction,
      netPayout,
      paystackCentAmount
    };
  };

  // Generate 100 Bulk MoMo Payout Items with Month tagging & csvlistnumber
  const bulkMomoItems = useMemo(() => {
    const items: any[] = [];
    
    // 1. Include real MoMo requests first
    payouts.forEach((p, idx) => {
      const rawGross = Number(p.grossRevenue) || (Number(p.amount) / 0.70) || 300.00;
      const usedBonus = p.hasBonusHook !== undefined ? p.hasBonusHook : (idx % 2 === 0);
      const calc = computePayoutDetails(rawGross, usedBonus);

      let prov = (p.providerNetwork || 'MTN').toUpperCase();
      if (prov.includes('VOD') || prov.includes('TELECEL') || prov.includes('VODAFONE')) prov = 'VOD';
      else if (prov.includes('AIRTEL') || prov.includes('TIGO') || prov.includes('ATL')) prov = 'ATL';
      else prov = 'MTN';

      const accountNum = p.paymentNumber || (prov === 'MTN' ? '0241112233' : prov === 'VOD' ? '0208889900' : '0275556677');
      const name = p.accountName || p.creatorName || "MoMo Holder";
      const refCode = `SALARY${String(idx + 1).padStart(3, '0')}`;
      const monthTag = p.month || PAST_MONTHS[idx % PAST_MONTHS.length];

      items.push({
        id: p.id || `real-${idx}`,
        month: monthTag,
        ...calc,
        rawAmount: calc.netPayout,
        amountFormatted: calc.paystackCentAmount,
        provider: prov,
        accountNumber: accountNum,
        name: name,
        reference: refCode,
        isReal: true
      });
    });

    // Real payouts only

    return items;
  }, [payouts]);

  // Generate 100 Bulk Bank Payout Items using standard BANK_CODES
  const bulkBankItems = useMemo(() => {
    const items: any[] = [];

    // 1. Include real Bank Transfer requests first
    payouts.forEach((p, idx) => {
      const rawGross = Number(p.grossRevenue) || (Number(p.amount) / 0.70) || 600.00;
      const usedBonus = p.hasBonusHook !== undefined ? p.hasBonusHook : (idx % 2 === 1);
      const calc = computePayoutDetails(rawGross, usedBonus);

      const bankNameInput = (p.bankName || 'GCB Bank').toLowerCase();
      let matchedObj = BANK_CODES[0];
      const matched = BANK_CODES.find(b => bankNameInput.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(bankNameInput));
      if (matched) matchedObj = matched;

      const accountNum = p.paymentNumber || `1001${String(234567890123 + idx)}`;
      const name = p.accountName || p.creatorName || "Bank Account Holder";
      const refCode = `VENDOR${String(idx + 1).padStart(3, '0')}`;
      const monthTag = p.month || PAST_MONTHS[idx % PAST_MONTHS.length];

      items.push({
        id: p.id || `real-bank-${idx}`,
        month: monthTag,
        ...calc,
        rawAmount: calc.netPayout,
        amountFormatted: calc.paystackCentAmount,
        bankCode: matchedObj.code,
        bankName: matchedObj.name,
        accountNumber: accountNum,
        name: name,
        reference: refCode,
        isReal: true
      });
    });

    // Real bank payouts only

    return items;
  }, [payouts]);

  // Active base items filtered by month & bank code
  const monthFilteredItems = useMemo(() => {
    const baseList = activeTab === 'momo' ? bulkMomoItems : bulkBankItems;
    
    return baseList.filter(item => {
      // Month Filter
      if (selectedMonth !== 'all' && item.month !== selectedMonth) return false;

      // Bank Code Filter (if bank mode)
      if (activeTab === 'bank' && selectedBankFilter !== 'all') {
        if (item.bankCode !== selectedBankFilter) return false;
      }

      return true;
    });
  }, [activeTab, bulkMomoItems, bulkBankItems, selectedMonth, selectedBankFilter]);

  // Apply Eligibility Filter and assign sequential `csvlistnumber`
  const currentItems = useMemo(() => {
    let list = monthFilteredItems;

    if (filterEligibility === 'eligible') {
      list = list.filter(item => item.isEligible);
    } else if (filterEligibility === 'ineligible') {
      list = list.filter(item => !item.isEligible);
    }

    // Attach 1-indexed sequential csvlistnumber (csvlistnumber 1, csvlistnumber 2, ...)
    return list.map((item, idx) => ({
      ...item,
      csvlistnumber: `csvlistnumber ${idx + 1}`,
      listNum: idx + 1
    }));
  }, [monthFilteredItems, filterEligibility]);

  // Construct CSV String including `csvlistnumber` and `Month`
  const csvString = useMemo(() => {
    if (activeTab === 'momo') {
      const header = "csvlistnumber,Month,Amount,Provider,Account Number,Name,Reference";
      const rows = currentItems.map(item => {
        const cleanName = item.name.replace(/,/g, '');
        return `${item.csvlistnumber},${item.month},${item.amountFormatted},${item.provider},${item.accountNumber},${cleanName},${item.reference}`;
      });
      return [header, ...rows].join('\n');
    } else {
      const header = "csvlistnumber,Month,Amount,Bank Code,Bank Name,Account Number,Name,Reference";
      const rows = currentItems.map(item => {
        const cleanName = item.name.replace(/,/g, '');
        const cleanBank = item.bankName.replace(/,/g, '');
        return `${item.csvlistnumber},${item.month},${item.amountFormatted},${item.bankCode},${cleanBank},${item.accountNumber},${cleanName},${item.reference}`;
      });
      return [header, ...rows].join('\n');
    }
  }, [activeTab, currentItems]);

  const handleCopyCsv = () => {
    navigator.clipboard.writeText(csvString);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  const handleCopyLink = () => {
    const linkUrl = `${window.location.origin}${window.location.pathname}?tab=${activeTab}&month=${encodeURIComponent(selectedMonth)}`;
    navigator.clipboard.writeText(linkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadCsv = () => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedMonth = selectedMonth.replace(/\s+/g, '_').toLowerCase();
    const filename = activeTab === 'momo' 
      ? `momo_payout_list_${sanitizedMonth}_csvlistnumber.csv` 
      : `bank_payout_list_${sanitizedMonth}_csvlistnumber.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return currentItems;
    const term = searchTerm.toLowerCase();
    return currentItems.filter((item: any) => 
      item.csvlistnumber.toLowerCase().includes(term) ||
      item.month.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      item.accountNumber.includes(term) ||
      (item.provider && item.provider.toLowerCase().includes(term)) ||
      (item.bankCode && item.bankCode.includes(term)) ||
      (item.bankName && item.bankName.toLowerCase().includes(term)) ||
      item.reference.toLowerCase().includes(term)
    );
  }, [currentItems, searchTerm]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 text-xs font-medium">Loading payout lists & queue...</p>
      </div>
    );
  }

  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const processedPayouts = payouts.filter(p => p.status === 'processed');

  const momoEligibleCount = bulkMomoItems.filter(i => i.isEligible && (selectedMonth === 'all' || i.month === selectedMonth)).length;
  const bankEligibleCount = bulkBankItems.filter(i => i.isEligible && (selectedMonth === 'all' || i.month === selectedMonth)).length;

  // Financial Summary Aggregation (Separated from Bulk CSV)
  const financialSummary = useMemo(() => {
    const momoItems = bulkMomoItems.filter(i => selectedMonth === 'all' || i.month === selectedMonth);
    const bankItems = bulkBankItems.filter(i => selectedMonth === 'all' || i.month === selectedMonth);
    const allItems = [...momoItems, ...bankItems];

    const totalGross = allItems.reduce((acc, curr) => acc + (Number(curr.grossRevenue) || 0), 0);
    const creatorsNet = allItems.reduce((acc, curr) => acc + (Number(curr.revenue70) || (Number(curr.grossRevenue) * 0.70) || 0), 0);
    const platformFee = totalGross - creatorsNet;

    return {
      totalGross,
      creatorsNet,
      platformFee,
      totalCreatorAccounts: allItems.length,
      momoCount: momoItems.length,
      bankCount: bankItems.length
    };
  }, [bulkMomoItems, bulkBankItems, selectedMonth]);

  return (
    <div className="space-y-6">
      
      {/* DEDICATED FINANCIAL OVERVIEW CARD (Separated from Bulk CSV) */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Tuita Financial Ledger
              </span>
              <span className="text-xs text-gray-400 font-mono">Autonomous 70/30 Revenue Split</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              Total Creators' Monthly Earnings & Platform Fee Breakdown
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Financial overview for <span className="text-emerald-400 font-bold font-mono">{selectedMonth === 'all' ? 'All Past Months Combined' : selectedMonth}</span> across registered creator accounts.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl border border-white/10 shrink-0">
            <Calendar className="w-4 h-4 text-emerald-400 ml-1" />
            <span className="text-xs font-bold text-gray-300 font-mono uppercase text-[11px]">Filter Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              <option value="all">All Past Months</option>
              {PAST_MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3 Prominent Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* 1. Total Creators Gross Revenue */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Total Creator Gross Revenue
              </span>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold font-mono text-white tracking-tight">
              GHS {financialSummary.totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-emerald-400 font-bold">100% Gross Revenue</span> generated across {financialSummary.totalCreatorAccounts} creator accounts
            </p>
          </div>

          {/* 2. Total Creators Net Earnings (70%) */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-400">
                Creators' Net Earnings (70%)
              </span>
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold font-mono text-white tracking-tight">
              GHS {financialSummary.creatorsNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-blue-400 font-bold">70% Net Share</span> accumulated for creator withdrawals
            </p>
          </div>

          {/* 3. Platform Fee Total (30%) */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                Platform Fee Total (30%)
              </span>
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold font-mono text-white tracking-tight">
              GHS {financialSummary.platformFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-amber-400 font-bold">30% Platform Fee</span> retained by Tuita Nouvelle Ltd
            </p>
          </div>

        </div>
      </div>
      
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('momo')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'momo' 
              ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-400/50' 
              : 'bg-white text-gray-900 border-gray-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
              activeTab === 'momo' ? 'text-white' : 'text-gray-500'
            }`}>
              <Smartphone className="w-4 h-4" /> MoMo List ({selectedMonth})
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
              activeTab === 'momo' ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'
            }`}>
              Numbered
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono">{momoEligibleCount}</span>
            <span className={`text-xs font-medium ${activeTab === 'momo' ? 'text-white/90' : 'text-gray-500'}`}>Eligible Accounts</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('bank')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'bank' 
              ? 'bg-gray-900 text-white border-gray-950 shadow-md ring-2 ring-emerald-500/50' 
              : 'bg-white text-gray-900 border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
              activeTab === 'bank' ? 'text-emerald-400' : 'text-gray-500'
            }`}>
              <Building2 className="w-4 h-4" /> Bank List ({selectedMonth})
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
              activeTab === 'bank' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-100 text-gray-700'
            }`}>
              12 Banks
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono">{bankEligibleCount}</span>
            <span className={`text-xs font-medium ${activeTab === 'bank' ? 'text-gray-300' : 'text-gray-500'}`}>Eligible Accounts</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('queue')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'queue' 
              ? 'bg-amber-500 text-white border-amber-600 shadow-md' 
              : 'bg-white text-gray-900 border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
              activeTab === 'queue' ? 'text-white' : 'text-amber-700'
            }`}>
              <Clock className="w-4 h-4" /> Pending Queue
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
              activeTab === 'queue' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              Realtime
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono">{pendingPayouts.length}</span>
            <span className={`text-xs font-medium ${activeTab === 'queue' ? 'text-white/90' : 'text-gray-500'}`}>Requests</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider block">Disbursed Total</span>
            <span className="text-xl font-bold text-gray-900 mt-1 block">{processedPayouts.length} Paid</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle className="w-5 h-5"/>
          </div>
        </div>
      </div>

      {/* Primary Tab Navigation & Action Bar directly on view */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Main Header Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('momo')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'momo' 
                  ? 'bg-red-500 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Mobile Money Payout List
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                Numbered
              </span>
            </button>

            <button
              onClick={() => setActiveTab('bank')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'bank' 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              Bank Transfer Payout List
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                12 Banks
              </span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'queue' 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              Pending Queue & Approvals ({pendingPayouts.length})
            </button>
          </div>

          {/* Direct Download & Copy Actions directly on Page Header */}
          {activeTab !== 'queue' && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Copy Shareable Link */}
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  copiedLink ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5 text-gray-600" />}
                {copiedLink ? 'Link Copied!' : 'Copy List Link'}
              </button>

              {/* Copy CSV Text */}
              <button
                onClick={handleCopyCsv}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  copiedCsv ? 'bg-emerald-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                {copiedCsv ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                {copiedCsv ? 'CSV Copied!' : 'Copy CSV List'}
              </button>

              {/* Download CSV Direct Button */}
              <button
                onClick={handleDownloadCsv}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm text-white cursor-pointer active:scale-95 ${
                  activeTab === 'momo' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
            </div>
          )}
        </div>

        {/* LIST VIEWS (Mobile Money & Bank Transfer) */}
        {activeTab !== 'queue' && (
          <div className="space-y-6">
            
            {/* Filter Toolbar directly on page */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                {/* Month Dropdown Selector for History */}
                <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase font-mono">Month:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-xs font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all">All Past Months</option>
                    {PAST_MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Bank Filter (if Bank Tab) */}
                {activeTab === 'bank' && (
                  <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-xs">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase font-mono">Bank:</span>
                    <select
                      value={selectedBankFilter}
                      onChange={(e) => setSelectedBankFilter(e.target.value)}
                      className="text-xs font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="all">All 12 Banks</option>
                      {BANK_CODES.map(b => (
                        <option key={b.code} value={b.code}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Eligibility Pill Filter */}
                <div className="flex items-center gap-1 bg-gray-200/80 p-1 rounded-xl">
                  <button
                    onClick={() => setFilterEligibility('eligible')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      filterEligibility === 'eligible' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Eligible ({activeTab === 'momo' ? momoEligibleCount : bankEligibleCount})
                  </button>
                  <button
                    onClick={() => setFilterEligibility('ineligible')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      filterEligibility === 'ineligible' ? 'bg-white text-red-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Ineligible
                  </button>
                  <button
                    onClick={() => setFilterEligibility('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      filterEligibility === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Search input & raw string toggle */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="relative w-full md:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search csvlistnumber, name, bank..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-gray-900 font-medium text-gray-900 shadow-xs"
                  />
                </div>

                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-gray-500" />
                  {showRawText ? 'Hide Raw CSV' : 'Show Raw CSV'}
                </button>
              </div>

            </div>

            {/* Information Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div>
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-600" /> Sequential <code className="bg-amber-200/80 px-1 rounded font-mono font-bold">csvlistnumber</code> & Month Historical List:
                </p>
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] text-amber-900 font-medium">
                  <li><strong>Numbered Format:</strong> Every row is prefixed with <code className="bg-amber-100 px-1 rounded font-mono font-bold">csvlistnumber 1</code>, <code className="bg-amber-100 px-1 rounded font-mono font-bold">csvlistnumber 2</code>, etc.</li>
                  <li><strong>Month Tagging:</strong> Selected month: <strong className="font-bold text-amber-950">{selectedMonth}</strong>. Past month history is retained intact.</li>
                  <li><strong>12 Partner Banks Included:</strong> GCB, Ecobank, Absa, Stanbic, Fidelity, CalBank, Standard Chartered, Zenith, Access, GTBank, CBG, UBA.</li>
                </ul>
              </div>
              <div className="text-right text-[11px] font-medium text-amber-800 shrink-0 bg-white/70 p-2.5 rounded-xl border border-amber-200">
                Visible Records: <strong className="font-bold text-amber-950">{filteredItems.length}</strong>
              </div>
            </div>

            {/* Full List Table rendered directly on page */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-900 text-white sticky top-0 font-mono text-[10px] uppercase border-b border-gray-800 tracking-wider">
                    <tr>
                      <th className="p-3">csvlistnumber</th>
                      <th className="p-3">Month</th>
                      <th className="p-3">Gross</th>
                      <th className="p-3">70% Net Share</th>
                      <th className="p-3">Net Payout (x100)</th>
                      <th className="p-3">{activeTab === 'momo' ? 'Provider' : 'Bank Name'}</th>
                      <th className="p-3">Account Number</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-gray-800">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-gray-400 font-sans">
                          No records found matching month ({selectedMonth}) and search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item: any) => (
                        <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.isEligible ? 'bg-red-50/20' : ''}`}>
                          <td className="p-3 font-bold text-red-600 bg-gray-50/80">{item.csvlistnumber}</td>
                          <td className="p-3 font-bold text-gray-900 font-sans">{item.month}</td>
                          <td className="p-3 text-gray-600 font-mono">GHS {item.grossRevenue.toFixed(2)}</td>
                          <td className="p-3 text-gray-700 font-mono">GHS {item.revenue70.toFixed(2)}</td>
                          <td className="p-3 font-bold text-emerald-700 bg-emerald-50/30">
                            {item.isEligible ? item.amountFormatted : '0.00'}
                          </td>
                          <td className="p-3 font-bold">
                            {activeTab === 'momo' ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                item.provider === 'MTN' ? 'bg-amber-100 text-amber-800' :
                                item.provider === 'VOD' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {item.provider}
                              </span>
                            ) : (
                              <span className="font-sans text-xs font-bold text-gray-900 block truncate max-w-[160px]">
                                {item.bankName}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-gray-900">{item.accountNumber}</td>
                          <td className="p-3 font-sans font-bold text-gray-900">{item.name}</td>
                          <td className="p-3 font-sans">
                            {item.isEligible ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Eligible
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Needs 2x Revenue
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Optional Raw Text Area */}
            {showRawText && (
              <div className="space-y-2 pt-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Raw CSV Output String with <code className="text-red-600">csvlistnumber</code> ({selectedMonth})</span>
                  <button
                    onClick={handleCopyCsv}
                    className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Raw Text
                  </button>
                </div>
                <textarea
                  readOnly
                  value={csvString}
                  rows={6}
                  className="w-full font-mono text-[11px] p-3 bg-gray-900 text-emerald-400 rounded-2xl border border-gray-800 focus:outline-none selection:bg-red-500 selection:text-white leading-relaxed"
                />
              </div>
            )}

          </div>
        )}

        {/* PENDING QUEUE VIEW */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">
                Pending Creator Payout Requests Queue
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Incoming payout requests submitted directly from user wallets.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {payouts.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-3"/>
                  <p className="text-xs font-bold text-gray-700">No payout requests in queue</p>
                  <p className="text-xs text-gray-450 mt-1">When creators request payouts in their wallet, requests appear here instantly.</p>
                </div>
              ) : (
                payouts.map((p, idx) => {
                  const isPending = p.status === 'pending';
                  const isMoMo = p.paymentType === 'Mobile Money';

                  return (
                    <div key={p.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50/50 transition-colors rounded-2xl">
                      <div className="space-y-2 max-w-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-900 text-amber-400 font-mono">
                            csvlistnumber {idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                            isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {p.status}
                          </span>
                          {p.month && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider font-mono">
                              {p.month}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-gray-950 text-xs leading-tight">
                          {p.creatorName || "Anonymous Creator"}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono">{p.creatorEmail || "no-email@partner.com"}</p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-bold font-mono">
                          {isMoMo ? <Smartphone className="w-3.5 h-3.5 text-emerald-600"/> : <Landmark className="w-3.5 h-3.5 text-blue-600"/>}
                          <span>{p.paymentType || "Mobile Money"}</span>
                        </div>
                        {p.accountName && (
                          <div className="text-xs font-bold text-gray-900">
                            {p.accountName}
                          </div>
                        )}
                        <div className="font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200/60 rounded px-2.5 py-1 w-fit font-bold">
                          {p.paymentNumber || "+233 54 111 0000"}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <div className="text-right">
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">70% Net Disbursed</span>
                          <span className="text-xs font-bold text-gray-950 font-mono">GHS {p.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {isPending ? (
                          <button
                            onClick={() => handleMarkProcessed(p)}
                            disabled={processingId === p.id}
                            className="bg-red-500 hover:bg-red-400 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm cursor-pointer"
                          >
                            {processingId === p.id ? (
                              <span className="animate-pulse">Paying...</span>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5"/>
                                Pay Out & Alert Account 💸
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="bg-gray-50 text-gray-600 rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap border border-gray-200">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600"/>
                            Manually Deposited
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
