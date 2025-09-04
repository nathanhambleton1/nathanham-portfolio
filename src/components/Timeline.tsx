import { useState, useEffect } from 'react';
import { ExternalLink, Apple } from 'lucide-react';

interface TimelineItem {
  id: string;
  title: string;
  description: string;
  period: string;
  details: string[];
  links?: Array<{ label: string; url: string }>;
}

interface TimelineProps {
  items: TimelineItem[];
}

const Timeline = ({ items }: TimelineProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleItems, setVisibleItems] = useState<boolean[]>(new Array(items.length).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute('data-index') || '0');
          if (entry.isIntersecting) {
            setVisibleItems(prev => {
              const newVisible = [...prev];
              newVisible[index] = true;
              return newVisible;
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    const timelineElements = document.querySelectorAll('.timeline-item');
    timelineElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Main timeline line */}
      <div className="absolute left-8 top-0 bottom-0 timeline-line" />

      <div className="space-y-12">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`timeline-item flex items-start gap-8 section-enter ${
              visibleItems[index] ? 'visible' : ''
            }`}
            data-index={index}
            style={{ transitionDelay: `${index * 0.2}s`, position: 'relative' }}
          >
            {/* Timeline dot */}
            <div className="relative z-10 flex-shrink-0">
              <div 
                className={`timeline-dot cursor-pointer transition-all duration-300 ${
                  activeIndex === index ? 'active' : ''
                }`}
                onClick={() => setActiveIndex(index)}
              />
              {index === activeIndex && (
                <div className="absolute -inset-2 border border-minimal-accent/30 rounded-full animate-pulse" />
              )}
            </div>

            {/* Content */}
            <div 
              className={`flex-1 project-card cursor-pointer transition-all duration-300 ${
                activeIndex === index ? 'minimal-hover' : ''
              }`}
              onClick={() => setActiveIndex(index)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <span className="text-sm text-muted-foreground font-mono">{item.period}</span>
              </div>
              
              <p className="text-foreground/90 mb-4 leading-relaxed">{item.description}</p>
              
              {activeIndex === index && (
                <>
                  <div className="space-y-2 animate-fade-in">
                    {item.details.map((detail, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-tech-glow-secondary rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm text-foreground/80">{detail}</span>
                      </div>
                    ))}
                  </div>
                  {/* Custom links/buttons for expanded box */}
                  {item.links && item.links.length > 0 && (
                    <div className="flex gap-4 mt-6 justify-end">
                      {item.links.map((link, idx) => {
                        // Pick icon based on link label or url
                        let Icon = ExternalLink;
                        if (link.label.toLowerCase().includes('ios') || link.url.includes('apple.com')) {
                          Icon = Apple;
                        }
                        if (link.label.toLowerCase().includes('server')) {
                          Icon = ExternalLink;
                        }
                        return (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-minimal-accent/20 backdrop-blur-sm rounded-full hover:bg-minimal-accent/40 transition-colors flex items-center gap-2"
                          >
                            <Icon className="w-5 h-5 text-minimal-accent" />
                            <span className="font-mono text-sm text-minimal-accent">{link.label}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;