import { useState } from 'react';
import { ExternalLink, Github, Zap } from 'lucide-react';

interface ProjectCardProps {
  title: string;
  description: string;
  tags: string[];
  imageUrl?: string;
  githubUrl?: string;
  liveUrl?: string;
  featured?: boolean;
}

const ProjectCard = ({ 
  title, 
  description, 
  tags, 
  imageUrl, 
  githubUrl, 
  liveUrl, 
  featured = false 
}: ProjectCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`project-card group relative overflow-hidden ${
        featured ? 'col-span-1 md:col-span-2 lg:col-span-2' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-tech-glow/20 backdrop-blur-sm px-3 py-1 rounded-full">
          <Zap className="w-4 h-4 text-tech-glow" />
          <span className="text-xs font-medium text-tech-glow">Featured</span>
        </div>
      )}

      {/* Image placeholder */}
      <div className="relative h-48 bg-gradient-to-br from-muted to-muted/50 rounded-lg mb-4 overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl text-muted-foreground/50">🔧</div>
          </div>
        )}
        
        {/* Overlay with links */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center gap-4 transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-tech-glow/20 backdrop-blur-sm rounded-full hover:bg-tech-glow/40 transition-colors"
            >
              <Github className="w-5 h-5 text-tech-glow" />
            </a>
          )}
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-tech-glow/20 backdrop-blur-sm rounded-full hover:bg-tech-glow/40 transition-colors"
            >
              <ExternalLink className="w-5 h-5 text-tech-glow" />
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground group-hover:text-tech-glow transition-colors">
          {title}
        </h3>
        
        <p className="text-foreground/80 text-sm leading-relaxed">
          {description}
        </p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-tech-glow/10 text-tech-glow text-xs font-mono rounded border border-tech-glow/20"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Animated border effect */}
      <div className={`absolute inset-0 border-2 border-transparent rounded-lg transition-all duration-300 ${
        isHovered ? 'border-tech-glow/50' : ''
      }`} />
    </div>
  );
};

export default ProjectCard;