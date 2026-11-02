/** @typedef {'link-current-data' | 'sign-in-existing'} GoogleAuthAction */

/**
 * @param {GoogleAuthAction} action
 * @param {'link' | 'sign-in'} legacyAction
 */
export function toLegacyAuthAction(action) {
  if (action === 'link-current-data') return 'link';
  if (action === 'sign-in-existing') return 'sign-in';
  return 'sign-in';
}

/**
 * @param {'link' | 'sign-in'} legacyAction
 * @returns {GoogleAuthAction}
 */
export function fromLegacyAuthAction(legacyAction) {
  return legacyAction === 'link' ? 'link-current-data' : 'sign-in-existing';
}

/**
 * @param {{ error?: { code?: string } | null; action?: GoogleAuthAction }} input
 * @returns {{ severity: 'error' | 'warning' | 'success'; message: string; code: string | null; silent: boolean }}
 */
export function getGoogleAuthErrorPresentation({ error, action }) {
  const code = typeof error?.code === 'string' ? error.code : null;

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return { severity: 'warning', message: '', code, silent: true };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      severity: 'error',
      code,
      silent: false,
      message:
        'Domain hiện tại chưa được Firebase Authentication cho phép. Trong Firebase Console → Authentication → Settings → Authorized domains, hãy thêm localhost cho dev local; sau khi deploy Vercel, thêm domain production.',
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      severity: 'error',
      code,
      silent: false,
      message:
        'Đăng nhập Google chưa được bật. Vào Firebase Console → Authentication → Sign-in method → bật Google và chọn email hỗ trợ nếu được yêu cầu.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      severity: 'warning',
      code,
      silent: false,
      message: 'Trình duyệt đang chặn popup. Hãy cho phép popup cho trang này rồi thử lại.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      severity: 'error',
      code,
      silent: false,
      message: 'Lỗi mạng. Vui lòng kiểm tra kết nối và thử lại.',
    };
  }

  if (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/email-already-in-use'
  ) {
    if (action === 'link-current-data') {
      return {
        severity: 'error',
        code,
        silent: false,
        message:
          'Gmail này đã được liên kết với dữ liệu khác. Hãy dùng "Đăng nhập tài khoản Google đã có" nếu muốn mở dữ liệu đó.',
      };
    }
    return {
      severity: 'error',
      code,
      silent: false,
      message: `Không thể đăng nhập Google lúc này. Mã lỗi: ${code}`,
    };
  }

  if (code === 'auth/account-exists-with-different-credential') {
    if (action === 'link-current-data') {
      return {
        severity: 'error',
        code,
        silent: false,
        message:
          'Tài khoản đã tồn tại với phương thức đăng nhập khác. Hãy dùng "Đăng nhập tài khoản Google đã có" thay vì liên kết.',
      };
    }
    return {
      severity: 'error',
      code,
      silent: false,
      message: `Không thể đăng nhập Google lúc này. Mã lỗi: ${code}`,
    };
  }

  if (code === 'auth/invalid-api-key') {
    return {
      severity: 'error',
      code,
      silent: false,
      message:
        'Cấu hình Firebase chưa hợp lệ (API key). Kiểm tra các biến VITE_FIREBASE_* trong .env.local — không chia sẻ giá trị cấu hình.',
    };
  }

  if (code === 'auth/configuration-not-found') {
    return {
      severity: 'error',
      code,
      silent: false,
      message:
        'Firebase Authentication chưa được cấu hình đúng cho project này. Kiểm tra project ID và cấu hình web app trong Firebase Console.',
    };
  }

  if (code === 'auth/internal-error') {
    return {
      severity: 'error',
      code,
      silent: false,
      message: `Lỗi nội bộ Firebase Auth. Vui lòng thử lại sau. Mã lỗi: ${code}`,
    };
  }

  if (code === 'auth/web-storage-unsupported') {
    return {
      severity: 'error',
      code,
      silent: false,
      message:
        'Trình duyệt không hỗ trợ hoặc đang chặn web storage cần cho đăng nhập. Thử trình duyệt/profile khác; không cần xóa toàn bộ site data.',
    };
  }

  if (code === 'auth/operation-not-supported-in-this-environment') {
    return {
      severity: 'error',
      code,
      silent: false,
      message: 'Môi trường hiện tại không hỗ trợ đăng nhập Google bằng popup.',
    };
  }

  if (code === 'auth/uid-changed-after-link') {
    return {
      severity: 'error',
      code,
      silent: false,
      message: 'Lỗi bảo toàn UID: UID sau khi liên kết không khớp UID trước đó.',
    };
  }

  if (code === 'auth/not-anonymous' || code === 'auth/no-current-user') {
    return {
      severity: 'error',
      code,
      silent: false,
      message: 'Phiên đăng nhập hiện tại không thể liên kết dữ liệu.',
    };
  }

  if (code) {
    return {
      severity: 'error',
      code,
      silent: false,
      message: `Không thể đăng nhập Google lúc này. Mã lỗi: ${code}`,
    };
  }

  return {
    severity: 'error',
    code: null,
    silent: false,
    message: 'Không thể đăng nhập Google lúc này. Vui lòng thử lại.',
  };
}
