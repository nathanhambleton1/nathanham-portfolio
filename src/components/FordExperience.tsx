import React, { useMemo, useState } from 'react';
import { ChevronRight, Clock, MapPin, Building2, Workflow, DollarSign, Shield, Sparkles } from 'lucide-react';

// Compact interactive card to showcase Ford Motor Company internship highlights
// - Timeline scrubber by milestone
// - SIPOC notifier demo (hover to animate)
// - Wrap customization compliance badges
// - Influencer pricing model tiers visual

const milestones = [
  {
    key: 'sipoc',
    title: 'SIPOC Automation',
    blurb:
      'Built an automated notification system as parts progressed through SIPOC stages, reducing communication gaps across planning, marketing, and supply chain.',
    metric: 'Fewer gaps',
    icon: <Workflow className="w-4 h-4" />,
  },
  {
    key: 'wraps',
    title: 'Wrap Program',
    blurb:
      'Supported the launch of Ford’s new vehicle wrap customization program, including the rollout of a 3D visualizer website for model selection and wrap preview. Coordinated with legal and safety teams to ensure compliance and best practices for installation. Helped design the customer experience for ordering, shop selection, and wrap visualization.',
    metric: 'Compliance ready',
    icon: <Shield className="w-4 h-4" />,
  },
  {
    key: 'package',
    title: 'Aftermarket Packages',
    blurb:
      'Helped concept and launch a new aftermarket package program with external agencies on naming strategy and customer experience.',
    metric: 'New program',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    key: 'influencer',
    title: 'Influencer Pricing',
    blurb:
      'Developed a pricing model to standardize compensation across platforms and creator tiers for social partnerships.',
    metric: 'Standardized rates',
    icon: <DollarSign className="w-4 h-4" />,
  },
];

export default function FordExperience() {
  const [active, setActive] = useState(0);
  const m = milestones[active];

  const tierData = useMemo(
    () => [
      { label: 'Nano', value: 1 },
      { label: 'Micro', value: 2 },
      { label: 'Mid', value: 3 },
      { label: 'Macro', value: 4 },
      { label: 'Mega', value: 5 },
    ],
    []
  );

  return (
    <div className="project-card overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Left: company + role summary */}
        <div className="md:w-1/3 space-y-3">
          <div className="flex justify-center items-center gap-3">
            <img src="/Ford-Symbol.png" alt="Ford Logo" className="h-16 w-auto" style={{  }} />
            <div className="flex flex-col items-start">
              <span className="font-semibold text-left">Experience</span>
              <span className="text-sm text-muted-foreground text-left">Aftermarket Vehicle Personalization Intern • Ford Motor Company</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Summer 2024</span>
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Detroit, MI · On‑site</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            Supported Ford Performance aftermarket through marketing and sales operations. Improved team efficiency, standardized processes, and contributed to new product experiences.
          </p>
        </div>

        {/* Right: interactive highlights */}
        <div className="md:flex-1">
          {/* Tab/Milestone selector */}
          <div className="flex gap-2 flex-wrap">
            {milestones.map((ms, i) => (
              <button
                key={ms.key}
                onClick={() => setActive(i)}
                className={`px-3 py-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center ${
                  i === active
                    ? 'border-minimal-accent bg-minimal-accent/10 text-foreground'
                    : 'border-minimal-border hover:border-minimal-accent/50 text-foreground/80'
                }`}
                type="button"
                aria-pressed={i === active}
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {ms.icon}
                  <span className="hidden sm:inline">{ms.title}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Active panel */}
          <div className="mt-4 p-4 rounded-lg border border-minimal-border bg-card/40">
            <div className="text-sm text-foreground/90 mb-3 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-minimal-accent" />
              <span className="font-medium">{m.title}</span>
              <span className="text-xs text-muted-foreground">• {m.metric}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{m.blurb}</p>

            {/* Contextual mini-visuals per milestone */}
            {m.key === 'sipoc' && (
              <div className="grid grid-cols-5 gap-2">
                {['Supplier','Input','Process','Output','Customer'].map((stage, idx) => (
                  <div
                    key={stage}
                    className="relative p-3 rounded-md border border-minimal-border bg-black/30 overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-minimal-accent/20 translate-x-[-100%] hover:translate-x-0 transition-transform duration-500"
                      aria-hidden
                    />
                    <div
                      className="text-center font-mono text-foreground/90"
                      style={{ fontSize: 'clamp(0.65rem, 2vw, 1rem)', wordBreak: 'break-word' }}
                    >
                      {stage}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {m.key === 'wraps' && (
              <div className="flex items-center gap-2 flex-wrap">
                {['Legal', 'Safety', 'Brand', 'Materials'].map((b) => (
                  <span key={b} className="px-2 py-1 rounded-md border border-minimal-border text-[10px] uppercase tracking-wide bg-black/30">
                    {b} ✓
                  </span>
                ))}
              </div>
            )}
            {m.key === 'package' && (
              <div className="grid grid-cols-3 gap-2">
                {['Naming', 'CX', 'Launch'].map((k, i) => (
                  <div key={k} className="p-3 rounded-md border border-minimal-border bg-black/30">
                    <div className="text-xs font-semibold text-foreground/90">{k}</div>
                    <div className="mt-1 h-1.5 bg-minimal-accent/20 rounded">
                      <div className="h-full bg-minimal-accent rounded" style={{ width: `${(i + 2) * 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {m.key === 'influencer' && (
              <div className="flex items-end gap-2 h-24">
                {tierData.map((t, i) => (
                  <div key={t.label} className="flex-1">
                    <div
                      className="w-full bg-minimal-accent/30 rounded-t"
                      style={{ height: `${t.value * 16}px` }}
                      title={`${t.label}`}
                    />
                    <div className="text-[10px] text-center mt-1 text-muted-foreground">{t.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
