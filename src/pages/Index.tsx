import { useEffect, useState } from 'react';
import { Github, Linkedin, Heart } from 'lucide-react';
import Navigation from '../components/Navigation';
import InteractiveHeadshot from '../components/InteractiveHeadshot';
import Timeline from '../components/Timeline';
import ProjectCard from '../components/ProjectCard';
import BrandCarousel from '../components/BrandCarousel';

const Index = () => {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

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
      id: 'dynamics',
      title: 'Vehicle Dynamics Engineer',
      description: 'Started with aerodynamics and chassis design, focusing on performance optimization and structural integrity.',
      period: '2022 - 2023',
      details: [
        'Designed aerodynamic components using CFD analysis',
        'Optimized chassis weight distribution for better handling',
        'Implemented suspension tuning for various track conditions',
        'Collaborated with composite materials team for carbon fiber integration'
      ]
    },
    {
      id: 'electronics',
      title: 'Electronics Integration',
      description: 'Transitioned to electronics systems, integrating sensors, telemetry, and control systems.',
      period: '2023 - 2024',
      details: [
        'Developed telemetry system for real-time performance monitoring',
        'Integrated motor controllers and battery management systems',
        'Implemented CAN bus communication protocols',
        'Designed custom PCBs for sensor integration'
      ]
    },
    {
      id: 'hv-lead',
      title: 'High Voltage Systems Lead',
      description: 'Leading the high voltage team, overseeing battery systems, motor control, and safety protocols.',
      period: '2024 - Present',
      details: [
        'Managing 800V battery pack design and safety systems',
        'Implementing ISO 26262 functional safety standards',
        'Leading team of 12 engineers across multiple disciplines',
        'Optimizing power delivery systems for maximum efficiency',
        'Coordinating with manufacturing partners for production readiness'
      ]
    }
  ];

  // Projects Data
  const otherProjects = [
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

  return (
    <div className="min-h-screen bg-black text-foreground">
      <Navigation />
      
      {/* About Section */}
      <section id="about" className={`min-h-screen flex items-center justify-center px-4 lg:px-8 pt-16 lg:pt-0 section-enter ${visibleSections.has('about') ? 'visible' : ''}`}>
        <div className="max-w-4xl mx-auto text-center">
          <InteractiveHeadshot />
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-tech-glow via-tech-glow-secondary to-tech-accent bg-clip-text text-transparent">
            John Developer
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 font-light leading-relaxed">
            High Voltage Systems Engineer & Creative Technologist
          </p>
          
          <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-12 leading-relaxed">
            Passionate about pushing the boundaries of technology through innovative engineering solutions. 
            Currently leading high voltage systems development for solar racing while creating engaging tech content.
          </p>
          
          {/* Social Links */}
          <div className="flex items-center justify-center gap-6">
            <a 
              href="#" 
              className="flex items-center gap-2 px-6 py-3 bg-card/50 backdrop-blur-sm border border-tech-border rounded-lg hover:border-tech-glow/50 transition-all duration-300 tech-glow group"
            >
              <Github className="w-5 h-5 group-hover:text-tech-glow transition-colors" />
              <span>GitHub</span>
            </a>
            <a 
              href="#" 
              className="flex items-center gap-2 px-6 py-3 bg-card/50 backdrop-blur-sm border border-tech-border rounded-lg hover:border-tech-glow/50 transition-all duration-300 tech-glow group"
            >
              <Linkedin className="w-5 h-5 group-hover:text-tech-glow transition-colors" />
              <span>LinkedIn</span>
            </a>
            <a 
              href="#" 
              className="flex items-center gap-2 px-6 py-3 bg-card/50 backdrop-blur-sm border border-tech-border rounded-lg hover:border-tech-glow/50 transition-all duration-300 tech-glow group"
            >
              <Heart className="w-5 h-5 group-hover:text-tech-glow transition-colors" />
              <span>TikTok</span>
            </a>
          </div>
        </div>
      </section>

      {/* Solar Car Project */}
      <section id="solar-car" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('solar-car') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-tech-glow">Solar Car Project</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Journey from Vehicle Dynamics to High Voltage Systems Lead - pioneering sustainable transportation technology
            </p>
          </div>
          
          <Timeline items={solarCarTimeline} />
          
          {/* Placeholder for 3D models and images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            <div className="project-card bg-gradient-to-br from-muted to-muted/50 p-8 rounded-lg text-center">
              <div className="text-4xl mb-4">🔋</div>
              <h3 className="text-lg font-semibold mb-2">Battery Systems</h3>
              <p className="text-sm text-muted-foreground">Custom 800V battery pack with advanced BMS</p>
            </div>
            <div className="project-card bg-gradient-to-br from-muted to-muted/50 p-8 rounded-lg text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">Telemetry</h3>
              <p className="text-sm text-muted-foreground">Real-time performance monitoring system</p>
            </div>
            <div className="project-card bg-gradient-to-br from-muted to-muted/50 p-8 rounded-lg text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold mb-2">Motor Control</h3>
              <p className="text-sm text-muted-foreground">High-efficiency power delivery systems</p>
            </div>
          </div>
        </div>
      </section>

      {/* College Section */}
      <section id="college" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('college') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-tech-glow">NC State University</h2>
            <p className="text-xl text-muted-foreground">Electrical & Computer Engineering</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="project-card">
              <h3 className="text-2xl font-semibold mb-4 text-tech-glow-secondary">Coursework</h3>
              <div className="space-y-3">
                {[
                  'Advanced Digital Signal Processing',
                  'Power Electronics & Motor Drives',
                  'Embedded Systems Design', 
                  'Control Systems Theory',
                  'Renewable Energy Systems',
                  'High Voltage Engineering'
                ].map((course, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-tech-glow rounded-full" />
                    <span className="font-mono text-sm">{course}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="project-card">
              <h3 className="text-2xl font-semibold mb-4 text-tech-glow-secondary">Achievements</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-medium">Dean's List</div>
                  <div className="text-sm text-muted-foreground">Fall 2022, Spring 2023, Fall 2023</div>
                </div>
                <div>
                  <div className="text-lg font-medium">IEEE Outstanding Student Award</div>
                  <div className="text-sm text-muted-foreground">Recognition for technical excellence</div>
                </div>
                <div>
                  <div className="text-lg font-medium">Solar Car Team Leadership</div>
                  <div className="text-sm text-muted-foreground">High Voltage Systems Lead</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LiquorBot Project */}
      <section id="liquorbot" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('liquorbot') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-tech-glow">LiquorBot</h2>
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

      {/* Other Projects */}
      <section id="projects" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('projects') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-tech-glow">Other Projects</h2>
            <p className="text-xl text-muted-foreground">Personal engineering projects and creative builds</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherProjects.map((project, index) => (
              <ProjectCard key={index} {...project} />
            ))}
          </div>
        </div>
      </section>

      {/* TikTok & Brands */}
      <section id="brands" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('brands') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-tech-glow">Content & Partnerships</h2>
            <p className="text-xl text-muted-foreground">Building tech community through engaging content</p>
          </div>
          
          <BrandCarousel />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 lg:px-8 border-t border-tech-border">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted-foreground font-mono">
            Built with React & ❤️ • © 2024 John Developer
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
