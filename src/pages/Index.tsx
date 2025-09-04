import { useEffect, useState } from 'react';
import SkillDetailModal from '../components/SkillDetailModal';
import skillsData from '../lib/skills';
import { Github, Linkedin, Heart } from 'lucide-react';
import WheelNavigation from '../components/WheelNavigation';

import Timeline from '../components/Timeline';
import { useRef } from 'react';
import ProjectCard from '../components/ProjectCard';
import BrandCarousel from '../components/BrandCarousel';

const Index = () => {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const [sunScale, setSunScale] = useState(1);
  const sunRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let frameId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        const sun = sunRef.current;
        if (!sun) return;
        const rect = sun.getBoundingClientRect();
        const sunX = rect.left + rect.width / 2;
        const sunY = rect.top + rect.height / 2;
        const dx = e.clientX - sunX;
        const dy = e.clientY - sunY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Clamp scale between 0.7 and 1.5 based on distance (closer = bigger)
        const minScale = 0.25;
        const maxScale = 1.5;
        const maxDistance = 1500;
        const scale = Math.max(minScale, maxScale - (distance / maxDistance) * (maxScale - minScale));
        setSunScale(scale);
        frameId = null;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            setVisibleSections(prev => new Set([...prev, sectionId]));
          }
        });
      },
      { threshold: 0.2 }
    );

    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // Solar Car Timeline Data
  const solarCarTimeline = [
    {
      id: 'hv-lead',
      title: 'High Voltage Systems Lead',
      description: 'Led the reconfiguration and maintenance of the high-voltage system powering Fenrir, focusing on battery pack compliance, BMS optimization, and safe operation.',
      period: '2025 - Present',
      details: [
        'Led a team of 5 undergraduate electical engineering students',
        'Reconfigured custom lithium-ion battery pack from 20kWh to 15kWh to meet new race regulations (100S9P), including spot welding new nickel/copper strips and cell rearrangement',
        'Refined battery management system (BMS) parameters for accurate state-of-charge, thermal, and current protection',
        'Managed motor controller and charging infrastructure for safe, reliable operation',
        'Coordinated system-level architecture, isolation, and fault protection strategies',
        'Implemented charge/discharge logic via high-voltage control board',
        'Integrated solar charging system to enable battery charging from solar array',
      ]
    },
    {
      id: 'electronics',
      title: 'Electronics Integration',
      description: 'Developed full-stack telemetry and control systems, including mobile app, backend server, and CAN bus integration.',
      period: '2024 - 2025',
      details: [
        'Built mobile app for live telemetry, control, and dashboard gauges (Bluetooth & cellular)',
        'Implemented backend server to store and serve car data, supporting remote access',
        'Designed frontend dashboard for real-time stats, motor/BMS/charging/low voltage monitoring, and testing',
        'Integrated CAN bus communication for all vehicle modules',
        'Added map/lap tracking, backup camera, and notification system for alerts',
        'Enabled Spotify/music integration and remote server connectivity for multiple devices'
      ],
      links: [
        { label: 'SolarPack iOS App', url: 'https://apps.apple.com/us/app/solarpack/id6748289347' },
        { label: 'SolarPack Server', url: 'https://solarpack-app-server-alyv.onrender.com/#' }
      ]
    },
    {
      id: 'dynamics',
      title: 'Vehicle Dynamics Engineer',
      description: 'Focused on suspension, drivetrain, steering, and chassis fabrication for optimal performance and reliability.',
      period: '2022 - 2024',
      details: [
        'Designed and implemented double wishbone suspension with steering rack and power braking',
        'Engineered chain drive system and motor mounts',
        'Fabricated mounts for brake pedal, steering shaft, and normal pedal',
        'Selected and sourced tires for various track conditions',
        'Chassis fabrication including welding, grinding, and steel work',
        'Collaborated on drivetrain and steering system integration'
      ]
    }
  ];

  // Projects Data
  const otherProjects = [
    {
      title: 'Portfolio Website on Raspberry Pi',
      description: 'This very website! Self-hosted on a Raspberry Pi 4 with custom domain, SSL certificates, and automated deployments. Features Docker containerization and GitHub Actions CI/CD pipeline.',
      tags: ['Raspberry Pi', 'Docker', 'CI/CD', 'Self-Hosting', 'SSL'],
      featured: true
    },
    {
      title: 'Electric Skateboard v3',
      description: 'Custom-built electric skateboard with regenerative braking, smartphone app control, and 25-mile range. Features custom battery management system and machined aluminum trucks.',
      tags: ['Hardware', 'Mobile App', 'BMS', '3D Printing'],
      featured: false
    },
    {
      title: 'FPV Racing Drone',
      description: 'High-performance racing drone with custom flight controller, 4K recording capability, and sub-250g weight for competition racing.',
      tags: ['Drones', 'Flight Control', 'Carbon Fiber', 'Racing'],
      featured: false
    },
    {
      title: 'Gaming PC Build',
      description: 'Custom liquid-cooled gaming rig with RGB integration, custom cable management, and overclocked performance. Built for content creation and streaming.',
      tags: ['PC Building', 'Liquid Cooling', 'RGB', 'Overclocking'],
      featured: false
    }
  ];

  const [selectedSkill, setSelectedSkill] = useState(null);
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (selectedSkill) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedSkill]);

  return (
    <div className="min-h-screen bg-black text-foreground">
      <WheelNavigation />

      {/* About Section */}
      <section id="about" className={`min-h-screen flex items-center justify-center px-4 lg:px-8 pt-16 lg:pt-0 section-enter ${visibleSections.has('about') ? 'visible' : ''}`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <img
              src="/Headshot%20small.png"
              alt="Nathan Hambleton headshot"
              className="w-40 h-40 rounded-full border-4 border-white shadow-lg object-cover"
              style={{ background: '#fff' }}
            />
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-foreground">
            Nathan Hambleton
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 font-light leading-relaxed">
            Electrical Engineer | Product Development | Video Creator
          </p>

          <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-12 leading-relaxed">
            Electrical engineer passionate about embedded systems, hardware, software, and creative tech. I love building things—from solar cars and IoT robots to mobile apps and VFX content.
          </p>

          {/* Social Links */}
          <div className="flex items-center justify-center gap-6">
            <a 
              href="https://www.linkedin.com/in/nathanhambleton/" 
              className="flex items-center gap-2 px-6 py-3 bg-card/50 backdrop-blur-sm border border-minimal-border rounded-lg hover:border-minimal-accent transition-all duration-300 minimal-hover group"
              target="_blank" rel="noopener noreferrer"
            >
              <Linkedin className="w-5 h-5 group-hover:text-minimal-accent transition-colors" />
              <span>LinkedIn</span>
            </a>
            <a 
              href="https://github.com/nathanhambleton1" 
              className="flex items-center gap-2 px-6 py-3 bg-card/50 backdrop-blur-sm border border-minimal-border rounded-lg hover:border-minimal-accent transition-all duration-300 minimal-hover group"
              target="_blank" rel="noopener noreferrer"
            >
              <Github className="w-5 h-5 group-hover:text-minimal-accent transition-colors" />
              <span>GitHub</span>
            </a>
            <a 
              href="https://www.tiktok.com/@nathan_ham" 
              className="flex items-center gap-2 px-6 py-3 bg-card/50 backdrop-blur-sm border border-minimal-border rounded-lg hover:border-minimal-accent transition-all duration-300 minimal-hover group"
              target="_blank" rel="noopener noreferrer"
            >
              <Heart className="w-5 h-5 group-hover:text-minimal-accent transition-colors" />
              <span>TikTok</span>
            </a>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section id="college" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('college') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              <a href="https://www.ncsu.edu/" target="_blank" rel="noopener noreferrer" className="hover:text-minimal-accent transition-colors">
                North Carolina State University
              </a>
            </h2>
            <p className="text-xl text-muted-foreground">B.S. Electrical and Electronics Engineering (2022–2026)</p>
            <p className="text-lg text-muted-foreground mt-2">Focus: Embedded Systems, Circuit Design, Power Electronics</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="project-card">
              <h3 className="text-2xl font-semibold mb-4 text-foreground">Coursework & Activities</h3>
              <div className="space-y-3">
                {[
                  'Embedded Systems Programming',
                  'Analog & Digital Circuit Design',
                  'Amplifier Theory',
                  'Motor Drivers',
                  'Signal Processing',
                  'Mechatronics',
                  'SolarPack: High Voltage Team Lead, Vehicle Dynamics Engineer',
                  'Intramural Soccer (Semifinalist)'
                ].map((course, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-minimal-accent rounded-full" />
                    <span className="font-mono text-sm">{course}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="project-card">
              <h3 className="text-2xl font-semibold mb-4 text-foreground">Achievements</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-medium">Dean's List</div>
                  <div className="text-sm text-muted-foreground">Fall 2022, Spring 2023, Fall 2023</div>
                </div>
                <div>
                  <div className="text-lg font-medium">Solar Car Team Leadership</div>
                  <div className="text-sm text-muted-foreground">High Voltage Team Lead</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Skills Section */}
      <section id="skills" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('skills') ? 'visible' : ''}`}> 
        <div className="max-w-6xl mx-auto"> 
          <div className="text-center mb-16"> 
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Skills</h2> 
            <p className="text-xl text-muted-foreground">Embedded Systems • Mobile App Development • Power Electronics • Mechatronics • Product Development</p> 
          </div> 
          <div className="flex flex-wrap justify-center gap-4"> 
            {skillsData.map((skill, idx) => ( 
              <button 
                key={idx} 
                className="px-4 py-2 bg-card/50 border border-minimal-border rounded-lg text-foreground text-sm font-mono hover:bg-minimal-accent/20 transition-colors focus:outline-none" 
                onClick={() => setSelectedSkill(skill)} 
                type="button"
              > 
                {skill.name} 
              </button> 
            ))} 
          </div> 
        </div> 
      </section>

      {/* Solar Car Project */}
      <section id="solar-car" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('solar-car') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground" style={{ position: 'relative', zIndex: 1 }}>Solar Car Project</h2>
              <img
                src="/sun.png"
                alt="Sun"
                ref={sunRef}
                style={{
                  position: 'absolute',
                  top: '-100px',
                  right: '200px',
                  width: '200px',
                  height: '200px',
                  zIndex: 2,
                  pointerEvents: 'none',
                  transform: `scale(${sunScale})`,
                  transformOrigin: 'center',
                  transition: 'transform 0.1s',
                }}
              />
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              NC States Solar Car Team - Designing and building Fenrir, a solar-powered vehicle for the American Solar Challenge
            </p>
          </div>
          
          <Timeline items={solarCarTimeline} />
          
          {/* Placeholder for 3D models and images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            <div className="project-card p-8 rounded-lg text-center">
              <div className="text-4xl mb-4">🔋</div>
              <h3 className="text-lg font-semibold mb-2">Battery Systems</h3>
              <p className="text-sm text-muted-foreground">Custom 800V battery pack with advanced BMS</p>
            </div>
            <div className="project-card p-8 rounded-lg text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">Telemetry</h3>
              <p className="text-sm text-muted-foreground">Real-time performance monitoring system</p>
            </div>
            <div className="project-card p-8 rounded-lg text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold mb-2">Motor Control</h3>
              <p className="text-sm text-muted-foreground">High-efficiency power delivery systems</p>
            </div>
          </div>
        </div>
      </section>

      {/* LiquorBot Project */}
      <section id="liquorbot" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('liquorbot') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">LiquorBot</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Automated bartending robot with mobile app integration and precision dispensing system
            </p>
          </div>
          
          <ProjectCard
            title="LiquorBot - Automated Bartending System"
            description="A fully automated bartending robot capable of mixing precise cocktails through smartphone app control. Features custom PCB design, stepper motor control systems, and computer vision for ingredient recognition. Built with React Native app, Python backend, and Arduino-based hardware control."
            tags={['Robotics', 'Mobile App', 'PCB Design', 'Computer Vision', 'IoT']}
            featured={true}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="project-card text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-lg font-semibold mb-2">Mobile App</h3>
              <p className="text-sm text-muted-foreground">React Native app for recipe selection and customization</p>
            </div>
            <div className="project-card text-center">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="text-lg font-semibold mb-2">Hardware</h3>
              <p className="text-sm text-muted-foreground">Custom PCBs with stepper motor control systems</p>
            </div>
            <div className="project-card text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold mb-2">AI Integration</h3>
              <p className="text-sm text-muted-foreground">Computer vision for ingredient recognition and quality control</p>
            </div>
          </div>
        </div>
      </section>

      {/* TikTok & Marketing */}
      <section id="marketing" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('marketing') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Content & Partnerships</h2>
            <p className="text-xl text-muted-foreground">Building tech community through engaging content</p>
          </div>
          
          <BrandCarousel />
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('projects') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Projects</h2>
            <p className="text-xl text-muted-foreground">Personal engineering projects and creative builds</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {otherProjects.map((project, index) => (
              <ProjectCard key={index} {...project} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 lg:px-8 border-t border-minimal-border bg-gradient-to-r from-black via-minimal-accent/10 to-black">
        <div className="max-w-6xl mx-auto text-center flex flex-col items-center gap-4">
          <div className="flex gap-4 justify-center mt-2">
            <a href="https://github.com/nathanhambleton1" target="_blank" rel="noopener noreferrer" className="hover:text-minimal-accent transition-colors">
              GitHub
            </a>
            <a href="https://www.linkedin.com/in/nathanhambleton/" target="_blank" rel="noopener noreferrer" className="hover:text-minimal-accent transition-colors">
              LinkedIn
            </a>
            <a href="https://www.tiktok.com/@nathan_ham" target="_blank" rel="noopener noreferrer" className="hover:text-minimal-accent transition-colors">
              TikTok
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4 font-mono">© {new Date().getFullYear()} Nathan Hambleton. All rights reserved.</p>
        </div>
      </footer>
    {selectedSkill && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/0 backdrop-blur-sm" />
        <div className="relative flex items-center justify-center w-full h-full">
          <SkillDetailModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
        </div>
      </div>
    )}
    </div>
  );
};

export default Index;
