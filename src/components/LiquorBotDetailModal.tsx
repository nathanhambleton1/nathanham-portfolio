import React from 'react';
import { createPortal } from 'react-dom';
import { FaTiktok, FaInstagram, FaYoutube } from 'react-icons/fa6';
import { useIsMobile } from '../hooks/use-mobile';

// 3D Rotating Image Component (for mobile app preview)
const RotatingImage: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const targetRotation = React.useRef({ x: 0, y: 0 });
  const currentRotation = React.useRef({ x: 0, y: 0 });
  const animationFrame = React.useRef<number | null>(null);
  const isMobile = useIsMobile();

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
          src="/nathanham-portfolio/apppreview_blank.png" 
          alt="LiquorBot App Preview" 
          className="app-preview"
        />
        <div className="device-shadow"></div>
      </div>
      {/* Floating images for depth effect (customizable) */}
      {!isMobile && (
        <>
          <div
            className="floating-image"
            style={{ top: '1.5%', left: '5%', transform: 'translateZ(30px) scale(1)', zIndex: 2, position: 'absolute' }}
          >
            <img src="/nathanham-portfolio/liquorbot_overlay.png" alt="Liquorbot Overlay" style={{ width: 250, height: 250 }} />
          </div>
          <div
            className="floating-image"
            style={{ top: '-3%', right: '-15%', transform: 'translateZ(30px) scale(1)', zIndex: 2, position: 'absolute' }}
          >
            <img src="/nathanham-portfolio/devicesettings_overlay.png" alt="Device Settings Overlay" style={{ width: 300, height: 300 }} />
          </div>
          <div
            className="floating-image"
            style={{ bottom: '12%', left: '-6%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
          >
            <img src="/nathanham-portfolio/events_overlay.png" alt="Events Overlay" style={{ width: 250, height: 250 }} />
          </div>
          <div
            className="floating-image"
            style={{ bottom: '15.5%', right: '-5%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
          >
            <img src="/nathanham-portfolio/drinkmenu_overlay.png" alt="Drink Menu Overlay" style={{ width: 250, height: 250 }} />
          </div>
          <div
            className="floating-image"
            style={{ bottom: '5.5%', right: '-6%', transform: 'translateZ(40px) scale(1)', zIndex: 2, position: 'absolute' }}
          >
            <img src="/nathanham-portfolio/newevent_overlay.png" alt="New Event Overlay" style={{ width: 250, height: 250 }} />
          </div>
        </>
      )}
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
        sections: [
          {
            heading: 'Solenoid & Pump Control',
            content: 'LiquorBot uses motor control chips to drive solenoids and diaphragm pumps. PWM is used specifically for the diaphragm pump to control flow rate and dispensing precision. An SPI protocol manages communication with up to 18 solenoids, enabling ingredients to be turned on/off and pumps to be activated as needed.'
          },
          {
            heading: 'Pressure Sensor & Coaster',
            content: 'A pressure sensor is integrated at the top with a coaster to detect when a glass is placed or pressed down. This enables accurate pour detection and automates drink serving.'
          },
          {
            heading: 'LED Ring Visual Feedback',
            content: 'An LED ring provides real-time visual feedback, indicating system status, pour progress, and alerts for users. It enhances the interactive experience and makes the process intuitive.'
          },
          {
            heading: 'Custom PCB Design',
            content: 'The hardware is built around custom PCBs featuring an ESP32 microcontroller. The system is split into three boards: the main PCB (top solenoids, output solenoids, pumps, microcontroller), and two tray PCBs for modular expansion.'
          },
          {
            heading: 'Optimized Wiring & Protocol',
            content: 'A custom protocol dramatically reduces wire count by allowing trays to communicate over SPI, eliminating the need for separate positive/negative wires for each solenoid. This results in a cleaner, more reliable design.'
          },
          {
            heading: 'Mini Fridge Enclosure & Connectivity',
            content: 'All hardware is housed inside a mini fridge for compactness and cooling. The ESP32 features an external antenna for WiFi and Bluetooth connectivity. Initial setup is done via Bluetooth, where the app provides WiFi credentials. Once connected, the device communicates with the app over WiFi for remote control and monitoring.'
          },
          {
            heading: 'Custom Woodworking',
            content: 'All wood tops and drawers are custom made, featuring hand-crafted woodworking for a premium look and feel. This adds a unique, personal touch to the LiquorBot hardware.'
          }
        ],
        description: 'Custom PCBs, pressure sensor, LED ring, and hand-crafted woodwork, all housed in a mini fridge. Precision dispensing, ingredient recognition, and robust mechanical design.'
      };
    case 'firmware':
      return {
        title: 'Firmware',
        sections: [
          {
            heading: 'Overview',
            content:
              'LiquorBot firmware is written in C for the ESP32 microcontroller, enabling real-time control and seamless integration with hardware and cloud services. The system is designed for reliability, modularity, and advanced automation.'
          },
          {
            heading: 'Non-Blocking RTOS Architecture',
            content:
              'Built on FreeRTOS, the firmware uses non-blocking tasks to allow multiple functions to run concurrently. This architecture ensures smooth operation, responsive controls, and efficient resource management.'
          },
          {
            heading: 'AWS IoT Manager & MQTT Communication',
            content:
              'The AWS manager connects directly to AWS IoT Core using MQTT messages. All drink orders, device status, and event data are securely transmitted between the app and device, enabling real-time cloud integration.'
          },
          {
            heading: 'Bluetooth Setup & WiFi Provisioning',
            content:
              'Initial setup is performed over Bluetooth, allowing the app to send WiFi credentials to the device. Once connected, the ESP32 switches to WiFi for ongoing communication and remote control.'
          },
          {
            heading: 'State Manager & Device Modes',
            content:
              'A robust state manager tracks device status, user actions, and operational modes. Maintenance mode, cleaning cycles, and pour restrictions are enforced to ensure safe and reliable operation.'
          },
          {
            heading: 'LED Control & Visual Feedback',
            content:
              'Firmware controls the LED ring to provide real-time feedback based on device state. Colors and animations indicate pouring, cleaning, errors, and connectivity, enhancing user experience.'
          },
          {
            heading: 'Advanced Cleaning Modes',
            content:
              'Multiple cleaning routines are available: deep clean, quick clean, and custom clean. Each solenoid and pump can be individually activated for thorough maintenance, ensuring hygiene and longevity.'
          },
          {
            heading: 'Pressure Pad Logic',
            content:
              'The pressure pad detects when a glass is placed, triggering pour routines and preventing spills. Firmware logic ensures drinks are only poured when a glass is present and the device is in the correct state.'
          },
          {
            heading: 'Modular & Extensible Codebase',
            content:
              'The firmware is modular, allowing for easy updates and expansion. Each hardware component (solenoids, pumps, sensors) is managed by dedicated modules, making the system flexible and maintainable.'
          },
        ]
      };
    default:
      return {
        title: 'LiquorBot Details',
        description: '(Details about LiquorBot will go here.)'
      };
  }
};


// 3D Rotating Firmware Image Component for Firmware Section
const RotatingFirmwareImage: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const targetRotation = React.useRef({ x: 0, y: 0 });
  const currentRotation = React.useRef({ x: 0, y: 0 });
  const animationFrame = React.useRef<number | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maxRotation = 20;
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

  const isMobile = useIsMobile();
  return (
    <div
      ref={containerRef}
      className="rotating-firmware-image"
      style={{
        perspective: '1000px',
        transition: 'transform 0.1s cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d',
        position: 'relative',
        width: 420,
        height: 420,
        marginLeft: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        boxShadow: 'none',
        borderRadius: 0,
      }}
    >
      {/* Firmware code structure image - full size, transparent background */}
      {!isMobile && (
        <img
          src="/nathanham-portfolio/code_structure.png"
          alt="Firmware Code Structure"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: 'none',
            boxShadow: 'none',
            borderRadius: 0,
            filter: 'none',
            display: 'block',
          }}
        />
      )}
    </div>
  );
};
const RotatingPCBImages: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const targetRotation = React.useRef({ x: 0, y: 0 });
  const currentRotation = React.useRef({ x: 0, y: 0 });
  const animationFrame = React.useRef<number | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maxRotation = 20;
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

  // All images are layered at the same position, but with different translateZ for depth
  const isMobile = useIsMobile();
  return (
    <div
      ref={containerRef}
      className="rotating-pcb-images"
      style={{
        perspective: '1000px',
        transition: 'transform 0.1s cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d',
        position: 'relative',
        width: 340,
        height: 340,
        marginLeft: 0,
      }}
    >
      {/* PCB Images only on non-mobile */}
      {!isMobile && (
        <>
          {/* BCU - back layer */}
          <img
            src="/nathanham-portfolio/bcu.png"
            alt="BCU PCB"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 340,
              height: 340,
              objectFit: 'contain',
              transform: 'translateZ(-40px)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
          {/* FCU - middle layer */}
          <img
            src="/nathanham-portfolio/fcu.png"
            alt="FCU PCB"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 340,
              height: 340,
              objectFit: 'contain',
              transform: 'translateZ(0px)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
          {/* Silkscreen - front layer */}
          <img
            src="/nathanham-portfolio/silkscreen.png"
            alt="Silkscreen"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 340,
              height: 340,
              objectFit: 'contain',
              transform: 'translateZ(40px)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          />
        </>
      )}
    </div>
  );
};



