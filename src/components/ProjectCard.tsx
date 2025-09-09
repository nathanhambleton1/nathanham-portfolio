import { useState, type ReactNode } from 'react';
import { ExternalLink, Github, Zap } from 'lucide-react';

interface ProjectCardProps {
  title: string;
  description: ReactNode;
  tags: string[];
  imageUrl?: string;
  githubUrl?: string;
  liveUrl?: string;
  featured?: boolean;
  /** Optional custom media node (e.g. a 3D canvas) */
  media?: React.ReactNode;
  /** Layout orientation. Vertical keeps original hero image on top; horizontal places media to the right. */
  layout?: 'vertical' | 'horizontal';
  /** Optional className overrides */
  className?: string;
  /** Remove frame styling (background, borders, rounding) around media */
  mediaNoFrame?: boolean;
  /** Extra classes for media container */
  mediaContainerClassName?: string;
}

const ProjectCard = ({ 
  title, 
  description, 
  tags, 
  imageUrl, 
  githubUrl, 
  liveUrl, 
  featured = false,
  media,
  layout = 'vertical',
  className = '',
  mediaNoFrame = false,
  mediaContainerClassName = ''
}: ProjectCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const isHorizontal = layout === 'horizontal';

  // Special layout for LiquorBot featured horizontal card
  if (featured && layout === 'horizontal' && media) {
    return (
      <div
        className={`project-card group relative overflow-hidden ${featured ? 'col-span-1 md:col-span-2 lg:col-span-2' : ''} flex flex-col md:flex-row items-stretch ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Featured badge */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-minimal-accent/20 backdrop-blur-sm px-3 py-1 rounded-full">
          <Zap className="w-4 h-4 text-minimal-accent" />
          <span className="text-xs font-medium text-minimal-accent">Featured</span>
        </div>
        <div className="flex-1 order-2 md:order-1 p-4 md:p-6 space-y-4">
          <h3 className="text-xl font-semibold text-foreground group-hover:text-minimal-accent transition-colors">{title}</h3>
          <div className="text-foreground/80 text-sm leading-relaxed">{description}</div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-minimal-accent/10 text-minimal-accent text-xs font-mono rounded border border-minimal-accent/20">
                {tag}
              </span>
            ))}
          </div>
          {(githubUrl || liveUrl) && (
            <div className="flex gap-3 pt-2">
              {githubUrl && (
                <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-minimal-accent text-xs flex items-center gap-1 hover:underline">
                  <Github className="w-4 h-4" /> Code
                </a>
              )}
              {liveUrl && (
                <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-minimal-accent text-xs flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-4 h-4" /> Demo
                </a>
              )}
            </div>
          )}
        </div>
        <div
          className={`relative order-1 md:order-2 flex items-center justify-center overflow-visible ${mediaNoFrame ? '' : 'md:min-w-[340px] md:w-[380px] h-64 md:h-auto bg-gradient-to-b from-zinc-900/30 to-zinc-950/20 border-l border-minimal-border/40 md:rounded-l-none rounded-b-lg md:rounded-r-lg'} ${mediaContainerClassName}`}
          style={mediaNoFrame ? { minHeight: '360px' } : undefined}
        >
          <div className="absolute inset-0">{media}</div>
          {!mediaNoFrame && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60" />
          )}
        </div>
        <div className={`absolute inset-0 border-2 border-transparent rounded-lg transition-all duration-300 ${isHovered ? 'border-minimal-accent/50' : ''}`} />
      </div>
    );
  }
  // Default card for other projects
  return (
    <div
      className={`project-card group relative overflow-hidden shadow-lg rounded-xl border border-minimal-border bg-gradient-to-br from-zinc-900/40 to-zinc-950/10 p-6 flex flex-col items-center transition-transform duration-300 hover:scale-105 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Bling Ionicon */}
      <div className="absolute top-4 left-4 text-4xl text-minimal-accent/80">
        <span className="ionicon" role="img" aria-label="project">
          <i className="icon ion-ios-rocket" />
        </span>
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-2 text-center group-hover:text-minimal-accent transition-colors">{title}</h3>
      <div className="text-foreground/80 text-base leading-relaxed mb-4 text-center">{description}</div>
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {tags.map((tag, index) => (
          <span key={index} className="px-2 py-1 bg-minimal-accent/10 text-minimal-accent text-xs font-mono rounded border border-minimal-accent/20">
            {tag}
          </span>
        ))}
      </div>
      {(githubUrl || liveUrl) && (
        <div className="flex gap-3 justify-center pt-2">
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-minimal-accent text-xs flex items-center gap-1 hover:underline">
              <Github className="w-4 h-4" /> Code
            </a>
          )}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-minimal-accent text-xs flex items-center gap-1 hover:underline">
              <ExternalLink className="w-4 h-4" /> Demo
            </a>
          )}
        </div>
      )}
      <div className={`absolute inset-0 border-2 border-transparent rounded-xl transition-all duration-300 ${isHovered ? 'border-minimal-accent/50' : ''}`} />
    </div>
  );
};

export default ProjectCard;