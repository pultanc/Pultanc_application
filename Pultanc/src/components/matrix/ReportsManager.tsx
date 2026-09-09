import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ShieldAlert, Trash2, CheckCircle2, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ReportsManager() {
 const [reports, setReports] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 const reportsRef = collection(db, 'reports');
 const q = query(reportsRef, orderBy('timestamp', 'desc'));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setReports(data);
 setIsLoading(false);
 }, (error) => {
 handleFirestoreError(error, OperationType.GET, 'reports');
 setIsLoading(false);
 });

 return () => unsubscribe();
 }, []);

 const handleDismissReport = async (reportId: string) => {
 try {
 await deleteDoc(doc(db, 'reports', reportId));
 } catch (err) {
 console.error("Error dismissing report:", err);
 }
 };

 const handleBanContent = async (report: any) => {
 try {
 // We don't know the collection exactly, let's try 'series' first, then 'funnels', then 'users'
 const collectionsToTry = ['series', 'funnels', 'users'];
 let found = false;
 for (const col of collectionsToTry) {
 const ref = doc(db, col, report.contentId);
 const docSnap = await getDoc(ref);
 if (docSnap.exists()) {
 await updateDoc(ref, { status: 'banned' });
 found = true;
 alert(`Content banned in ${col}`);
 break;
 }
 }
 if (!found) {
 alert("Content not found to ban.");
 }
 await deleteDoc(doc(db, 'reports', report.id));
 } catch (err) {
 console.error("Error banning content:", err);
 }
 };
 
 const handleDeleteUser = async (report: any) => {
 const targetUserId = report.reporterId; // Wait, we want to delete the reported user, not the reporter!
 // But report doesn't contain the creatorId of the content unless we fetch it.
 try {
 const collectionsToTry = ['series', 'funnels', 'users'];
 let reportedUserId = '';
 for (const col of collectionsToTry) {
 const ref = doc(db, col, report.contentId);
 const docSnap = await getDoc(ref);
 if (docSnap.exists()) {
 const data = docSnap.data();
 reportedUserId = col === 'users' ? docSnap.id : (data.creatorId || data.userId || '');
 break;
 }
 }
 if (!reportedUserId) {
 alert("Could not identify the user to delete.");
 return;
 }
 if (confirm(`Are you sure you want to delete user ${reportedUserId} and their content?`)) {
 // Note: Cloud Functions should ideally delete the Auth user. We can only delete the user doc.
 await updateDoc(doc(db, 'users', reportedUserId), { status: 'banned' }).catch(() => {});
 alert("User document banned. To fully delete user authentication, Cloud Function action is required.");
 await deleteDoc(doc(db, 'reports', report.id));
 }
 } catch (e) {
 console.error(e);
 }
 };

 if (isLoading) {
 return <div className="text-gray-500 text-xs">Loading reports...</div>;
 }

 return (
 <div className="space-y-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-gray-900">
 <h3 className="font-bold text-gray-900 flex items-center gap-2.5 mb-4">
 <div className="w-8 h-8 rounded-xl bg-white border border-red-200 shadow-xs flex items-center justify-center">
 <ShieldAlert className="w-4 h-4 text-red-600"/>
 </div>
 Reported Content
 </h3>

 {reports.length === 0 ? (
 <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-xs">
 <div className="w-12 h-12 rounded-full bg-white border border-red-200 shadow-xs flex items-center justify-center mx-auto mb-3">
 <CheckCircle2 className="w-6 h-6 text-red-500"/>
 </div>
 <p className="text-xs font-bold text-gray-900">All Clear</p>
 <p className="text-xs text-gray-500 mt-1">No pending reports to review.</p>
 </div>
 ) : (
 <div className="space-y-3">
 <AnimatePresence>
 {reports.map(report => (
 <motion.div 
 key={report.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 className="bg-white border border-gray-200 shadow-xs rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
 >
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-0.5 rounded">
 {report.reason || 'Reported'}
 </span>
 <span className="text-[10px] text-gray-400 font-mono">
 {report.timestamp ? new Date(report.timestamp.toDate ? report.timestamp.toDate() : report.timestamp).toLocaleString() : ''}
 </span>
 </div>
 <p className="text-xs font-medium text-gray-900 mb-1">
 Content ID: <span className="font-mono text-gray-500">{report.contentId}</span>
 </p>
 {report.details && (
 <p className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-200">
"{report.details}"
 </p>
 )}
 <p className="text-[10px] text-gray-400 mt-2">
 Reported by: <span className="font-mono">{report.reporterId}</span>
 </p>
 </div>

 <div className="flex flex-row md:flex-col gap-2 shrink-0">
 <button 
 onClick={() => handleBanContent(report)}
 className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
 >
 <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-2xs border border-red-200">
 <ShieldAlert className="w-2.5 h-2.5 text-red-600"/>
 </div>
 Ban Content
 </button>
 <button 
 onClick={() => handleDeleteUser(report)}
 className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
 >
 <UserX className="w-3.5 h-3.5"/>
 Ban User
 </button>
 <button 
 onClick={() => handleDismissReport(report.id)}
 className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 Dismiss Report
 </button>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 )}
 </div>
 );
}
