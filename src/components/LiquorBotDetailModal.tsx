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
        description: 'React Native app for recipe selection and customization. Control the robot, select recipes, and monitor status from your phone.'
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
        style={{ bottom: '12%', left: '-5%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/events_overlay.png" alt="Events Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '15.5%', right: '-4%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
      >
        <img src="/drinkmenu_overlay.png" alt="Drink Menu Overlay" style={{ width: 250, height: 250 }} />
      </div>
      <div
        className="floating-image"
        style={{ bottom: '5.5%', right: '-5%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
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
  const { title, description } = getDetailContent(detailType);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-2xl p-8 max-w-4xl w-full z-10 flex flex-row items-center justify-center gap-8" style={{ minHeight: 420 }}>
        {detailType === 'mobile' && (
          <div className="flex-shrink-0" style={{ minWidth: 340, maxWidth: 380, marginRight: 0 }}>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center', width: '100%' }}>
              <RotatingImage />
            </div>
          </div>
        )}
        <div className="flex flex-col items-start justify-center w-full" style={{ minWidth: 260 }}>
          <h2 className="text-2xl font-bold mb-4 text-foreground">{title}</h2>
          <p className="text-muted-foreground mb-6">{description}</p>
          <button
            className="mt-4 px-4 py-2 bg-minimal-accent text-white rounded-lg hover:bg-minimal-accent/80 transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiquorBotDetailModal;
