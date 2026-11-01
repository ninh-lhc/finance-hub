import React, { useState } from 'react';
import { GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';
import { Cloud, Loader2 } from 'lucide-react';

export default function GoogleUpgradeButton({ auth, user, onToast, disabled }) {
  const [isLinking, setIsLinking] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!user || isLinking || disabled) return;

    setIsLinking(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const previousUid = user.uid;

    try {
      if (user.isAnonymous) {
        const result = await linkWithPopup(user, provider);
        if (result.user.uid !== previousUid) {
          throw new Error('UID_MISMATCH_AFTER_LINK');
        }
        onToast('Da lien ket tai khoan Google thanh cong. UID duoc giu nguyen.', 'success');
      } else {
        await signInWithPopup(auth, provider);
        onToast('Da dang nhap bang Google.', 'success');
      }
    } catch (error) {
      console.error('Google sign-in/link error:', error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        onToast('Ban da dong popup dang nhap.', 'warning');
      } else if (error.code === 'auth/popup-blocked') {
        onToast('Trinh duyet dang chan popup. Hay cho phep popup roi thu lai.', 'warning');
      } else if (error.code === 'auth/credential-already-in-use' || error.code === 'auth/account-exists-with-different-credential') {
        onToast('Tai khoan Google nay da gan voi UID khac. He thong khong link de tranh mat du lieu UID hien tai.', 'error');
      } else if (error.message === 'UID_MISMATCH_AFTER_LINK') {
        onToast('Loi bao toan UID: UID sau khi link khong khop UID cu.', 'error');
      } else {
        onToast('Khong the dang nhap Google luc nay. Vui long thu lai.', 'error');
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-[24px] border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h4 className="text-sm font-black text-[#1B2559] uppercase">Bao ve du lieu bang Google</h4>
        <p className="text-xs text-gray-500 mt-1">
          {user?.isAnonymous
            ? 'Tai khoan hien tai dang an danh. Bam nut de link voi Google va giu nguyen UID.'
            : 'Tai khoan hien tai da duoc xac thuc. Ban co the dang nhap lai bang Google khi can.'}
        </p>
      </div>
      <button
        onClick={handleGoogleSignIn}
        disabled={disabled || isLinking || !user}
        className="py-3 px-6 bg-white border border-gray-200 text-[#1B2559] rounded-2xl text-[10px] font-black uppercase shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLinking ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
        {user?.isAnonymous ? 'Link Google (giu UID)' : 'Dang nhap Google'}
      </button>
    </div>
  );
}
