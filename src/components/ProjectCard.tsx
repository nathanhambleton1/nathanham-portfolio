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

  return (
    <div
      className={`project-card group relative overflow-hidden ${featured ? 'col-span-1 md:col-span-2 lg:col-span-2' : ''} ${isHorizontal ? 'flex flex-col md:flex-row items-stretch' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-minimal-accent/20 backdrop-blur-sm px-3 py-1 rounded-full">
          <Zap className="w-4 h-4 text-minimal-accent" />
          <span className="text-xs font-medium text-minimal-accent">Featured</span>
        </div>
      )}

      {/* Media Section */}
      {isHorizontal ? (
        <>
          <div className="flex-1 order-2 md:order-1 p-4 md:p-6 space-y-4">
            <h3 className="text-xl font-semibold text-foreground group-hover:text-minimal-accent transition-colors">
              {title}
            </h3>
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
            className={`relative order-1 md:order-2 flex items-center justify-center overflow-visible ${
              mediaNoFrame
                ? ''
                : 'md:min-w-[340px] md:w-[380px] h-64 md:h-auto bg-gradient-to-b from-zinc-900/30 to-zinc-950/20 border-l border-minimal-border/40 md:rounded-l-none rounded-b-lg md:rounded-r-lg'
            } ${mediaContainerClassName}`}
            style={mediaNoFrame ? { minHeight: '360px' } : undefined}
          >
            {media ? (
              <div className="absolute inset-0">
                {media}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-6xl text-muted-foreground/50">🔧</div>
                )}
              </div>
            )}
            {!mediaNoFrame && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60" />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="relative h-48 bg-gradient-to-br from-muted to-muted/50 rounded-lg mb-4 overflow-hidden">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : media ? (
              <div className="absolute inset-0">{media}</div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-6xl text-muted-foreground/50">🔧</div>
              </div>
            )}
            <div className={`absolute inset-0 bg-black/60 flex items-center justify-center gap-4 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-minimal-accent/20 backdrop-blur-sm rounded-full hover:bg-minimal-accent/40 transition-colors"
                >
                  <Github className="w-5 h-5 text-minimal-accent" />
                </a>
              )}
              {liveUrl && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-minimal-accent/20 backdrop-blur-sm rounded-full hover:bg-minimal-accent/40 transition-colors"
                >
                  <ExternalLink className="w-5 h-5 text-minimal-accent" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground group-hover:text-minimal-accent transition-colors">{title}</h3>
            <div className="text-foreground/80 text-sm leading-relaxed">{description}</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span key={index} className="px-2 py-1 bg-minimal-accent/10 text-minimal-accent text-xs font-mono rounded border border-minimal-accent/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <div className={`absolute inset-0 border-2 border-transparent rounded-lg transition-all duration-300 ${isHovered ? 'border-minimal-accent/50' : ''}`} />
    </div>
  );
};

export default ProjectCard;