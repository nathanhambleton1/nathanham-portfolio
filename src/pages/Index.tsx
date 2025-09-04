import { useEffect, useState } from 'react';
import SkillDetailModal from '../components/SkillDetailModal';
import skillsData from '../lib/skills';
import { Github, Linkedin, Heart } from 'lucide-react';
import WheelNavigation from '../components/WheelNavigation';

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
      {/* Experience Section */}
      <section id="experience" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('experience') ? 'visible' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Experience</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="project-card">
              <h3 className="text-2xl font-semibold mb-2 text-foreground">SolarPack @ NC State</h3>
              <div className="text-lg font-medium">High Voltage Team Lead</div>
              <div className="text-sm text-muted-foreground mb-2">Jul 2025 – Present</div>
              <ul className="list-disc list-inside text-left text-muted-foreground mb-4">
                <li>Responsible for custom lithium-ion battery system, motor controller integration, and power electronics</li>
                <li>Led reduction of 100s13p pack to 100s9p for race regulations, including cell removal, BMS rewiring, and new tab welds</li>
                <li>Managed motor controller systems, HV-to-LV buck converter setup, and AC-to-DC charger integration</li>
                <li>Focus on performance, safety, and system reliability</li>
              </ul>
              <div className="text-lg font-medium">Vehicle Dynamics Engineer</div>
              <div className="text-sm text-muted-foreground mb-2">Aug 2022 – Jul 2025</div>
              <ul className="list-disc list-inside text-left text-muted-foreground">
                <li>Worked on chassis, suspension, and mechanical systems for solar car</li>
                <li>Fabricated and installed strut mounts, brake pedal mounts, steering shafts, and other structural components</li>
                <li>Installed steering system, subframes, differentials, struts, brake lines, wheels, and brakes</li>
                <li>Assisted with motor installation and alignment for chain drive to differential</li>
                <li>Performed welding and custom mounts for electrical components</li>
              </ul>
            </div>
            <div className="project-card">
              <h3 className="text-2xl font-semibold mb-2 text-foreground">Viral Nation</h3>
              <div className="text-lg font-medium">Content Creator</div>
              <div className="text-sm text-muted-foreground mb-2">Jan 2021 – Present</div>
              <ul className="list-disc list-inside text-left text-muted-foreground mb-4">
                <li>Independent content creator and VFX artist signed with Viral Nation</li>
                <li>Specializing in cinematic, story-driven video editing for social media</li>
                <li>Built a following of 800,000+ with 150M+ total views and 16% engagement rate</li>
                <li>Collaborated with brands: Google, Prime Video, Best Buy, Audible, Kia, Apex Legends, Niantic, Autodesk, Asus, and more</li>
                <li>Managed full creative production pipeline, marketing strategies, and client relations</li>
              </ul>
              <h3 className="text-2xl font-semibold mb-2 text-foreground">Ford Motor Company</h3>
              <div className="text-lg font-medium">Aftermarket Vehicle Personalization Intern</div>
              <div className="text-sm text-muted-foreground mb-2">May 2024 – Aug 2024</div>
              <ul className="list-disc list-inside text-left text-muted-foreground mb-4">
                <li>Supported Ford Performance aftermarket products through marketing and sales operations</li>
                <li>Developed automated notification system for SIPOC process stages</li>
                <li>Contributed to vehicle wrap customization platform and new aftermarket package program</li>
                <li>Developed pricing model for social media influencer partnerships</li>
                <li>Gained experience in cross-functional communication and strategic planning</li>
              </ul>
              <h3 className="text-2xl font-semibold mb-2 text-foreground">Wynfield Forest Swim Team</h3>
              <div className="text-lg font-medium">Assistant Head Coach</div>
              <div className="text-sm text-muted-foreground mb-2">Jul 2021 – Jun 2023</div>
              <ul className="list-disc list-inside text-left text-muted-foreground">
                <li>Team leadership and management for youth swim team</li>
              </ul>
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
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Solar Car Project</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Journey from Vehicle Dynamics to High Voltage Systems Lead - pioneering sustainable transportation technology
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

      {/* TikTok & Brands */}
      <section id="brands" className={`py-20 px-4 lg:px-8 section-enter ${visibleSections.has('brands') ? 'visible' : ''}`}>
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
      <footer className="py-12 px-4 lg:px-8 border-t border-minimal-border">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted-foreground font-mono">
            Built with React & ❤️ • © 2025 Nathan Hambleton
          </p>
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
