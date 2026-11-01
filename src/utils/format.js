const utils = {
  formatVND: (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0),
  getRelativeYears: (centerYear) => Array.from({ length: 5 }, (_, i) => centerYear - 2 + i),
  calculateProgress: (current, target) => (target > 0 ? Math.min((current / target) * 100, 100) : 0),
  getMonthName: (idx) => `Tháng ${idx + 1}`,
  formatInputNumber: (val) => {
    if (val === '' || val === null || val === undefined) return '';
    const raw = val.toString().replace(/[^0-9]/g, '');
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  },
  parseInputNumber: (val) => {
    const str = val.toString().replace(/[^0-9]/g, '');
    return str ? parseInt(str, 10) : '';
  },
  getLocalYMD: () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  },
  formatDisplayDate: (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  },
  getDayOfWeekVN: (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
    const days = ['Chủ nhật', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[d.getDay()];
  }
};

export default utils;
