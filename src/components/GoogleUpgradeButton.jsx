import React, { useState } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import {
  linkAnonymousUserWithGoogle,
  signInWithExistingGoogleAccount,
} from '../services/firebase/googleAuthService.js';
import {
  fromLegacyAuthAction,
  getGoogleAuthErrorPresentation,
} from '../logic/googleAuthError.js';
import {
  canStartGoogleAuthAction,
  getGoogleLinkSuccessMessage,
  getGoogleSignInSuccessMessage,
  GOOGLE_IDENTITY_ONLY_NOTE,
  EXISTING_GOOGLE_SIGN_IN_CONFIRM,
} from '../logic/googleAuthFlow.js';

function getGoogleDisplayLabel(user) {
  if (!user) return '';
  const googleProvider = user.providerData?.find((p) => p.providerId === 'google.com');
  return user.displayName || googleProvider?.email || user.email || 'Google';
}

export default function GoogleUpgradeButton({ auth, user, onToast, disabled }) {
  const [processingAction, setProcessingAction] = useState(null);

  const isBusy = Boolean(processingAction);
  const buttonsDisabled = disabled || isBusy || !user;

  const runAuthAction = async (legacyAction, fn) => {
    if (!canStartGoogleAuthAction({ user, disabled, processingAction })) return;
    setProcessingAction(legacyAction);
    try {
      await fn();
      if (legacyAction === 'link') {
        onToast(getGoogleLinkSuccessMessage(), 'success');
      } else {
        onToast(getGoogleSignInSuccessMessage(), 'success');
      }
    } catch (error) {
      const presentation = getGoogleAuthErrorPresentation({
        error,
        action: fromLegacyAuthAction(legacyAction),
      });
      if (!presentation.silent && presentation.message) {
        onToast(presentation.message, presentation.severity);
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handleLinkCurrentData = () =>
    runAuthAction('link', () => linkAnonymousUserWithGoogle({ auth, currentUser: user }));

  const handleExistingSignIn = () => {
    if (!canStartGoogleAuthAction({ user, disabled, processingAction })) return;
    if (!window.confirm(EXISTING_GOOGLE_SIGN_IN_CONFIRM)) return;
    runAuthAction('sign-in', () => signInWithExistingGoogleAccount({ auth }));
  };

  if (user && !user.isAnonymous) {
    return (
      <div className="p-6 bg-white rounded-[24px] border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-[#1B2559] uppercase">Bảo vệ dữ liệu bằng Google</h4>
          <p className="text-xs text-gray-500 mt-1">
            Google đã kết nối: <span className="font-bold text-[#1B2559]">{getGoogleDisplayLabel(user)}</span>
          </p>
          <p className="text-[10px] text-gray-400 font-bold mt-2 leading-relaxed">{GOOGLE_IDENTITY_ONLY_NOTE}</p>
        </div>
        <div className="py-3 px-6 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-[10px] font-black uppercase whitespace-nowrap flex items-center gap-2">
          <Cloud size={16} />
          Đã kết nối Google
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-[24px] border border-gray-100 flex flex-col gap-4">
      <div>
        <h4 className="text-sm font-black text-[#1B2559] uppercase">Bảo vệ dữ liệu bằng Google</h4>
        <p className="text-xs text-gray-500 mt-1">
          Tài khoản hiện tại đang ẩn danh trên thiết bị này. Liên kết Google để giữ UID trên thiết bị này, hoặc đăng
          nhập Gmail đã dùng trước đó.
        </p>
        <p className="text-[10px] text-gray-400 font-bold mt-2 leading-relaxed">{GOOGLE_IDENTITY_ONLY_NOTE}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleLinkCurrentData}
          disabled={buttonsDisabled}
          className="flex-1 py-3 px-6 bg-[#1B2559] text-white rounded-2xl text-[10px] font-black uppercase shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processingAction === 'link' ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
          Liên kết dữ liệu hiện tại với Google
        </button>
        <button
          type="button"
          onClick={handleExistingSignIn}
          disabled={buttonsDisabled}
          className="flex-1 py-3 px-6 bg-white border border-gray-200 text-[#1B2559] rounded-2xl text-[10px] font-black uppercase shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processingAction === 'sign-in' ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
          Đăng nhập tài khoản Google đã có
        </button>
      </div>
    </div>
  );
}
