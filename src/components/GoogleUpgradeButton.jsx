import React, { useState } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import {
  linkAnonymousUserWithGoogle,
  signInWithExistingGoogleAccount,
} from '../services/firebase/googleAuthService.js';

const EXISTING_SIGN_IN_CONFIRM =
  'Dữ liệu của phiên ẩn danh trên thiết bị này sẽ không được tự động gộp vào tài khoản Google.\n\n' +
  'Sau khi đăng nhập, ứng dụng sẽ hiển thị dữ liệu của tài khoản Google đã liên kết trước đó.\n\n' +
  'Bạn có muốn tiếp tục đăng nhập tài khoản Google đã có?';

function getGoogleDisplayLabel(user) {
  if (!user) return '';
  const googleProvider = user.providerData?.find((p) => p.providerId === 'google.com');
  return user.displayName || googleProvider?.email || user.email || 'Google';
}

function resolveGoogleAuthToast(error, action) {
  const code = error?.code;

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return null;
  }
  if (code === 'auth/popup-blocked') {
    return { message: 'Trình duyệt đang chặn popup. Hãy cho phép popup rồi thử lại.', type: 'warning' };
  }
  if (code === 'auth/network-request-failed') {
    return { message: 'Lỗi mạng. Vui lòng kiểm tra kết nối và thử lại.', type: 'error' };
  }
  if (code === 'auth/operation-not-allowed') {
    return { message: 'Đăng nhập Google chưa được bật cho dự án Firebase này.', type: 'error' };
  }
  if (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/email-already-in-use' ||
    code === 'auth/account-exists-with-different-credential'
  ) {
    if (action === 'link') {
      return {
        message:
          'Gmail này đã được liên kết với dữ liệu khác. Hãy dùng "Đăng nhập tài khoản Google đã có" nếu muốn mở dữ liệu đó.',
        type: 'error',
      };
    }
    return { message: 'Không thể đăng nhập Google lúc này. Vui lòng thử lại.', type: 'error' };
  }
  if (code === 'auth/uid-changed-after-link') {
    return { message: 'Lỗi bảo toàn UID: UID sau khi liên kết không khớp UID trước đó.', type: 'error' };
  }
  if (code === 'auth/not-anonymous' || code === 'auth/no-current-user') {
    return { message: 'Phiên đăng nhập hiện tại không thể liên kết dữ liệu.', type: 'error' };
  }
  return { message: 'Không thể hoàn tất thao tác Google lúc này. Vui lòng thử lại.', type: 'error' };
}

export default function GoogleUpgradeButton({ auth, user, onToast, disabled }) {
  const [processingAction, setProcessingAction] = useState(null);

  const isBusy = Boolean(processingAction);
  const buttonsDisabled = disabled || isBusy || !user;

  const runAuthAction = async (action, fn) => {
    if (!user || isBusy || disabled) return;
    setProcessingAction(action);
    try {
      await fn();
      if (action === 'link') {
        onToast('Đã liên kết dữ liệu hiện tại với Google. UID được giữ nguyên.', 'success');
      } else {
        onToast('Đã đăng nhập tài khoản Google.', 'success');
      }
    } catch (error) {
      if (import.meta.env.DEV && error?.code) {
        console.error(`Google auth (${action}) error code:`, error.code);
      }
      const toast = resolveGoogleAuthToast(error, action);
      if (toast) onToast(toast.message, toast.type);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleLinkCurrentData = () =>
    runAuthAction('link', () => linkAnonymousUserWithGoogle({ auth, currentUser: user }));

  const handleExistingSignIn = () => {
    if (!window.confirm(EXISTING_SIGN_IN_CONFIRM)) return;
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
          Tài khoản hiện tại đang ẩn danh trên thiết bị này. Liên kết để giữ UID và dữ liệu hiện tại, hoặc đăng
          nhập Gmail đã dùng trên thiết bị khác.
        </p>
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
