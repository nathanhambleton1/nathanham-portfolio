import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const WheelNavigation = () => {
  const [activeSection, setActiveSection] = useState('about');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);

  const navItems = [
    { id: 'about', label: 'About' },
    { id: 'college', label: 'College' },
    { id: 'solar-car', label: 'Solar Car' },
    { id: 'liquorbot', label: 'LiquorBot' },
    { id: 'brands', label: 'Brands' },
    { id: 'projects', label: 'Projects' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map(item => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 100;

      // Update wheel rotation based on scroll
      const scrollPercent = scrollPosition / (document.body.scrollHeight - window.innerHeight);
      setWheelRotation(scrollPercent * 360);

      // Find active section
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(navItems[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  const getItemPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Start from top
    const radius = 80;
    const x = Math.cos(angle) * radius + 100;
    const y = Math.sin(angle) * radius + 100;
    return { x, y, angle: angle * (180 / Math.PI) };
  };

  return (
    <>
      {/* Desktop Wheel Navigation */}
      <div className="hidden lg:block">
        <div 
          className="nav-wheel"
          style={{ transform: `translateY(-50%) rotate(${wheelRotation}deg)` }}
        >
          {/* Central dot */}
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-minimal-accent rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          
          {/* Orbital ring - subtle */}
          <div className="absolute inset-0 border border-minimal-accent/20 rounded-full" />
          
          {/* Navigation items positioned around the wheel */}
          {navItems.map((item, index) => {
            const position = getItemPosition(index, navItems.length);
            const isActive = activeSection === item.id;
            
            return (
              <div
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{
                  left: position.x,
                  top: position.y,
                  transform: `translate(-50%, -50%) rotate(${-wheelRotation}deg)`, // Counter-rotate text
                }}
                onClick={() => scrollToSection(item.id)}
              >
                <span className={isActive ? 'text-foreground font-medium' : 'text-foreground/60'}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -left-2 top-1/2 w-1 h-1 bg-foreground rounded-full transform -translate-y-1/2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Navigation - Top Header */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-minimal-border">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-semibold">Portfolio</div>
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-foreground hover:text-minimal-accent transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-black/95 backdrop-blur-sm border-b border-minimal-border">
            <div className="flex flex-col p-4 gap-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left text-sm font-mono tracking-wide transition-all duration-300 ${
                    activeSection === item.id 
                      ? 'text-foreground font-medium' 
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default WheelNavigation;