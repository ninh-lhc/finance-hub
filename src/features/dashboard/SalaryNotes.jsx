import { salaryPictureLines } from '../../logic/salaryPicture.js';

export default function SalaryNotes({ picture }) {
  const lines = salaryPictureLines(picture);
  if (lines.length === 0) return null;
  return (
    <p className="text-sm text-[#1B2559] bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 leading-6">
      {lines.join(' · ')}
    </p>
  );
}
