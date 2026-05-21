import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Gauge,
  HardHat,
  Search,
  Truck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Fleet & tire data (real OEM equipment + market tire fitments)     */
/* ------------------------------------------------------------------ */

type Vehicle = {
  id: string;
  make: string;
  model: string;
  unit: string;
  type:
    | "Haul Truck"
    | "Wheel Loader"
    | "Articulated Hauler"
    | "Motor Grader"
    | "Dozer"
    | "Scraper"
    | "Excavator"
    | "Compactor";
  tireSize: string;
  recommendedTire: string;
  recPsi: number;
  recTreadMm: number;
};

const FLEET: Vehicle[] = [
  // Caterpillar
  { id: "cat-797f-04", make: "Caterpillar", model: "797F",  unit: "Unit #04", type: "Haul Truck",         tireSize: "59/80R63",   recommendedTire: "Michelin XDR3 / Continental RDT-Master",   recPsi: 102, recTreadMm: 90 },
  { id: "cat-793f-11", make: "Caterpillar", model: "793F",  unit: "Unit #11", type: "Haul Truck",         tireSize: "40.00R57",   recommendedTire: "Goodyear RL-5K II",                        recPsi:  95, recTreadMm: 82 },
  { id: "cat-789d-07", make: "Caterpillar", model: "789D",  unit: "Unit #07", type: "Haul Truck",         tireSize: "37.00R57",   recommendedTire: "Bridgestone VELS",                         recPsi:  92, recTreadMm: 78 },
  { id: "cat-777g-22", make: "Caterpillar", model: "777G",  unit: "Unit #22", type: "Haul Truck",         tireSize: "27.00R49",   recommendedTire: "Continental RDT-Master",                   recPsi: 100, recTreadMm: 70 },
  { id: "cat-775g-18", make: "Caterpillar", model: "775G",  unit: "Unit #18", type: "Haul Truck",         tireSize: "24.00R35",   recommendedTire: "Yokohama RB42",                            recPsi:  90, recTreadMm: 64 },
  { id: "cat-988k-12", make: "Caterpillar", model: "988K",  unit: "Unit #12", type: "Wheel Loader",       tireSize: "35/65R33",   recommendedTire: "Continental MasterIncin",                  recPsi:  85, recTreadMm: 72 },
  { id: "cat-980m-09", make: "Caterpillar", model: "980M",  unit: "Unit #09", type: "Wheel Loader",       tireSize: "29.5R25",    recommendedTire: "Bridgestone VRLS",                         recPsi:  75, recTreadMm: 60 },
  { id: "cat-966m-31", make: "Caterpillar", model: "966M",  unit: "Unit #31", type: "Wheel Loader",       tireSize: "26.5R25",    recommendedTire: "Michelin X-Mine D2",                       recPsi:  72, recTreadMm: 55 },
  { id: "cat-950m-44", make: "Caterpillar", model: "950M",  unit: "Unit #44", type: "Wheel Loader",       tireSize: "23.5R25",    recommendedTire: "Goodyear RM-4A+",                          recPsi:  65, recTreadMm: 50 },
  { id: "cat-740-ej-02", make: "Caterpillar", model: "740 EJ", unit: "Unit #02", type: "Articulated Hauler", tireSize: "29.5R25", recommendedTire: "BKT Earthmax SR 41",                       recPsi:  70, recTreadMm: 58 },
  { id: "cat-16m3-05", make: "Caterpillar", model: "16M3", unit: "Unit #05", type: "Motor Grader",        tireSize: "20.5R25",    recommendedTire: "Michelin XGLA2",                           recPsi:  55, recTreadMm: 42 },
  { id: "cat-d11t-01", make: "Caterpillar", model: "D11T",  unit: "Unit #01", type: "Dozer",              tireSize: "Track",      recommendedTire: "N/A – Tracked",                            recPsi:   0, recTreadMm:  0 },

  // Komatsu
  { id: "kom-930e5-03", make: "Komatsu",     model: "930E-5", unit: "Unit #03", type: "Haul Truck",       tireSize: "53/80R63",   recommendedTire: "Bridgestone VRDP",                         recPsi: 100, recTreadMm: 88 },
  { id: "kom-960e-2-08", make: "Komatsu",   model: "960E-2", unit: "Unit #08", type: "Haul Truck",        tireSize: "59/80R63",   recommendedTire: "Michelin XDR3",                            recPsi: 105, recTreadMm: 92 },
  { id: "kom-hd785-15", make: "Komatsu",     model: "HD785-8", unit: "Unit #15", type: "Haul Truck",      tireSize: "27.00R49",   recommendedTire: "Continental RDT-Master",                   recPsi:  98, recTreadMm: 70 },
  { id: "kom-hd465-23", make: "Komatsu",     model: "HD465-8", unit: "Unit #23", type: "Haul Truck",      tireSize: "21.00R35",   recommendedTire: "Goodyear RL-4K",                           recPsi:  85, recTreadMm: 56 },
  { id: "kom-wa500-19", make: "Komatsu",     model: "WA500-8", unit: "Unit #19", type: "Wheel Loader",    tireSize: "29.5R25",    recommendedTire: "Bridgestone VRLS",                         recPsi:  75, recTreadMm: 60 },
  { id: "kom-wa470-33", make: "Komatsu",     model: "WA470-8", unit: "Unit #33", type: "Wheel Loader",    tireSize: "26.5R25",    recommendedTire: "Michelin X-Mine D2",                       recPsi:  70, recTreadMm: 54 },
  { id: "kom-wa380-41", make: "Komatsu",     model: "WA380-8", unit: "Unit #41", type: "Wheel Loader",    tireSize: "20.5R25",    recommendedTire: "BKT Earthmax SR 53",                       recPsi:  60, recTreadMm: 44 },
  { id: "kom-gd675-06", make: "Komatsu",     model: "GD675-7", unit: "Unit #06", type: "Motor Grader",    tireSize: "17.5R25",    recommendedTire: "Michelin XGLA2",                           recPsi:  50, recTreadMm: 38 },

  // Volvo CE
  { id: "vol-a60h-10",  make: "Volvo CE",    model: "A60H",  unit: "Unit #10", type: "Articulated Hauler", tireSize: "33.00R51",  recommendedTire: "Michelin X-Mine D2 PRO",                   recPsi:  90, recTreadMm: 76 },
  { id: "vol-a45g-21",  make: "Volvo CE",    model: "A45G",  unit: "Unit #21", type: "Articulated Hauler", tireSize: "29.5R25",   recommendedTire: "BKT Earthmax SR 41",                       recPsi:  70, recTreadMm: 60 },
  { id: "vol-a40g-29",  make: "Volvo CE",    model: "A40G",  unit: "Unit #29", type: "Articulated Hauler", tireSize: "29.5R25",   recommendedTire: "Continental EM-Master",                    recPsi:  68, recTreadMm: 58 },
  { id: "vol-l350h-13", make: "Volvo CE",    model: "L350H", unit: "Unit #13", type: "Wheel Loader",      tireSize: "35/65R33",   recommendedTire: "Michelin XHA2",                            recPsi:  82, recTreadMm: 72 },
  { id: "vol-l260h-26", make: "Volvo CE",    model: "L260H", unit: "Unit #26", type: "Wheel Loader",      tireSize: "29.5R25",    recommendedTire: "Bridgestone VRLS",                         recPsi:  74, recTreadMm: 58 },
  { id: "vol-l180h-37", make: "Volvo CE",    model: "L180H", unit: "Unit #37", type: "Wheel Loader",      tireSize: "26.5R25",    recommendedTire: "Goodyear RL-4K",                           recPsi:  68, recTreadMm: 52 },
  { id: "vol-l120h-42", make: "Volvo CE",    model: "L120H", unit: "Unit #42", type: "Wheel Loader",      tireSize: "23.5R25",    recommendedTire: "Goodyear RM-4A+",                          recPsi:  62, recTreadMm: 48 },

  // Liebherr
  { id: "lie-t282c-14", make: "Liebherr",    model: "T 282C", unit: "Unit #14", type: "Haul Truck",       tireSize: "59/80R63",   recommendedTire: "Michelin XDR3",                            recPsi: 105, recTreadMm: 92 },
  { id: "lie-t264-25",  make: "Liebherr",    model: "T 264", unit: "Unit #25", type: "Haul Truck",       tireSize: "53/80R63",   recommendedTire: "Bridgestone VRDP",                         recPsi: 100, recTreadMm: 88 },
  { id: "lie-l586-32",  make: "Liebherr",    model: "L 586 XPower", unit: "Unit #32", type: "Wheel Loader", tireSize: "29.5R25", recommendedTire: "Continental MasterIncin",                  recPsi:  76, recTreadMm: 60 },

  // Hitachi
  { id: "hit-eh5000-17",make: "Hitachi",     model: "EH5000AC-3", unit: "Unit #17", type: "Haul Truck",   tireSize: "53/80R63",   recommendedTire: "Bridgestone VRDP",                         recPsi:  98, recTreadMm: 86 },
  { id: "hit-eh4000-28",make: "Hitachi",     model: "EH4000AC-3", unit: "Unit #28", type: "Haul Truck",   tireSize: "46/90R57",   recommendedTire: "Michelin XDR3",                            recPsi:  95, recTreadMm: 84 },
  { id: "hit-eh3500-36",make: "Hitachi",     model: "EH3500AC-3", unit: "Unit #36", type: "Haul Truck",   tireSize: "40.00R57",   recommendedTire: "Goodyear RL-5K II",                        recPsi:  92, recTreadMm: 80 },

  // John Deere
  { id: "jd-644l-20",   make: "John Deere",  model: "644L",  unit: "Unit #20", type: "Wheel Loader",      tireSize: "23.5R25",    recommendedTire: "Goodyear RM-4A+",                          recPsi:  60, recTreadMm: 48 },
  { id: "jd-844l-34",   make: "John Deere",  model: "844L",  unit: "Unit #34", type: "Wheel Loader",      tireSize: "29.5R25",    recommendedTire: "Bridgestone VRLS",                         recPsi:  72, recTreadMm: 58 },
  { id: "jd-460e-38",   make: "John Deere",  model: "460E-II", unit: "Unit #38", type: "Articulated Hauler", tireSize: "29.5R25",recommendedTire: "BKT Earthmax SR 41",                       recPsi:  68, recTreadMm: 56 },

  // Bell
  { id: "bel-b45e-24",  make: "Bell",        model: "B45E",  unit: "Unit #24", type: "Articulated Hauler", tireSize: "29.5R25",   recommendedTire: "BKT Earthmax SR 41",                       recPsi:  70, recTreadMm: 58 },
  { id: "bel-b30e-39",  make: "Bell",        model: "B30E",  unit: "Unit #39", type: "Articulated Hauler", tireSize: "23.5R25",   recommendedTire: "Goodyear RM-4A+",                          recPsi:  60, recTreadMm: 48 },

  // Doosan / Develon
  { id: "dev-dl550-7-43", make: "Develon",   model: "DL550-7", unit: "Unit #43", type: "Wheel Loader",    tireSize: "29.5R25",    recommendedTire: "Continental MasterIncin",                  recPsi:  74, recTreadMm: 60 },
  { id: "dev-da45-7-40", make: "Develon",    model: "DA45-7", unit: "Unit #40", type: "Articulated Hauler", tireSize: "29.5R25", recommendedTire: "BKT Earthmax SR 41",                       recPsi:  68, recTreadMm: 56 },

  // CASE / Liugong
  { id: "case-1121g-45",make: "CASE",        model: "1121G", unit: "Unit #45", type: "Wheel Loader",      tireSize: "26.5R25",    recommendedTire: "Goodyear RL-4K",                           recPsi:  68, recTreadMm: 52 },
];

