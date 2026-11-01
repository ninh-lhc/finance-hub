import utils from '../../utils/format.js';
import { THEME } from '../../constants/theme.js';

const ProgressBar = ({ value, max, color = THEME.primary, height = 'h-1.5', className = '' }) => {
  const percent = utils.calculateProgress(value, max);
  return (
    <div className={`w-full bg-[#E9EDF7] rounded-full ${height} overflow-hidden ${className}`}>
      <div className="rounded-full transition-all duration-700 ease-out h-full" style={{ width: `${percent}%`, backgroundColor: color }}></div>
    </div>
  );
};

export default ProgressBar;
