import React, { useState } from 'react';
import { X, Upload, AlertCircle, FileImage } from 'lucide-react';
import { db, storage, auth } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { optimizeMediaImage } from '../../utils/mediaOptimizer';



interface IDSubmissionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSuccess: () => void;
 userName: string;
}

export const IDSubmissionModal: React.FC<IDSubmissionModalProps> = ({ isOpen, onClose, onSuccess, userName }) => {
 
 
 const [imageBlob, setImageBlob] = useState<Blob | null>(null);
 const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
 const [uploading, setUploading] = useState(false);
 const [error, setError] = useState('');

 const resetState = () => {
 setImageBlob(null);
 if (imagePreviewUrl) {
 URL.revokeObjectURL(imagePreviewUrl);
 setImagePreviewUrl(null);
 }
 setError('');
 };

 const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files[0]) {
 const file = e.target.files[0];
 setImageBlob(file);
 setImagePreviewUrl(URL.createObjectURL(file));
 setError('');
 }
 };

 const retake = () => {
 resetState();
 };

 const handleSubmit = async () => {
 if (!auth.currentUser || !imageBlob) return;
 setUploading(true);
 setError('');
 try {
 const userId = auth.currentUser.uid;
 let downloadURL = '';
 try {
 let uploadFile: Blob = imageBlob;
 if (imageBlob instanceof File || imageBlob.type.startsWith('image/')) {
 try {
 const fileToOpt = imageBlob instanceof File ? imageBlob : new File([imageBlob], 'id_card.jpg', { type: imageBlob.type || 'image/jpeg' });
 const optimized = await optimizeMediaImage(fileToOpt, 1200, 0.85);
 uploadFile = optimized.blob;
 } catch (e) {
 console.warn('ID modal compression skipped:', e);
 }
 }
 const storageRef = ref(storage, `id_verifications/${userId}/${Date.now()}.jpg`);
 await uploadBytes(storageRef, uploadFile);
 downloadURL = await getDownloadURL(storageRef);
 } catch (storageErr) {
 console.warn('Storage upload failed, falling back to base64', storageErr);
 const base64 = await new Promise<string>((resolve) => {
 const reader = new FileReader();
 reader.onloadend = () => resolve(reader.result as string);
 reader.readAsDataURL(imageBlob);
 });
 downloadURL = base64;
 }

 await setDoc(doc(db, 'verifications', userId), {
 userId,
 status: 'pending',
 timestamp: new Date().toISOString(),
 email: auth.currentUser.email,
 name: userName,
 documentUrl: downloadURL
 });
 onSuccess();
 onClose();
 } catch (err: any) {
 console.error(err);
 setError('Failed to submit verification. Please try again.');
 try {
 console.error(err);
 } catch (e) {}
 } finally {
 setUploading(false);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
 <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative">
 <div className="p-4 border-b border-gray-100 flex items-center justify-between">
 <h2 className="text-xs font-bold text-gray-900">ID Verification</h2>
 <button 
 onClick={onClose}
 className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
 >
 <X className="w-5 h-5"/>
 </button>
 </div>

 <div className="p-6">
 {error && (
 <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>
 <p>{error}</p>
 </div>
 )}

 {!imagePreviewUrl ? (
 <div className="space-y-4">
 <p className="text-xs text-gray-500 mb-4 text-center">
 Please upload a photo of your official government ID. Ensure it is clearly visible.
 </p>

 <label 
 className="relative aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-red-500 transition-colors"
 >
 <input
 type="file"
 accept="image/*"
 onChange={handleFileUpload}
 className="hidden"
 />
 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 border border-gray-100 text-red-500">
 <FileImage className="w-8 h-8"/>
 </div>
 <p className="font-bold text-gray-900">Click to browse files</p>
 <p className="text-xs text-gray-500 mt-1">Accepts JPG, PNG, WEBP</p>
 </label>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
 <img src={imagePreviewUrl || undefined} alt="ID Preview"className="w-full h-full object-contain"/>
 </div>

 <div className="flex gap-3">
 <button 
 onClick={retake}
 disabled={uploading}
 className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
 >
 Choose Different
 </button>
 <button 
 onClick={handleSubmit}
 disabled={uploading}
 className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {uploading ? (
 'Uploading...'
 ) : (
 <>
 <Upload className="w-5 h-5"/> Submit ID
 </>
 )}
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};