/* ------------------------------------------------------------------ */
/*  Tire positions — keep a clean 4-corner walkaround per spec        */
/* ------------------------------------------------------------------ */

type TirePos = "FL" | "FR" | "RR" | "RL";
const WALK_ORDER: TirePos[] = ["FL", "FR", "RR", "RL"];
const POS_LABEL: Record<TirePos, string> = {
  FL: "Front Left",
  FR: "Front Right",
  RR: "Rear Right",
  RL: "Rear Left",
};

type TireRecord = {
  treadMm: string;
  psi: string;
  photo: boolean;
  notes: string;
};

const blankTire = (): TireRecord => ({ treadMm: "", psi: "", photo: false, notes: "" });

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type Step = "search" | "inspect" | "summary";

export default function TireInspection() {
  /* Inject Google Fonts once */
  useEffect(() => {
    const id = "tire-insp-fonts";
    if (document.getElementById(id)) return;
    const l1 = document.createElement("link");
    l1.rel = "preconnect";
    l1.href = "https://fonts.googleapis.com";
    const l2 = document.createElement("link");
    l2.rel = "preconnect";
    l2.href = "https://fonts.gstatic.com";
    l2.crossOrigin = "anonymous";
    const l3 = document.createElement("link");
    l3.id = id;
    l3.rel = "stylesheet";
    l3.href =
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap";
    document.head.append(l1, l2, l3);
  }, []);

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [tireIdx, setTireIdx] = useState(0); // 0..3
  const [records, setRecords] = useState<Record<TirePos, TireRecord>>({
    FL: blankTire(),
    FR: blankTire(),
    RR: blankTire(),
    RL: blankTire(),
  });
  const [reportOpen, setReportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FLEET.slice(0, 8);
    return FLEET.filter((v) =>
      [v.make, v.model, v.unit, v.type, v.tireSize, v.id]
        .join(" ")
        .toLowerCase()
        .includes(q),
    ).slice(0, 12);
  }, [query]);

  const currentPos = WALK_ORDER[tireIdx];
  const completedCount = WALK_ORDER.filter((p) => records[p].treadMm !== "").length;

  const startInspection = (v: Vehicle) => {
    setVehicle(v);
    setRecords({ FL: blankTire(), FR: blankTire(), RR: blankTire(), RL: blankTire() });
    setTireIdx(0);
    setStep("inspect");
  };

  const updateCurrent = (patch: Partial<TireRecord>) => {
    setRecords((r) => ({ ...r, [currentPos]: { ...r[currentPos], ...patch } }));
  };

  const nextTire = () => {
    if (tireIdx < 3) setTireIdx((i) => i + 1);
    else setStep("summary");
  };

  const resetAll = () => {
    setStep("search");
    setVehicle(null);
    setTireIdx(0);
    setRecords({ FL: blankTire(), FR: blankTire(), RR: blankTire(), RL: blankTire() });
    setReportOpen(false);
  };

  return (
    <div className="tire-app-root">
      <style>{CSS}</style>

      {/* iPhone-style frame */}
      <div className="phone-shell">
        <div className="phone-notch" aria-hidden />
        <div className="phone-screen">
          <Noise />

          <AnimatePresence mode="wait">
            {step === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="screen"
              >
                <SearchScreen
                  query={query}
                  setQuery={setQuery}
                  results={filtered}
                  onStart={startInspection}
                />
              </motion.div>
            )}

            {step === "inspect" && vehicle && (
              <motion.div
                key="inspect"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="screen"
              >
                <InspectScreen
                  vehicle={vehicle}
                  tireIdx={tireIdx}
                  records={records}
                  onBack={() => setStep("search")}
                  onUpdate={updateCurrent}
                  onNext={nextTire}
                  completedCount={completedCount}
                />
              </motion.div>
            )}

            {step === "summary" && vehicle && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="screen"
              >
                <SummaryScreen
                  vehicle={vehicle}
                  records={records}
                  onBack={() => setStep("inspect")}
                  onReset={resetAll}
                  onReport={() => setReportOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {reportOpen && vehicle && (
              <ReportModal
                vehicle={vehicle}
                records={records}
                onClose={() => setReportOpen(false)}
                onNewInspection={resetAll}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="phone-bar" aria-hidden />
      </div>

      <div className="hint">
        <span className="kbd">Concept demo</span>
        <span>Mobile-first field inspection · 390×844 viewport</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Screens                                                            */
/* ------------------------------------------------------------------ */

function SearchScreen({
  query,
  setQuery,
  results,
  onStart,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Vehicle[];
  onStart: (v: Vehicle) => void;
}) {
  const [picked, setPicked] = useState<Vehicle | null>(null);

  return (
    <div className="pad">
      <Header subtitle="Field Inspection" />

      <h1 className="h1">Select equipment</h1>
      <p className="muted">Search by unit number, make, or model. Tap to select, then start the walk-around.</p>

      <label className="search">
        <Search size={18} strokeWidth={2.4} />
        <input
          inputMode="search"
          placeholder="Unit #04, 797F, Komatsu…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="chips">
        {["Haul Truck", "Wheel Loader", "Articulated Hauler", "Motor Grader"].map((t) => (
          <button
            key={t}
            className="chip"
            onClick={() => setQuery(t)}
            type="button"
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="list">
        {results.map((v) => {
          const isPicked = picked?.id === v.id;
          return (
            <li key={v.id}>
              <button
                type="button"
                className={`vehicle ${isPicked ? "vehicle--picked" : ""}`}
                onClick={() => setPicked(v)}
              >
                <span className="vehicle__icon">
                  <Truck size={22} strokeWidth={2.2} />
                </span>
                <span className="vehicle__body">
                  <span className="vehicle__title">
                    {v.make} {v.model}
                  </span>
                  <span className="vehicle__sub">
                    {v.type} · {v.unit}
                  </span>
                  <span className="vehicle__meta">
                    {v.tireSize} · {v.recommendedTire}
                  </span>
                </span>
                <ChevronRight size={20} className="vehicle__chev" />
              </button>
            </li>
          );
        })}
        {results.length === 0 && (
          <li className="empty">No equipment matches "{query}".</li>
        )}
      </ul>

      <button
        type="button"
        className="cta cta--primary"
        disabled={!picked}
        onClick={() => picked && onStart(picked)}
      >
        <HardHat size={20} strokeWidth={2.4} />
        {picked ? `Start inspection · ${picked.unit}` : "Select a unit to begin"}
      </button>
    </div>
  );
}

function InspectScreen({
  vehicle,
  tireIdx,
  records,
  onBack,
  onUpdate,
  onNext,
  completedCount,
}: {
  vehicle: Vehicle;
  tireIdx: number;
  records: Record<TirePos, TireRecord>;
  onBack: () => void;
  onUpdate: (p: Partial<TireRecord>) => void;
  onNext: () => void;
  completedCount: number;
}) {
  const pos = WALK_ORDER[tireIdx];
  const rec = records[pos];
  const treadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    treadRef.current?.focus({ preventScroll: true });
  }, [pos]);

  const isValid = rec.treadMm !== "" && Number(rec.treadMm) >= 0;
  const treadNum = Number(rec.treadMm);
  const recTread = vehicle.recTreadMm;
  let treadHealth: "ok" | "warn" | "bad" | null = null;
  if (rec.treadMm !== "" && recTread > 0) {
    const pct = treadNum / recTread;
    if (pct >= 0.5) treadHealth = "ok";
    else if (pct >= 0.25) treadHealth = "warn";
    else treadHealth = "bad";
  }

  return (
    <div className="pad">
      <button className="back" onClick={onBack} type="button">
        <ArrowLeft size={18} /> <span>Equipment</span>
      </button>

      <div className="vehicle-bar">
        <div>
          <div className="vehicle-bar__title">{vehicle.make} {vehicle.model}</div>
          <div className="vehicle-bar__sub">{vehicle.unit} · {vehicle.tireSize}</div>
        </div>
        <div className="vehicle-bar__badge">{vehicle.type}</div>
      </div>

      <Progress current={tireIdx + 1} total={4} completed={completedCount} />

      <VehicleDiagram
        currentPos={pos}
        records={records}
      />

      <div className="tire-head">
        <div>
          <div className="tire-head__eyebrow">Inspecting</div>
          <div className="tire-head__title">{POS_LABEL[pos]} <span className="muted">({pos})</span></div>
        </div>
        <div className="tire-head__spec">
          <Gauge size={14} /> Rec {vehicle.recTreadMm}mm · {vehicle.recPsi} PSI
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="tread">
          Tread depth <span className="muted">(mm)</span>
        </label>
        <div className={`bignum bignum--${treadHealth ?? "neutral"}`}>
          <input
            id="tread"
            ref={treadRef}
            inputMode="decimal"
            type="text"
            placeholder="0.0"
            value={rec.treadMm}
            onChange={(e) =>
              onUpdate({ treadMm: e.target.value.replace(/[^0-9.]/g, "").slice(0, 5) })
            }
          />
          <span className="bignum__unit">mm</span>
        </div>
        {treadHealth && (
          <div className={`health health--${treadHealth}`}>
            {treadHealth === "ok" && "Within service spec"}
            {treadHealth === "warn" && "Monitor — below 50% of recommended"}
            {treadHealth === "bad" && "Replace — under 25% of recommended"}
          </div>
        )}
      </div>

      <div className="row">
        <div className="field field--half">
          <label className="field__label" htmlFor="psi">
            PSI <span className="muted">(optional)</span>
          </label>
          <input
            id="psi"
            inputMode="numeric"
            type="text"
            placeholder={`${vehicle.recPsi}`}
            value={rec.psi}
            onChange={(e) =>
              onUpdate({ psi: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })
            }
            className="smallnum"
          />
        </div>
        <button
          type="button"
          className={`photo ${rec.photo ? "photo--on" : ""}`}
          onClick={() => onUpdate({ photo: !rec.photo })}
        >
          <Camera size={22} strokeWidth={2.2} />
          <span>{rec.photo ? "Photo attached" : "Take photo"}</span>
        </button>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="notes">
          Notes <span className="muted">(optional)</span>
        </label>
        <textarea
          id="notes"
          placeholder="Sidewall cut, uneven wear, exposed cord…"
          value={rec.notes}
          onChange={(e) => onUpdate({ notes: e.target.value.slice(0, 140) })}
        />
      </div>

      <button
        type="button"
        className="cta cta--primary"
        disabled={!isValid}
        onClick={onNext}
      >
        {tireIdx < 3 ? (
          <>Next tire · {POS_LABEL[WALK_ORDER[tireIdx + 1]]}<ChevronRight size={20} /></>
        ) : (
          <>Finish walk-around <ClipboardCheck size={20} /></>
        )}
      </button>
    </div>
  );
}

function SummaryScreen({
  vehicle,
  records,
  onBack,
  onReset,
  onReport,
}: {
  vehicle: Vehicle;
  records: Record<TirePos, TireRecord>;
  onBack: () => void;
  onReset: () => void;
  onReport: () => void;
}) {
  const avgTread =
    WALK_ORDER.reduce((s, p) => s + Number(records[p].treadMm || 0), 0) / 4;
  const lowest = WALK_ORDER.reduce((acc, p) => {
    const n = Number(records[p].treadMm || 0);
    return n < acc.n ? { pos: p, n } : acc;
  }, { pos: "FL" as TirePos, n: Infinity });

  return (
    <div className="pad">
      <button className="back" onClick={onBack} type="button">
        <ArrowLeft size={18} /> <span>Back to inspection</span>
      </button>

      <div className="done-banner">
        <CheckCircle2 size={22} />
        <div>
          <div className="done-banner__t">Walk-around complete</div>
          <div className="done-banner__s">All 4 positions recorded</div>
        </div>
      </div>

      <div className="vehicle-bar">
        <div>
          <div className="vehicle-bar__title">{vehicle.make} {vehicle.model}</div>
          <div className="vehicle-bar__sub">{vehicle.unit} · {vehicle.tireSize}</div>
        </div>
        <div className="vehicle-bar__badge">{vehicle.type}</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat__v">{avgTread.toFixed(1)}<span>mm</span></div>
          <div className="stat__l">Avg tread</div>
        </div>
        <div className="stat">
          <div className="stat__v">{lowest.n.toFixed(1)}<span>mm</span></div>
          <div className="stat__l">Lowest · {lowest.pos}</div>
        </div>
        <div className="stat">
          <div className="stat__v">{vehicle.recTreadMm}<span>mm</span></div>
          <div className="stat__l">Spec</div>
        </div>
      </div>

      <VehicleDiagram currentPos={null} records={records} compact />

      <ul className="summary">
        {WALK_ORDER.map((p) => {
          const r = records[p];
          const n = Number(r.treadMm || 0);
          const pct = vehicle.recTreadMm ? n / vehicle.recTreadMm : 1;
          const status = pct >= 0.5 ? "ok" : pct >= 0.25 ? "warn" : "bad";
          return (
            <li key={p} className={`scard scard--${status}`}>
              <div className="scard__pos">{p}</div>
              <div className="scard__body">
                <div className="scard__row">
                  <span className="scard__label">{POS_LABEL[p]}</span>
                  <span className="scard__tread">{r.treadMm || "—"} <em>mm</em></span>
                </div>
                <div className="scard__meta">
                  PSI {r.psi || "—"} · {r.photo ? "Photo" : "No photo"}
                  {r.notes ? ` · "${r.notes}"` : ""}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button type="button" className="cta cta--primary cta--xl" onClick={onReport}>
        <FileText size={22} strokeWidth={2.4} />
        Generate report
      </button>
      <button type="button" className="cta cta--ghost" onClick={onReset}>
        Start new inspection
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header className="brandbar">
      <div className="brandbar__mark">
        <span className="brandbar__dot" />
        FIELD/01
      </div>
      <div className="brandbar__sub">{subtitle}</div>
    </header>
  );
}

function Progress({ current, total, completed }: { current: number; total: number; completed: number }) {
  return (
    <div className="progress">
      <div className="progress__head">
        <span className="progress__label">Tire {current} of {total}</span>
        <span className="progress__count">{completed}/{total} done</span>
      </div>
      <div className="progress__track">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`progress__seg ${i < completed ? "is-done" : ""} ${i === current - 1 ? "is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

function VehicleDiagram({
  currentPos,
  records,
  compact = false,
}: {
  currentPos: TirePos | null;
  records: Record<TirePos, TireRecord>;
  compact?: boolean;
}) {
  // Positions on a 200×280 canvas
  const layout: Record<TirePos, { x: number; y: number }> = {
    FL: { x: 28, y: 56 },
    FR: { x: 138, y: 56 },
    RL: { x: 28, y: 196 },
    RR: { x: 138, y: 196 },
  };
  return (
    <div className={`diagram ${compact ? "diagram--sm" : ""}`}>
      <svg viewBox="0 0 200 280" width="100%" height="100%" aria-hidden>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#F5A623" strokeWidth="1.2" opacity="0.18" />
          </pattern>
        </defs>

        {/* Ground hatch */}
        <rect x="0" y="0" width="200" height="280" fill="url(#hatch)" />

        {/* Chassis */}
        <rect x="44" y="36" width="112" height="208" rx="14" fill="#1a1c20" stroke="#2a2d33" strokeWidth="1.5" />
        <rect x="52" y="50" width="96" height="80" rx="6" fill="#0f1012" stroke="#2a2d33" strokeWidth="1" />
        <rect x="52" y="150" width="96" height="80" rx="6" fill="#0f1012" stroke="#2a2d33" strokeWidth="1" />

        {/* Centerline */}
        <line x1="100" y1="40" x2="100" y2="240" stroke="#2a2d33" strokeDasharray="3 5" strokeWidth="1" />

        {/* Direction arrow (front) */}
        <polygon points="100,18 92,32 108,32" fill="#F5A623" opacity="0.75" />
        <text x="100" y="14" textAnchor="middle" fontSize="8" fill="#F5A623" fontFamily="'DM Mono', monospace" letterSpacing="1">
          FRONT
        </text>

        {/* Tires */}
        {WALK_ORDER.map((p) => {
          const { x, y } = layout[p];
          const isCurrent = p === currentPos;
          const isDone = records[p].treadMm !== "";
          return (
            <g key={p} transform={`translate(${x}, ${y})`}>
              {isCurrent && (
                <circle
                  cx="17" cy="24" r="26"
                  fill="none" stroke="#F5A623" strokeWidth="2"
                  className="pulse"
                />
              )}
              <rect
                x="0" y="0" width="34" height="48" rx="6"
                fill={isCurrent ? "#F5A623" : isDone ? "#1f2228" : "#15171b"}
                stroke={isCurrent ? "#F5A623" : isDone ? "#3a8a4a" : "#2a2d33"}
                strokeWidth="1.5"
              />
              {/* Tread lines */}
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1={6 + i * 7} y1="6" x2={6 + i * 7} y2="42"
                  stroke={isCurrent ? "#0f1012" : isDone ? "#3a8a4a" : "#2a2d33"}
                  strokeWidth="1.2"
                  opacity={isCurrent ? 0.85 : 0.7}
                />
              ))}
              <text
                x="17" y="64" textAnchor="middle"
                fontSize="9" fontWeight="700"
                fill={isCurrent ? "#F5A623" : isDone ? "#9bd1a5" : "#9aa0a8"}
                fontFamily="'DM Mono', monospace" letterSpacing="1"
              >
                {p}
              </text>
              {isDone && !isCurrent && (
                <g transform="translate(22, -8)">
                  <circle r="7" fill="#1a3a22" stroke="#3a8a4a" strokeWidth="1.2" />
                  <path d="M-3 0 L-1 2 L3 -2" stroke="#9bd1a5" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportModal({
  vehicle,
  records,
  onClose,
  onNewInspection,
}: {
  vehicle: Vehicle;
  records: Record<TirePos, TireRecord>;
  onClose: () => void;
  onNewInspection: () => void;
}) {
  const now = new Date();
  const reportId =
    "INS-" +
    now.getFullYear().toString().slice(2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(Math.floor(Math.random() * 9000) + 1000);

  return (
    <motion.div
      className="modal-back"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <FileText size={18} />
          <span>Inspection report</span>
        </div>
        <div className="modal__id">{reportId}</div>
        <div className="modal__sub">
          {now.toLocaleDateString()} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>

        <div className="modal__sect">
          <div className="modal__label">Equipment</div>
          <div className="modal__val">{vehicle.make} {vehicle.model} — {vehicle.unit}</div>
          <div className="modal__meta">{vehicle.type} · {vehicle.tireSize}</div>
          <div className="modal__meta">Recommended: {vehicle.recommendedTire}</div>
        </div>

        <div className="modal__sect">
          <div className="modal__label">Readings</div>
          <table className="modal__table">
            <thead>
              <tr><th>Pos</th><th>Tread</th><th>PSI</th><th>Photo</th></tr>
            </thead>
            <tbody>
              {WALK_ORDER.map((p) => (
                <tr key={p}>
                  <td>{p}</td>
                  <td>{records[p].treadMm || "—"} mm</td>
                  <td>{records[p].psi || "—"}</td>
                  <td>{records[p].photo ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal__actions">
          <button className="cta cta--ghost" onClick={onClose}>Close</button>
          <button className="cta cta--primary" onClick={onNewInspection}>New inspection</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Noise() {
  // SVG fractal noise as a subtle texture overlay
  return (
    <svg className="noise" aria-hidden>
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#n)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
.tire-app-root {
  --bg: #0f1012;
  --bg-2: #15171b;
  --panel: #1a1c20;
  --panel-2: #1f2228;
  --line: #2a2d33;
  --line-2: #3a3e46;
  --ink: #ececec;
  --ink-dim: #9aa0a8;
  --ink-mute: #6b7079;
  --amber: #F5A623;
  --amber-2: #ffb946;
  --amber-ink: #1a1306;
  --ok: #3a8a4a;
  --ok-ink: #9bd1a5;
  --warn: #d18b1a;
  --bad: #b3392b;
  --bad-ink: #ff8a7a;

  min-height: 100vh;
  background:
    radial-gradient(1200px 700px at 50% -100px, #1a1c20 0%, #0a0b0d 60%, #07080a 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px 48px;
  color: var(--ink);
  font-family: 'Barlow Condensed', system-ui, sans-serif;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

.phone-shell {
  position: relative;
  width: 390px;
  max-width: 100%;
  height: 844px;
  max-height: calc(100vh - 80px);
  background: #000;
  border-radius: 48px;
  padding: 10px;
  box-shadow:
    0 0 0 1.5px #232529,
    0 0 0 8px #0a0b0d,
    0 30px 80px -20px rgba(0, 0, 0, 0.8);
  overflow: hidden;
}
.phone-notch {
  position: absolute;
  top: 18px; left: 50%; transform: translateX(-50%);
  width: 110px; height: 28px;
  background: #000;
  border-radius: 20px;
  z-index: 30;
  pointer-events: none;
}
.phone-bar {
  position: absolute;
  bottom: 8px; left: 50%; transform: translateX(-50%);
  width: 120px; height: 4px;
  background: #2a2d33;
  border-radius: 2px;
  z-index: 30;
}
.phone-screen {
  position: relative;
  width: 100%; height: 100%;
  background: var(--bg);
  border-radius: 38px;
  overflow: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}
.phone-screen::-webkit-scrollbar { display: none; }

.noise {
  position: absolute; inset: 0; width: 100%; height: 100%;
  opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  z-index: 1;
}

.screen { position: relative; z-index: 2; min-height: 100%; }

.pad {
  padding: 56px 20px 32px;
  display: flex; flex-direction: column; gap: 16px;
}

/* Brand bar */
.brandbar {
  display: flex; align-items: center; justify-content: space-between;
  font-family: 'DM Mono', monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ink-dim);
}
.brandbar__mark {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--amber); font-weight: 600;
}
.brandbar__dot {
  width: 8px; height: 8px; background: var(--amber); border-radius: 1px;
  box-shadow: 0 0 0 2px rgba(245,166,35,0.18);
}

.h1 {
  font-family: 'Syne', 'Barlow Condensed', sans-serif;
  font-weight: 800; font-size: 34px; line-height: 1.02;
  letter-spacing: -0.01em; margin: 4px 0 0;
  text-transform: uppercase;
}
.muted { color: var(--ink-dim); font-size: 14px; line-height: 1.35; }

/* Search */
.search {
  display: flex; align-items: center; gap: 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 14px;
  color: var(--ink-dim);
}
.search input {
  flex: 1; background: transparent; border: 0; outline: 0;
  color: var(--ink); font-family: inherit; font-size: 17px;
  letter-spacing: 0.01em;
}
.search input::placeholder { color: var(--ink-mute); }

.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
.chip {
  flex: 0 0 auto;
  font-family: 'DM Mono', monospace;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
  padding: 8px 12px; border-radius: 999px;
  background: var(--panel); color: var(--ink-dim);
  border: 1px solid var(--line); cursor: pointer;
}
.chip:hover { color: var(--amber); border-color: var(--amber); }

/* List */
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.vehicle {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 14px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 12px; text-align: left; color: var(--ink);
  cursor: pointer; transition: border-color 120ms, background 120ms, transform 80ms;
  font-family: inherit;
}
.vehicle:active { transform: scale(0.99); }
.vehicle--picked {
  border-color: var(--amber);
  background: linear-gradient(180deg, rgba(245,166,35,0.08), rgba(245,166,35,0.02));
  box-shadow: inset 0 0 0 1px rgba(245,166,35,0.35);
}
.vehicle__icon {
  display: grid; place-items: center;
  width: 40px; height: 40px;
  background: var(--bg-2); color: var(--amber);
  border: 1px solid var(--line); border-radius: 8px;
}
.vehicle--picked .vehicle__icon { background: var(--amber); color: var(--amber-ink); border-color: var(--amber); }
.vehicle__body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.vehicle__title { font-weight: 700; font-size: 18px; letter-spacing: 0.01em; line-height: 1.1; }
.vehicle__sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-dim); letter-spacing: 0.06em; }
.vehicle__meta { font-size: 12px; color: var(--ink-mute); letter-spacing: 0.02em; }
.vehicle__chev { color: var(--ink-mute); }
.vehicle--picked .vehicle__chev { color: var(--amber); }
.empty {
  text-align: center; padding: 18px; color: var(--ink-mute);
  border: 1px dashed var(--line); border-radius: 12px;
}

/* CTA */
.cta {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 10px; width: 100%; padding: 18px 18px;
  border-radius: 14px; border: 0; cursor: pointer;
  font-family: 'Syne', 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 17px; letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: transform 80ms, filter 120ms, background 120ms;
  margin-top: 4px;
}
.cta:active { transform: scale(0.99); }
.cta:disabled { opacity: 0.45; cursor: not-allowed; }
.cta--primary {
  background: var(--amber); color: var(--amber-ink);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.4) inset, 0 6px 0 -2px #a8731a;
}
.cta--primary:hover:not(:disabled) { background: var(--amber-2); }
.cta--xl { padding: 22px 20px; font-size: 19px; letter-spacing: 0.06em; }
.cta--ghost {
  background: transparent; color: var(--ink-dim);
  border: 1px solid var(--line);
}
.cta--ghost:hover { color: var(--ink); border-color: var(--line-2); }

/* Back */
.back {
  display: inline-flex; align-items: center; gap: 8px;
  background: transparent; border: 0; cursor: pointer;
  color: var(--ink-dim); padding: 4px 0 0;
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.14em; text-transform: uppercase;
}
.back:hover { color: var(--amber); }

/* Vehicle bar */
.vehicle-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; background: var(--panel);
  border: 1px solid var(--line); border-radius: 12px;
}
.vehicle-bar__title { font-weight: 700; font-size: 17px; letter-spacing: 0.01em; }
.vehicle-bar__sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-dim); letter-spacing: 0.06em; }
.vehicle-bar__badge {
  font-family: 'DM Mono', monospace; font-size: 10px;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--amber);
  padding: 6px 8px; border: 1px solid var(--amber);
  border-radius: 4px; background: rgba(245,166,35,0.05);
}

/* Progress */
.progress { display: flex; flex-direction: column; gap: 8px; }
.progress__head {
  display: flex; justify-content: space-between; align-items: center;
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase;
}
.progress__label { color: var(--amber); font-weight: 600; }
.progress__count { color: var(--ink-dim); }
.progress__track { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.progress__seg {
  height: 6px; background: var(--panel); border: 1px solid var(--line);
  border-radius: 2px;
}
.progress__seg.is-done { background: var(--amber); border-color: var(--amber); }
.progress__seg.is-active {
  background: transparent; border-color: var(--amber);
  box-shadow: 0 0 0 2px rgba(245,166,35,0.18);
}

/* Diagram */
.diagram {
  background:
    repeating-linear-gradient(135deg, rgba(245,166,35,0.04) 0 2px, transparent 2px 12px),
    var(--panel);
  border: 1px solid var(--line); border-radius: 14px;
  padding: 8px; height: 320px;
  display: grid; place-items: center;
}
.diagram--sm { height: 240px; }

@keyframes pulseRing {
  0%   { r: 24; opacity: 0.9; }
  100% { r: 38; opacity: 0; }
}
.pulse { animation: pulseRing 1.4s ease-out infinite; transform-origin: center; }

/* Tire head */
.tire-head {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-top: 4px;
}
.tire-head__eyebrow {
  font-family: 'DM Mono', monospace; font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim);
}
.tire-head__title {
  font-family: 'Syne', sans-serif; font-weight: 700;
  font-size: 22px; text-transform: uppercase; letter-spacing: 0.01em;
  line-height: 1.05;
}
.tire-head__spec {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'DM Mono', monospace; font-size: 10px;
  color: var(--ink-dim); letter-spacing: 0.08em;
  padding: 6px 8px; border: 1px solid var(--line); border-radius: 4px;
  background: var(--panel);
}

/* Fields */
.field { display: flex; flex-direction: column; gap: 8px; }
.field--half { flex: 1; min-width: 0; }
.field__label {
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-dim);
}

.bignum {
  display: flex; align-items: baseline; justify-content: center;
  background: var(--panel); border: 1.5px solid var(--line);
  border-radius: 16px; padding: 18px 18px 14px;
  position: relative; transition: border-color 150ms, background 150ms;
}
.bignum input {
  flex: 0 1 auto; min-width: 0; max-width: 100%;
  background: transparent; border: 0; outline: 0;
  text-align: center;
  font-family: 'DM Mono', monospace;
  font-size: 84px; font-weight: 500;
  color: var(--ink); letter-spacing: -0.02em;
  line-height: 1; padding: 0; width: 200px;
  font-variant-numeric: tabular-nums;
}
.bignum input::placeholder { color: var(--line-2); }
.bignum__unit {
  font-family: 'DM Mono', monospace; font-size: 18px;
  color: var(--ink-dim); margin-left: 8px; letter-spacing: 0.06em;
}
.bignum--ok   { border-color: var(--ok); background: rgba(58,138,74,0.08); }
.bignum--warn { border-color: var(--warn); background: rgba(209,139,26,0.08); }
.bignum--bad  { border-color: var(--bad); background: rgba(179,57,43,0.10); }

.health {
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 8px 10px; border-radius: 8px; text-align: center;
}
.health--ok   { color: var(--ok-ink); background: rgba(58,138,74,0.12); }
.health--warn { color: var(--amber); background: rgba(245,166,35,0.10); }
.health--bad  { color: var(--bad-ink); background: rgba(179,57,43,0.14); }

.row { display: flex; gap: 10px; align-items: stretch; }

.smallnum {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 12px; padding: 16px 14px;
  font-family: 'DM Mono', monospace; font-size: 22px;
  color: var(--ink); outline: 0; width: 100%;
  font-variant-numeric: tabular-nums;
}
.smallnum::placeholder { color: var(--ink-mute); }
.smallnum:focus { border-color: var(--amber); }

.photo {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; background: var(--panel); border: 1px solid var(--line);
  border-radius: 12px; padding: 12px; cursor: pointer; color: var(--ink-dim);
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.1em; text-transform: uppercase;
}
.photo:hover { color: var(--ink); border-color: var(--line-2); }
.photo--on {
  color: var(--amber-ink); background: var(--amber); border-color: var(--amber);
}

textarea {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 12px; padding: 12px 14px; min-height: 64px;
  color: var(--ink); font-family: inherit; font-size: 15px;
  outline: 0; resize: none;
}
textarea:focus { border-color: var(--amber); }

/* Done banner */
.done-banner {
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(180deg, rgba(58,138,74,0.16), rgba(58,138,74,0.04));
  border: 1px solid var(--ok); color: var(--ok-ink);
  padding: 14px; border-radius: 12px;
}
.done-banner__t { font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 0.02em; }
.done-banner__s { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.08em; opacity: 0.85; }

/* Stats row */
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat {
  background: var(--panel); border: 1px solid var(--line);
  padding: 12px; border-radius: 12px;
}
.stat__v {
  font-family: 'DM Mono', monospace; font-size: 28px; font-weight: 500;
  color: var(--amber); letter-spacing: -0.02em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.stat__v span { font-size: 12px; color: var(--ink-dim); margin-left: 4px; letter-spacing: 0.06em; }
.stat__l {
  font-family: 'DM Mono', monospace; font-size: 10px;
  color: var(--ink-dim); letter-spacing: 0.12em;
  text-transform: uppercase; margin-top: 6px;
}

/* Summary cards */
.summary { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.scard {
  display: flex; gap: 12px; padding: 12px;
  background: var(--panel); border: 1px solid var(--line);
  border-left: 3px solid var(--line-2);
  border-radius: 10px;
}
.scard--ok   { border-left-color: var(--ok); }
.scard--warn { border-left-color: var(--amber); }
.scard--bad  { border-left-color: var(--bad); }
.scard__pos {
  font-family: 'DM Mono', monospace; font-weight: 600;
  font-size: 16px; color: var(--amber); width: 32px;
  display: grid; place-items: center;
  border: 1px solid var(--line); border-radius: 6px;
  background: var(--bg-2);
}
.scard__body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.scard__row { display: flex; justify-content: space-between; align-items: baseline; }
.scard__label { font-weight: 600; font-size: 15px; }
.scard__tread {
  font-family: 'DM Mono', monospace; font-size: 20px;
  color: var(--ink); font-variant-numeric: tabular-nums;
}
.scard__tread em { font-style: normal; font-size: 11px; color: var(--ink-dim); margin-left: 2px; }
.scard__meta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-dim); letter-spacing: 0.04em; }

/* Modal */
.modal-back {
  position: absolute; inset: 0; z-index: 50;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
.modal {
  width: 100%; background: var(--bg);
  border-top: 1px solid var(--line);
  border-radius: 24px 24px 0 0;
  padding: 22px 20px 28px;
  display: flex; flex-direction: column; gap: 12px;
  max-height: 86%; overflow-y: auto;
}
.modal::-webkit-scrollbar { display: none; }
.modal__head {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--amber);
}
.modal__id {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 26px;
  letter-spacing: 0.02em; text-transform: uppercase;
}
.modal__sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-dim); letter-spacing: 0.08em; }
.modal__sect { border-top: 1px solid var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 2px; }
.modal__label { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink-dim); }
.modal__val { font-weight: 700; font-size: 16px; letter-spacing: 0.01em; }
.modal__meta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-dim); }
.modal__table { width: 100%; border-collapse: collapse; margin-top: 6px; font-family: 'DM Mono', monospace; font-size: 12px; }
.modal__table th, .modal__table td {
  text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line);
  color: var(--ink);
}
.modal__table th { color: var(--ink-dim); font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; }
.modal__actions { display: flex; gap: 10px; margin-top: 6px; }
.modal__actions .cta { flex: 1; margin-top: 0; padding: 14px; font-size: 14px; }

.hint {
  margin-top: 18px; color: #4a4e55;
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase;
  display: flex; align-items: center; gap: 10px;
}
.kbd {
  border: 1px solid #2a2d33; border-radius: 4px;
  padding: 3px 6px; color: var(--amber);
}
`;
