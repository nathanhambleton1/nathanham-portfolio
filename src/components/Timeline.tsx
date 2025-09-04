import { useState, useEffect } from 'react';

interface TimelineItem {
  id: string;
  title: string;
  description: string;
  period: string;
  details: string[];
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
            style={{ transitionDelay: `${index * 0.2}s` }}
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
                <div className="absolute -inset-2 border border-tech-glow/30 rounded-full animate-pulse" />
              )}
            </div>

            {/* Content */}
            <div 
              className={`flex-1 project-card cursor-pointer transition-all duration-300 ${
                activeIndex === index ? 'tech-glow' : ''
              }`}
              onClick={() => setActiveIndex(index)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="text-xl font-semibold text-tech-glow">{item.title}</h3>
                <span className="text-sm text-muted-foreground font-mono">{item.period}</span>
              </div>
              
              <p className="text-foreground/90 mb-4 leading-relaxed">{item.description}</p>
              
              {activeIndex === index && (
                <div className="space-y-2 animate-fade-in">
                  {item.details.map((detail, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-tech-glow-secondary rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm text-foreground/80">{detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;