/**
 * Pure Google Auth UX policy (no Firebase/React). Sync room remains cross-device sync.
 */

export const GOOGLE_IDENTITY_ONLY_NOTE =
  'Google chỉ dùng để bảo vệ danh tính trên thiết bị này. Đồng bộ giữa các thiết bị vẫn bằng mã phòng — không tự động qua Gmail.';

export const EXISTING_GOOGLE_SIGN_IN_CONFIRM =
  'Bạn sẽ đăng nhập tài khoản Google đã có (UID có thể khác phiên ẩn danh hiện tại).\n\n' +
  'Dữ liệu trên thiết bị này sẽ theo tài khoản Google đó — không tự gộp với phiên ẩn danh.\n\n' +
  `${GOOGLE_IDENTITY_ONLY_NOTE}\n\n` +
  'Bạn có muốn tiếp tục?';

/**
 * @param {{
 *   user?: { uid?: string } | null;
 *   disabled?: boolean;
 *   processingAction?: string | null;
 *   authInitialized?: boolean;
 * }} input
 */
export function canStartGoogleAuthAction({ user, disabled, processingAction, authInitialized = true }) {
  if (!authInitialized || !user || disabled) {
    return false;
  }
  if (processingAction) {
    return false;
  }
  return true;
}

export function getGoogleLinkSuccessMessage() {
  return `Đã liên kết Google. UID giữ nguyên. ${GOOGLE_IDENTITY_ONLY_NOTE}`;
}

export function getGoogleSignInSuccessMessage() {
  return `Đã đăng nhập Google. ${GOOGLE_IDENTITY_ONLY_NOTE}`;
}

/**
 * @param {{ uidBefore?: string; uidAfter?: string }} input
 */
export function verifyLinkPreservesUid({ uidBefore, uidAfter }) {
  return typeof uidBefore === 'string' && uidBefore.length > 0 && uidBefore === uidAfter;
}

/**
 * @param {string | null | undefined} syncCodeBefore
 * @param {string | null | undefined} syncCodeAfter
 */
export function verifySyncCodeUnchanged(syncCodeBefore, syncCodeAfter) {
  const before = typeof syncCodeBefore === 'string' ? syncCodeBefore : '';
  const after = typeof syncCodeAfter === 'string' ? syncCodeAfter : '';
  return before === after;
}
