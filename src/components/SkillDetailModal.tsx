import React from 'react';

export interface SkillDetail {
  name: string;
  description: string;
  source: string;
}

interface SkillDetailModalProps {
  skill: SkillDetail;
  onClose: () => void;
}

const SkillDetailModal: React.FC<SkillDetailModalProps> = ({ skill, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card p-8 rounded-lg shadow-lg max-w-md w-full z-10 border border-minimal-border">
        <button
          className="absolute top-4 right-4 text-2xl text-muted-foreground hover:text-foreground focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4 text-foreground">{skill.name}</h2>
        <p className="mb-4 text-foreground/90">{skill.description}</p>
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Learned at: </span>{skill.source}
        </div>
      </div>
    </div>
  );
};

export default SkillDetailModal;
