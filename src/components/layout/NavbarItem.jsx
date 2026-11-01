const NavbarItem = ({ id, icon: Icon, label, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-bold transition-all whitespace-nowrap touch-manipulation
      ${activeTab === id ? 'text-[#4318FF]' : 'text-[#A3AED0] hover:text-[#4318FF]'}`}
  >
    <Icon size={18} strokeWidth={2.5} />
    <span className="uppercase tracking-widest text-[10px] font-black">{label}</span>
    {activeTab === id && (
       <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#4318FF] rounded-t-full"></div>
    )}
  </button>
);

export default NavbarItem;
