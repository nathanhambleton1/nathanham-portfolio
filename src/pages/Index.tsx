import { useEffect } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Cpu,
  Download,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  ShieldCheck,
  Wrench,
  Zap,
} from "lucide-react";

const experience = [
  {
    role: "Aftermarket Vehicle Personalization Intern",
    org: "Ford Motor Company",
    period: "Summer 2024",
    image: "/Ford-Symbol.png",
    points: [
      "Built an automated notifier as parts moved through SIPOC stages, reducing gaps between planning, marketing, and supply chain teams.",
      "Supported vehicle wrap customization work, coordinating with legal and safety partners to keep the customer experience compliant.",
      "Developed an influencer pricing model to standardize compensation across platforms and creator tiers.",
    ],
  },
  {
    role: "High Voltage Systems Lead",
    org: "SolarPack at NC State",
    period: "2025 - Present",
    image: "/sun.png",
    points: [
      "Led high-voltage battery pack reconfiguration from 20 kWh to 15 kWh for updated race regulations.",
      "Maintained BMS, motor controller, charging, and isolation strategy for safe solar vehicle operation.",
      "Coordinated a 10-student electrical subteam through design, fabrication, testing, and race preparation.",
    ],
  },
];

const projects = [
  {
    title: "Drink Machine",
    summary:
      "Automated beverage dispensing system with custom PCBs, ESP32 firmware, calibrated pumps, and a React Native control app.",
    tags: ["PCB Design", "ESP32", "React Native", "IoT"],
    image: "/liquorbot_overlay.png",
  },
  {
    title: "Solar Car Telemetry",
    summary:
      "Vehicle telemetry and control tooling for SolarPack, spanning CAN data, mobile dashboards, remote monitoring, and race operations.",
    tags: ["CAN Bus", "Telemetry", "Mobile App", "Systems"],
    image: "/apppreview_blank.png",
  },
  {
    title: "Electric Skateboard",
    summary:
      "Dual-motor electric skateboard build using FOC motor controllers, custom lithium-ion battery work, BMS setup, and PWM throttle control.",
    tags: ["FOC", "Battery Pack", "BMS", "Controls"],
    image: "/bcu.png",
  },
  {
    title: "FPV Racing Drone",
    summary:
      "Custom FPV quad builds with soldered ESC/flight-controller stacks, radio setup, analog video, tuning, and repair workflows.",
    tags: ["Soldering", "ESC/FC", "Radio", "Fabrication"],
    image: "/fcu.png",
  },
];

const skills = [
  "Embedded systems",
  "Circuit design",
  "Power electronics",
  "Battery systems",
  "CAN bus",
  "React",
  "React Native",
  "Product development",
  "Technical communication",
  "Content operations",
];

const education = [
  "B.S. Electrical and Electronics Engineering, NC State University, 2022-2026",
  "Focus areas: embedded systems, circuit design, power electronics, signal processing, robotics, and controls.",
  "Dean's List: Fall 2022, Spring 2023, Spring 2024, Fall 2024.",
];

