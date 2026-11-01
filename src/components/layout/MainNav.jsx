import { LayoutDashboard, ArrowRightLeft, BarChart3 } from 'lucide-react';
import NavbarItem from './NavbarItem.jsx';

export default function MainNav({ activeTab, setActiveTab }) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
      <NavbarItem id="dashboard" icon={LayoutDashboard} label="TỔNG QUAN" activeTab={activeTab} setActiveTab={setActiveTab} />
      <NavbarItem id="transactions" icon={ArrowRightLeft} label="GIAO DỊCH" activeTab={activeTab} setActiveTab={setActiveTab} />
      <NavbarItem id="annual" icon={BarChart3} label="TỔNG KẾT NĂM" activeTab={activeTab} setActiveTab={setActiveTab} />
    </nav>
  );
}
