import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { auth } from "../../firebase";
import { Bell, Trash2, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const Notifications = () => {
 
 const [notifications, setNotifications] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!auth.currentUser) return;
 
 const notifRef = collection(db, 'users', auth.currentUser.uid, 'notifications');
 const q = query(notifRef, orderBy('timestamp', 'desc'));
 
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setNotifications(notifs);
 setLoading(false);
 });

 return () => unsubscribe();
 }, [auth.currentUser]);

 const handleDelete = async (e: React.MouseEvent, id: string) => {
 e.stopPropagation();
 if (!auth.currentUser) return;
 try {
 await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', id));
 } catch (err) {
 console.error('Failed to delete notification:', err);
 }
 };

 const handleMarkAsRead = async (id: string, read: boolean) => {
 if (!auth.currentUser || read) return;
 try {
 await updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', id), { read: true });
 } catch (err) {
 console.error('Failed to mark as read:', err);
 }
 };

 if (!auth.currentUser) {
 return <div className="p-8 text-center text-gray-500">Please sign in to view notifications.</div>;
 }

 return (
 <div className="w-full h-full bg-white lg:p-8 overflow-y-auto">
 <div className="max-w-3xl mx-auto">
 <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
 <Bell className="w-6 h-6 text-red-500"/> Notifications
 </h2>

 {loading ? (
 <div className="text-center py-12 text-gray-500 animate-pulse">Loading...</div>
 ) : notifications.length === 0 ? (
 <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
 <Bell className="w-10 h-10 text-gray-400 mx-auto mb-2"/>
 <p className="text-sm font-medium text-gray-700">No notifications yet</p>
 </div>
 ) : (
 <div className="space-y-3">
 {notifications.map((notif) => (
 <div 
 key={notif.id}
 onClick={() => handleMarkAsRead(notif.id, notif.read)}
 className={`p-4 rounded-xl border flex items-start gap-4 transition-colors cursor-pointer ${notif.read ? 'bg-white border-gray-100' : 'bg-red-50/30 border-red-100'}`}
 >
 <div className={`mt-1 shrink-0 ${notif.read ? 'text-gray-400' : 'text-red-500'}`}>
 {notif.read ? <CheckCircle className="w-5 h-5"/> : <Bell className="w-5 h-5"/>}
 </div>
 <div className="flex-1">
 <h4 className={`text-sm font-bold ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</h4>
 <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{notif.text}</p>
 <p className="text-[10px] text-gray-400 mt-2 font-mono">
 {notif.timestamp ? formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true }) : 'Just now'}
 </p>
 </div>
 <button 
 onClick={(e) => handleDelete(e, notif.id)}
 className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full transition-colors shrink-0"
 title="Delete notification"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
};
