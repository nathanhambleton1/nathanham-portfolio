import React from 'react';
import { FaTiktok, FaInstagram, FaYoutube } from 'react-icons/fa6';


interface LiquorBotDetailModalProps {
  onClose: () => void;
  detailType: 'mobile' | 'hardware' | 'firmware' | null;
}


const getDetailContent = (type: 'mobile' | 'hardware' | 'firmware' | null) => {
  switch (type) {
    case 'mobile':
      return {
        title: 'Mobile App',
        sections: [
          {
            heading: 'Overview',
            content: 'The LiquorBot mobile app is your all-in-one control center for your robotic bartender, built with React Native and powered by AWS cloud integration.'
          },
          {
            heading: 'AWS Integration & Secure Authentication',
            content: 'Sign in securely with AWS Amplify. All your custom drinks, device settings, and event data are stored in the cloud and tied to your authenticated profile.'
          },
          {
            heading: 'Custom Drinks & Recipes',
            content: 'Create, save, and manage your own drink recipes. Personalize your cocktail experience and access your favorites from any device.'
          },
          {
            heading: 'Device Management',
            content: 'Monitor and control your LiquorBot hardware remotely. Manage priorities, settings, and communication with your physical device, all from the app.'
          },
          {
            heading: 'Events & Menus',
            content: 'Create new events, customize drink menus for each event, and tailor the experience for parties, weddings, or gatherings.'
          },
          {
            heading: 'Explore Page',
            content: 'Discover new recipes, browse pre-populated drinks, and see what’s possible with your available ingredients. All recipes are stored and synced via the cloud.'
          },
          {
            heading: 'Live Monitoring & Pouring',
            content: 'Track the status of your device, monitor pours in real time, and ensure every drink is perfect.'
          },
          {
            heading: 'Profiles & Customization',
            content: 'Add user profiles, upload pictures, and personalize your experience. Manage multiple users and preferences.'
          },
          {
            heading: 'Help & Support',
            content: 'Access the built-in help center for setup, troubleshooting, and tips directly from the app.'
          }
        ]
      };
    case 'hardware':
      return {
        title: 'Hardware',
        description: 'Custom PCBs with stepper motor control systems. Precision dispensing, ingredient recognition, and robust mechanical design.'
      };
    case 'firmware':
      return {
        title: 'Firmware',
        description: 'ESP32 firmware for solenoid control, IoT Core connectivity, and app integration. Handles communication between hardware and mobile app.'
      };
    default:
      return {
        title: 'LiquorBot Details',
        description: '(Details about LiquorBot will go here.)'
      };
  }
};

