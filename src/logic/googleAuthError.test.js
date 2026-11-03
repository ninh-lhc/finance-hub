import { describe, it, expect } from 'vitest';
import { getGoogleAuthErrorPresentation } from './googleAuthError.js';

const err = (code) => ({ code });

describe('getGoogleAuthErrorPresentation', () => {
  it('maps auth/unauthorized-domain with setup guidance', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/unauthorized-domain'),
      action: 'link-current-data',
    });
    expect(result.silent).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toMatch(/Authorized domains/i);
    expect(result.message).toMatch(/localhost/i);
  });

  it('maps auth/operation-not-allowed', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/operation-not-allowed'),
      action: 'sign-in-existing',
    });
    expect(result.message).toMatch(/Sign-in method/i);
    expect(result.code).toBe('auth/operation-not-allowed');
  });

  it('maps auth/popup-blocked as warning', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/popup-blocked'),
      action: 'link-current-data',
    });
    expect(result.severity).toBe('warning');
    expect(result.silent).toBe(false);
    expect(result.message).toMatch(/popup/i);
  });

  it('silences auth/popup-closed-by-user', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/popup-closed-by-user'),
      action: 'link-current-data',
    });
    expect(result.silent).toBe(true);
  });

  it('silences auth/cancelled-popup-request', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/cancelled-popup-request'),
      action: 'sign-in-existing',
    });
    expect(result.silent).toBe(true);
  });

  it('maps auth/network-request-failed', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/network-request-failed'),
      action: 'sign-in-existing',
    });
    expect(result.message).toMatch(/mạng/i);
  });

  it('maps auth/credential-already-in-use for link flow without suggesting auto merge', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/credential-already-in-use'),
      action: 'link-current-data',
    });
    expect(result.message).toMatch(/giữ nguyên/i);
    expect(result.message).toMatch(/Đăng nhập tài khoản Google đã có/);
  });

  it('maps auth/credential-already-in-use for sign-in without exposing raw code', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/credential-already-in-use'),
      action: 'sign-in-existing',
    });
    expect(result.message).not.toMatch(/auth\/credential-already-in-use/);
    expect(result.message).toMatch(/Phiên hiện tại/i);
  });

  it('maps auth/email-already-in-use for link flow', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/email-already-in-use'),
      action: 'link-current-data',
    });
    expect(result.message).toMatch(/giữ nguyên/i);
    expect(result.message).toMatch(/Không thể liên kết Gmail/i);
  });

  it('maps auth/account-exists-with-different-credential for link', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/account-exists-with-different-credential'),
      action: 'link-current-data',
    });
    expect(result.message).toMatch(/phương thức khác/i);
    expect(result.message).toMatch(/Dừng lại/i);
  });

  it('maps auth/invalid-api-key without exposing values', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/invalid-api-key'),
      action: 'link-current-data',
    });
    expect(result.message).toMatch(/Cấu hình Firebase/i);
    expect(result.message).not.toMatch(/AIza/);
  });

  it('maps auth/configuration-not-found', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/configuration-not-found'),
      action: 'sign-in-existing',
    });
    expect(result.message).toMatch(/chưa được cấu hình đúng/i);
  });

  it('maps auth/internal-error with safe code', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/internal-error'),
      action: 'sign-in-existing',
    });
    expect(result.message).toMatch(/Mã lỗi: auth\/internal-error/);
  });

  it('maps auth/web-storage-unsupported', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/web-storage-unsupported'),
      action: 'link-current-data',
    });
    expect(result.message).toMatch(/web storage/i);
    expect(result.message).toMatch(/không cần xóa/i);
  });

  it('maps auth/operation-not-supported-in-this-environment', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/operation-not-supported-in-this-environment'),
      action: 'sign-in-existing',
    });
    expect(result.message).toMatch(/popup/i);
  });

  it('maps unknown error with code', () => {
    const result = getGoogleAuthErrorPresentation({
      error: err('auth/too-many-requests'),
      action: 'sign-in-existing',
    });
    expect(result.message).toBe(
      'Không thể đăng nhập Google lúc này. Mã lỗi: auth/too-many-requests',
    );
  });

  it('maps unknown error without code', () => {
    const result = getGoogleAuthErrorPresentation({
      error: {},
      action: 'link-current-data',
    });
    expect(result.code).toBe(null);
    expect(result.message).toBe('Không thể đăng nhập Google lúc này. Vui lòng thử lại.');
  });

  it('does not mutate error input', () => {
    const error = err('auth/network-request-failed');
    const snapshot = JSON.stringify(error);
    getGoogleAuthErrorPresentation({ error, action: 'link-current-data' });
    expect(JSON.stringify(error)).toBe(snapshot);
  });
});