const LiquorBotDetailModal: React.FC<LiquorBotDetailModalProps> = ({ onClose, detailType }) => {
  const mobileContent = getDetailContent('mobile');
  const [slideIdx, setSlideIdx] = React.useState(0);
  const { title, sections, description } = detailType === 'mobile' ? mobileContent : getDetailContent(detailType);
  const [hardwareSlideIdx, setHardwareSlideIdx] = React.useState(0);
  const [firmwareSlideIdx, setFirmwareSlideIdx] = React.useState(0);
  const maxSlide = detailType === 'mobile' ? sections.length - 1 : 0;
  const maxHardwareSlide = detailType === 'hardware' && sections ? sections.length - 1 : 0;
  const maxFirmwareSlide = detailType === 'firmware' && sections ? sections.length - 1 : 0;

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Ensure we only attempt portal client-side
  if (typeof document === 'undefined') return null;

  const isMobile = useIsMobile();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-card p-8 rounded-lg shadow-lg max-w-4xl w-full z-10 border border-minimal-border flex ${isMobile ? 'flex-col items-center justify-center' : 'flex-row items-center justify-center'} gap-8 overflow-hidden`} style={{ minHeight: 420, maxHeight: '90vh' }}>
        <button
          className="absolute top-4 right-4 text-2xl text-muted-foreground hover:text-foreground focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {/* Mobile Section: App Preview 3D Image */}
        {detailType === 'mobile' && !isMobile && (
          <div className="flex-shrink-0" style={{ minWidth: 340, maxWidth: 380, marginRight: 0 }}>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center', width: '100%' }}>
              <RotatingImage />
            </div>
          </div>
        )}
        {/* Hardware Section: PCB 3D Layered Images */}
        {detailType === 'hardware' && !isMobile && (
          <div className="flex-shrink-0" style={{ minWidth: 340, maxWidth: 380, marginRight: 0 }}>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center', width: '100%' }}>
              <RotatingPCBImages />
            </div>
          </div>
        )}
        {/* Firmware Section: Rotating 3D Image */}
        {detailType === 'firmware' && !isMobile && (
          <div className="flex-shrink-0" style={{ minWidth: 340, maxWidth: 380, marginRight: 0 }}>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center', width: '100%' }}>
              <RotatingFirmwareImage />
            </div>
          </div>
        )}
        <div className={`flex flex-col w-full ${isMobile ? 'items-center justify-center text-center' : 'items-start justify-center'}`} style={{ minWidth: 260 }}>
          <h2 className="text-2xl font-bold mb-4 text-foreground">{title}</h2>
          {/* Mobile Section Details */}
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
              {/* App Store button below all info and scroll buttons, left aligned */}
              <div className="w-full flex justify-start" style={{ paddingTop: 52 }}>
                <a
                  href="https://apps.apple.com/us/app/liquorbot/id6746461095"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', width: 'auto' }}
                >
                  <img
                    src="/nathanham-portfolio/appstore.png"
                    alt="Download on the App Store"
                    style={{ width: 200, height: 'auto', objectFit: 'contain', borderRadius: 0, boxShadow: 'none', display: 'block' }}
                  />
                </a>
              </div>
            </div>
          ) : null}
          {/* Hardware Section Details - Slideshow */}
          {detailType === 'hardware' ? (
            <div className="w-full flex flex-col items-start justify-center mb-6" style={{ minHeight: 140 }}>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{sections[hardwareSlideIdx].heading}</h3>
              <p className="text-muted-foreground mb-4">{sections[hardwareSlideIdx].content}</p>
              <div className="flex items-center justify-between w-full mt-2">
                <button
                  className="px-3 py-1 rounded-full bg-minimal-accent/10 text-minimal-accent hover:bg-minimal-accent/30 transition-colors"
                  onClick={() => setHardwareSlideIdx(idx => Math.max(0, idx - 1))}
                  disabled={hardwareSlideIdx === 0}
                  aria-label="Previous"
                  style={{ opacity: hardwareSlideIdx === 0 ? 0.5 : 1 }}
                >
                  &#8592;
                </button>
                <div className="flex gap-2 items-center mt-2">
                  {sections.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block rounded-full transition-all duration-200 ${i === hardwareSlideIdx ? 'bg-white' : 'bg-zinc-400'}`}
                      style={{
                        width: i === hardwareSlideIdx ? 10 : 6,
                        height: i === hardwareSlideIdx ? 10 : 6,
                        opacity: i === hardwareSlideIdx ? 1 : 0.85,
                        boxShadow: i === hardwareSlideIdx ? '0 0 6px #fff' : 'none',
                        border: 'none',
                      }}
                    />
                  ))}
                </div>
                <button
                  className="px-3 py-1 rounded-full bg-minimal-accent/10 text-minimal-accent hover:bg-minimal-accent/30 transition-colors"
                  onClick={() => setHardwareSlideIdx(idx => Math.min(maxHardwareSlide, idx + 1))}
                  disabled={hardwareSlideIdx === maxHardwareSlide}
                  aria-label="Next"
                  style={{ opacity: hardwareSlideIdx === maxHardwareSlide ? 0.5 : 1 }}
                >
                  &#8594;
                </button>
              </div>
            </div>
          ) : null}
          {/* Firmware Section Details - Slideshow */}
          {detailType === 'firmware' && sections ? (
            <div className="w-full flex flex-col items-start justify-center mb-6" style={{ minHeight: 140 }}>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{sections[firmwareSlideIdx].heading}</h3>
              <p className="text-muted-foreground mb-4">{sections[firmwareSlideIdx].content}</p>
              <div className="flex items-center justify-between w-full mt-2">
                <button
                  className="px-3 py-1 rounded-full bg-minimal-accent/10 text-minimal-accent hover:bg-minimal-accent/30 transition-colors"
                  onClick={() => setFirmwareSlideIdx(idx => Math.max(0, idx - 1))}
                  disabled={firmwareSlideIdx === 0}
                  aria-label="Previous"
                  style={{ opacity: firmwareSlideIdx === 0 ? 0.5 : 1 }}
                >
                  &#8592;
                </button>
                <div className="flex gap-2 items-center mt-2">
                  {sections.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block rounded-full transition-all duration-200 ${i === firmwareSlideIdx ? 'bg-white' : 'bg-zinc-400'}`}
                      style={{
                        width: i === firmwareSlideIdx ? 10 : 6,
                        height: i === firmwareSlideIdx ? 10 : 6,
                        opacity: i === firmwareSlideIdx ? 1 : 0.85,
                        boxShadow: i === firmwareSlideIdx ? '0 0 6px #fff' : 'none',
                        border: 'none',
                      }}
                    />
                  ))}
                </div>
                <button
                  className="px-3 py-1 rounded-full bg-minimal-accent/10 text-minimal-accent hover:bg-minimal-accent/30 transition-colors"
                  onClick={() => setFirmwareSlideIdx(idx => Math.min(maxFirmwareSlide, idx + 1))}
                  disabled={firmwareSlideIdx === maxFirmwareSlide}
                  aria-label="Next"
                  style={{ opacity: firmwareSlideIdx === maxFirmwareSlide ? 0.5 : 1 }}
                >
                  &#8594;
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LiquorBotDetailModal;