// 3D Rotating Image Component (copied 1-for-1 from HomePage.tsx)
const RotatingImage: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const targetRotation = React.useRef({ x: 0, y: 0 });
  const currentRotation = React.useRef({ x: 0, y: 0 });
  const animationFrame = React.useRef<number | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maxRotation = 20; // degrees
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const animate = () => {
      currentRotation.current.x = lerp(currentRotation.current.x, targetRotation.current.x, 0.12);
      currentRotation.current.y = lerp(currentRotation.current.y, targetRotation.current.y, 0.12);
      container.style.transform = `perspective(1000px) rotateX(${currentRotation.current.x}deg) rotateY(${currentRotation.current.y}deg)`;
      animationFrame.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let rotateX = -((e.clientY - centerY) / rect.height) * maxRotation;
      let rotateY = -((centerX - e.clientX) / rect.width) * maxRotation;
      // Clamp for smooth max edges
      rotateX = Math.max(-maxRotation, Math.min(maxRotation, rotateX));
      rotateY = Math.max(-maxRotation, Math.min(maxRotation, rotateY));
      targetRotation.current = { x: rotateX, y: rotateY };
    };

    const handleMouseLeave = () => {
      targetRotation.current = { x: 0, y: 0 };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="rotating-image"
      style={{
        perspective: '1000px',
        transition: 'transform 0.1s cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d'
      }}
    >
      <div className="device-frame">
        <img 
          src="/apppreview_blank.png" 
          alt="LiquorBot App Preview" 
          className="app-preview"
        />
        <div className="device-shadow"></div>
      </div>
      {/* Floating images for depth effect (customizable) */}
      <div
        className="floating-image"
        style={{ top: '1.5%', left: '5%', transform: 'translateZ(30px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/liquorbot_overlay.png" alt="Liquorbot Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ top: '-3%', right: '-15%', transform: 'translateZ(30px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/devicesettings_overlay.png" alt="Device Settings Overlay" style={{ width: 300, height: 300 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '12%', left: '-6%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/events_overlay.png" alt="Events Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '15.5%', right: '-5%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/drinkmenu_overlay.png" alt="Drink Menu Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '5.5%', right: '-6%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/newevent_overlay.png" alt="New Event Overlay" style={{ width: 250, height: 250 }} />
      </div>
      {/* Social Media Icons - top right outside edge */}
      <div
        className="floating-image"
        style={{ top: '-5%', right: '-10%', transform: 'translateZ(-50px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <FaTiktok size={54} color="#fff" />
      </div>
      <div
        className="floating-image"
        style={{ top: '10%', right: '-10%', transform: 'translateZ(-50px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <FaInstagram size={54} color="#fff" />
      </div>
      <div
        className="floating-image"
        style={{ top: '25%', right: '-10%', transform: 'translateZ(-50px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <FaYoutube size={54} color="#fff" />
      </div>
    </div>
  );
};


const LiquorBotDetailModal: React.FC<LiquorBotDetailModalProps> = ({ onClose, detailType }) => {
  const mobileContent = getDetailContent('mobile');
  const [slideIdx, setSlideIdx] = React.useState(0);
  const { title, sections } = detailType === 'mobile' ? mobileContent : getDetailContent(detailType);
  const maxSlide = detailType === 'mobile' ? sections.length - 1 : 0;

  // Prevent background scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card p-8 rounded-lg shadow-lg max-w-4xl w-full z-10 border border-minimal-border flex flex-row items-center justify-center gap-8" style={{ minHeight: 420 }}>
        <button
          className="absolute top-4 right-4 text-2xl text-muted-foreground hover:text-foreground focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {detailType === 'mobile' && (
          <div className="flex-shrink-0" style={{ minWidth: 340, maxWidth: 380, marginRight: 0 }}>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center', width: '100%' }}>
              <RotatingImage />
            </div>
          </div>
        )}
        <div className="flex flex-col items-start justify-center w-full" style={{ minWidth: 260 }}>
          <h2 className="text-2xl font-bold mb-4 text-foreground">{title}</h2>
          {detailType === 'mobile' ? (
            <div className="w-full flex flex-col items-start justify-center mb-6" style={{ minHeight: 140 }}>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{sections[slideIdx].heading}</h3>
              <p className="text-muted-foreground mb-4">{sections[slideIdx].content}</p>
              <div className="flex items-center justify-between w-full mt-2">
                <button
                  className="px-3 py-1 rounded-full bg-minimal-accent/10 text-minimal-accent hover:bg-minimal-accent/30 transition-colors"
                  onClick={() => setSlideIdx(idx => Math.max(0, idx - 1))}
                  disabled={slideIdx === 0}
                  aria-label="Previous"
                  style={{ opacity: slideIdx === 0 ? 0.5 : 1 }}
                >
                  &#8592;
                </button>
                <div className="flex gap-2 items-center mt-2">
                  {sections.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block rounded-full transition-all duration-200 ${i === slideIdx ? 'bg-white' : 'bg-zinc-400'}`}
                      style={{
                        width: i === slideIdx ? 10 : 6,
                        height: i === slideIdx ? 10 : 6,
                        opacity: i === slideIdx ? 1 : 0.85,
                        boxShadow: i === slideIdx ? '0 0 6px #fff' : 'none',
                        border: 'none',
                      }}
                    />
                  ))}
                </div>
                <button
                  className="px-3 py-1 rounded-full bg-minimal-accent/10 text-minimal-accent hover:bg-minimal-accent/30 transition-colors"
                  onClick={() => setSlideIdx(idx => Math.min(maxSlide, idx + 1))}
                  disabled={slideIdx === maxSlide}
                  aria-label="Next"
                  style={{ opacity: slideIdx === maxSlide ? 0.5 : 1 }}
                >
                  &#8594;
                </button>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground mb-6 w-full">{sections ? sections[0].content : ''}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiquorBotDetailModal;
