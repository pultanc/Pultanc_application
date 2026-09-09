import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, where, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';

export function VerificationRequests() {
 const [requests, setRequests] = useState<any[]>([]);

 useEffect(() => {
 const q = query(collection(db, 'verifications'), where('status', '==', 'pending'));
 const unsub = onSnapshot(q, (snapshot) => {
 const docs = snapshot.docs.map(d => ({
 id: d.id,
 ...d.data()
 }));
 setRequests(docs);
 }, (error) => {
 console.error(error);
 });

 return unsub;
 }, []);

 const handleApprove = async (id: string) => {
 try {
 await updateDoc(doc(db, 'verifications', id), {
 status: 'approved',
 processedAt: new Date().toISOString()
 });

 // Add account notification/alert to the user's notifications collection
 const notifRef = collection(db, 'users', id, 'notifications');
 await addDoc(notifRef, {
 title:"ID Verification Approved! 🎉",
 text:"Congratulations! Your account verification request has been successfully reviewed and approved.",
 timestamp: Date.now(),
 read: false,
 type:"verification"
 });
 } catch (error) {
 handleFirestoreError(error, OperationType.UPDATE, `verifications/${id}`);
 }
 };

 const handleReject = async (id: string) => {
 try {
 await updateDoc(doc(db, 'verifications', id), {
 status: 'rejected',
 processedAt: new Date().toISOString()
 });

 // Add account notification/alert to the user's notifications collection
 const notifRef = collection(db, 'users', id, 'notifications');
 await addDoc(notifRef, {
 title:"ID Verification Rejected ⚠️",
 message:"Your account verification request was not approved. Please review your submitted document details and try again.",
 timestamp: Date.now(),
 read: false,
 type:"verification"
 });
 } catch (error) {
 handleFirestoreError(error, OperationType.UPDATE, `verifications/${id}`);
 }
 };

 return (
 <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
 <div className="flex items-center gap-2 mb-6">
 <ShieldCheck className="w-5 h-5 text-red-500"/>
 <h3 className="text-xl font-bold text-gray-900 dark:text-white">ID Verification Requests</h3>
 {requests.length > 0 && (
 <span className="bg-red-500/10 text-red-600 px-2 flex items-center justify-center py-0.5 rounded-full text-xs font-bold">
 {requests.length} New
 </span>
 )}
 </div>

 <div className="space-y-4">
 {requests.length === 0 ? (
 <div className="text-center py-8 text-gray-500 text-xs">
 No pending verification requests.
 </div>
 ) : (
 requests.map(req => (
 <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 gap-4">
 <div className="flex gap-4">
 {req.documentUrl && (
 <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shrink-0">
 <img src={req.documentUrl} alt="ID Document"className="w-full h-full object-cover"/>
 </div>
 )}
 <div>
 <div className="font-bold text-gray-900 dark:text-white">{req.name}</div>
 <div className="text-xs text-gray-500">{req.email}</div>
 <div className="text-xs text-gray-400 mt-1">Submitted: {new Date(req.timestamp).toLocaleString()}</div>
 </div>
 </div>
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <button 
 onClick={() => handleApprove(req.id)}
 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
 >
 <CheckCircle className="w-4 h-4"/> Approve
 </button>
 <button 
 onClick={() => handleReject(req.id)}
 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border border-red-200"
 >
 <XCircle className="w-4 h-4"/> Reject
 </button>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 );
}