const SectionHeading = ({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) => (
  <div className="mb-8">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/50">
      {eyebrow}
    </p>
    <h2 className="text-3xl font-semibold text-foreground md:text-4xl">{title}</h2>
  </div>
);

const Index = () => {
  useEffect(() => {
    document.title = "Nathan Hambleton | Electrical Engineer";

    const description =
      "Electrical engineering portfolio for Nathan Hambleton, focused on embedded systems, power electronics, product development, and technical leadership.";
    const metaDescription = document.querySelector("meta[name='description']");
    metaDescription?.setAttribute("content", description);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-minimal-border bg-background/92 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <a href="/" className="flex items-center gap-3" aria-label="Nathan Hambleton home">
            <img
              src="/logo.png"
              alt=""
              className="h-9 w-9 rounded-md border border-minimal-border bg-card object-contain"
            />
            <span className="text-sm font-semibold">Nathan Hambleton</span>
          </a>
          <div className="hidden items-center gap-5 text-sm text-foreground/70 md:flex">
            <a href="#experience" className="hover:text-foreground">Experience</a>
            <a href="#projects" className="hover:text-foreground">Projects</a>
            <a href="#resume" className="hover:text-foreground">Resume</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </div>
          <a
            href="mailto:nhambleton@ncsu.edu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-minimal-border hover:border-foreground/40"
            aria-label="Email Nathan Hambleton"
          >
            <Mail className="h-4 w-4" />
          </a>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_340px] md:px-6">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-minimal-border px-3 py-2 text-xs uppercase tracking-[0.18em] text-foreground/60">
            <ShieldCheck className="h-4 w-4" />
            Electrical Engineer
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground md:text-6xl">
            Embedded systems, power electronics, and product work built with practical engineering judgment.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-foreground/72 md:text-lg">
            I am Nathan Hambleton, an electrical engineering student at NC State
            with hands-on experience across solar vehicle systems, custom electronics,
            mobile apps, automation, and technical content.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#projects"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-foreground/88"
            >
              View Projects
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="/Nathan-Hambleton-Resume.html"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-minimal-border px-5 py-3 text-sm font-semibold text-foreground hover:border-foreground/40"
            >
              Resume
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>

        <aside className="mx-auto w-full max-w-[340px]">
          <img
            src="/Headshot%20small.png"
            alt="Nathan Hambleton"
            className="aspect-square w-full rounded-md border border-minimal-border object-cover shadow-minimal"
            loading="eager"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <a
              href="https://www.linkedin.com/in/nathanhambleton/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-minimal-border px-3 py-3 hover:border-foreground/40"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
            <a
              href="https://github.com/nathanhambleton1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-minimal-border px-3 py-3 hover:border-foreground/40"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </aside>
      </section>

      <section id="experience" className="border-t border-minimal-border px-4 py-16 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Experience" title="Work That Translates Across Teams" />
          <div className="grid gap-5 md:grid-cols-2">
            {experience.map((item) => (
              <article key={item.role} className="rounded-md border border-minimal-border bg-card p-6">
                <div className="mb-5 flex items-start gap-4">
                  <img
                    src={item.image}
                    alt=""
                    className="h-12 w-12 rounded-md border border-minimal-border bg-background object-contain p-1"
                    loading="lazy"
                  />
                  <div>
                    <h3 className="text-xl font-semibold">{item.role}</h3>
                    <p className="mt-1 text-sm text-foreground/60">
                      {item.org} | {item.period}
                    </p>
                  </div>
                </div>
                <ul className="space-y-3 text-sm leading-7 text-foreground/74">
                  {item.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-foreground/70" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="projects" className="border-t border-minimal-border px-4 py-16 md:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Projects" title="Selected Engineering Builds" />
          <div className="grid gap-5 md:grid-cols-2">
            {projects.map((project) => (
              <article key={project.title} className="overflow-hidden rounded-md border border-minimal-border bg-card">
                <img
                  src={project.image}
                  alt=""
                  className="h-48 w-full border-b border-minimal-border bg-background object-contain p-5"
                  loading="lazy"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold">{project.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/74">{project.summary}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-minimal-border px-2.5 py-1 text-xs text-foreground/68"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="resume" className="border-t border-minimal-border px-4 py-16 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading eyebrow="Resume" title="Professional Snapshot" />
          <div className="grid gap-5">
            <article className="rounded-md border border-minimal-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <GraduationCap className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Education</h3>
              </div>
              <ul className="space-y-3 text-sm leading-7 text-foreground/74">
                {education.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-md border border-minimal-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <Cpu className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md border border-minimal-border px-3 py-1.5 text-xs text-foreground/72"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </article>
            <article className="rounded-md border border-minimal-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <BriefcaseBusiness className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Strengths</h3>
              </div>
              <p className="text-sm leading-7 text-foreground/74">
                I work comfortably between hardware, software, and people: turning
                ambiguous product needs into working systems, test plans, documentation,
                and cross-functional execution.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-minimal-border px-4 py-16 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/50">
              Contact
            </p>
            <h2 className="text-3xl font-semibold md:text-4xl">Available for engineering internships and product-focused technical roles.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/70">
              The site is intentionally static and lightweight so hiring teams can
              access it from stricter enterprise networks.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="mailto:nhambleton@ncsu.edu"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-foreground/88"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
            <a
              href="https://github.com/nathanhambleton1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-minimal-border px-5 py-3 text-sm font-semibold hover:border-foreground/40"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-minimal-border px-4 py-8 text-center text-xs text-foreground/50 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
          <span>Copyright {new Date().getFullYear()} Nathan Hambleton</span>
          <span className="inline-flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5" />
            Static React portfolio on GitHub Pages
          </span>
          <span className="inline-flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            nathanham.tech
          </span>
        </div>
      </footer>
    </main>
  );
};

export default Index;
