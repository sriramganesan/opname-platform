// Opname Sprint 1 — Self-serve AI receptionist builder
// Supabase auth + real data, no window.storage dependency
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your real values

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Supabase client (inline, no npm needed in artifact) ──────────────────
const SUPABASE_URL = "https://lhssdumxoozytodwffeq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Y2R1YW14eWpoeXZrb3ZoZGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDUzNTYsImV4cCI6MjA5ODY4MTM1Nn0.r0WYkwow7xBgnGqVVzYTZSTkuGKEIaowcQBXppb8Gjc";

// Lightweight Supabase REST helper (no SDK dependency)
const sb = {
  headers: (token) => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${token || SUPABASE_ANON_KEY}`,
  }),

  async signUp(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: this.headers(token),
    });
  },

  async getBusiness(token, userId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?user_id=eq.${userId}&select=*`,
      { headers: this.headers(token) }
    );
    const data = await r.json();
    return Array.isArray(data) ? data[0] : null;
  },

  async upsertBusiness(token, business) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/businesses`, {
      method: "POST",
      headers: {
        ...this.headers(token),
        "Prefer": business.id ? "resolution=merge-duplicates" : "return=representation",
      },
      body: JSON.stringify(business),
    });
    const data = await r.json();
    return Array.isArray(data) ? data[0] : data;
  },

  async getCalls(token, businessId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/calls?business_id=eq.${businessId}&order=started_at.desc&limit=20`,
      { headers: this.headers(token) }
    );
    return r.json();
  },

  // Admin: get all businesses
  async getAllBusinesses(token) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?select=*&order=created_at.desc`,
      { headers: this.headers(token) }
    );
    return r.json();
  },

  async updateBusiness(token, id, updates) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`,
      {
        method: "PATCH",
        headers: { ...this.headers(token), "Prefer": "return=representation" },
        body: JSON.stringify(updates),
      }
    );
    const data = await r.json();
    return Array.isArray(data) ? data[0] : data;
  },
};

// ─── Design tokens ────────────────────────────────────────────────────────
const C = {
  navy: "#1B2430",
  navyL: "#2A3644",
  amber: "#E8A33D",
  amberDim: "rgba(232,163,61,0.15)",
  cream: "#F7F5F1",
  border: "#E5E1D8",
  slate: "#6B7280",
  green: "#3D9970",
  greenDim: "rgba(61,153,112,0.12)",
  red: "#C2492B",
  redDim: "rgba(194,73,43,0.1)",
  blue: "#2563EB",
};

// ─── Business type templates ──────────────────────────────────────────────
const TEMPLATES = {
  garage: {
    label_nl: "Garage / Autobedrijf", label_en: "Auto repair shop", icon: "🔧",
    services_nl: ["APK keuring inplannen","Reparatie aanmelden","Onderhoud bespreken","Prijsopgave aanvragen","Status van uw auto opvragen","Banden wisselen"],
    services_en: ["Schedule oil change","Book tire rotation","Schedule brake inspection","Get repair estimate","Check vehicle status","Schedule emissions test"],
    faqs_nl: [
      {q:"Wat kost een APK?", a:"Een APK keuring kost 45 euro inclusief rapport."},
      {q:"Hoe lang duurt een APK?", a:"Een APK duurt gemiddeld een uur."},
    ],
    faqs_en: [
      {q:"How much is an oil change?", a:"A standard oil change is $49.99 including filter."},
      {q:"How long does it take?", a:"About 30 to 45 minutes for a standard oil change."},
    ],
  },
  tandarts: {
    label_nl: "Tandartspraktijk", label_en: "Dental practice", icon: "🦷",
    services_nl: ["Afspraak maken voor controle","Behandeling inplannen","Afspraak verzetten","Spoedgeval melden","Nieuwe patiënt aanmelden"],
    services_en: ["Schedule checkup","Book treatment","Reschedule appointment","Report emergency","New patient intake"],
    faqs_nl: [
      {q:"Nemen jullie nieuwe patiënten aan?", a:"Ja, we nemen momenteel nieuwe patiënten aan."},
      {q:"Wat kost een controle?", a:"Een controle valt onder de basisverzekering."},
    ],
    faqs_en: [
      {q:"Are you accepting new patients?", a:"Yes, we are currently accepting new patients."},
      {q:"Does insurance cover checkups?", a:"Yes, routine checkups are typically covered by insurance."},
    ],
  },
  kapper: {
    label_nl: "Kapsalon / Salon", label_en: "Hair / Beauty salon", icon: "💇",
    services_nl: ["Afspraak maken","Afspraak verzetten","Prijzen behandelingen","Openingstijden","Cadeaubon"],
    services_en: ["Book appointment","Reschedule","Treatment prices","Opening hours","Gift voucher"],
    faqs_nl: [
      {q:"Wat kost een knipbeurt?", a:"Een knipbeurt kost 38 euro voor dames en 28 euro voor heren."},
    ],
    faqs_en: [
      {q:"How much is a haircut?", a:"A haircut is $45 for women and $35 for men."},
    ],
  },
  custom: {
    label_nl: "Ander type bedrijf", label_en: "Other business type", icon: "✨",
    services_nl: [], services_en: [], faqs_nl: [], faqs_en: [],
  },
};

// ─── Shared styles ────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit",
  outline: "none", background: "#fff", color: C.navy, boxSizing: "border-box",
};
const btnPrimary = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: C.navy, color: "#fff", border: "none", borderRadius: 9,
  padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit",
};
const btnSecondary = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: "#fff", color: C.navy, border: `1.5px solid ${C.border}`,
  borderRadius: 9, padding: "12px 22px", fontSize: 14, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
const label = { display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 };
const card = {
  background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12,
  padding: "20px 22px", marginBottom: 16,
};

// ─── Auth screen ──────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handle = async () => {
    if (!email || !password) return setError("Please fill in both fields.");
    setLoading(true); setError(""); setSuccess("");
    try {
      if (mode === "signup") {
        const data = await sb.signUp(email, password);
        if (data.error) throw new Error(data.error.message || data.msg);
        setSuccess("Account created! Check your email to confirm, then log in.");
        setMode("login");
      } else {
        const data = await sb.signIn(email, password);
        if (data.error || !data.access_token) throw new Error(data.error?.message || "Login failed.");
        onAuth({ token: data.access_token, userId: data.user?.id, email: data.user?.email });
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "serif", fontSize: 32, fontWeight: 800, color: C.navy, letterSpacing: -1, marginBottom: 8 }}>
            Op<span style={{ color: C.amber }}>name</span>
          </div>
          <p style={{ color: C.slate, fontSize: 15 }}>
            {mode === "login" ? "Sign in to your account" : "Create your free account"}
          </p>
        </div>

        <div style={{ ...card, padding: 28 }}>
          {error && (
            <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 16 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.green, marginBottom: 16 }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={label}>Email</div>
            <input style={inputStyle} type="email" placeholder="you@yourbusiness.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={label}>Password</div>
            <input style={inputStyle} type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()} />
          </div>

          <button onClick={handle} disabled={loading} style={{ ...btnPrimary, width: "100%", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: C.slate }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setSuccess(""); }}
              style={{ background: "none", border: "none", color: C.amber, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {mode === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: C.slate, marginTop: 20 }}>
          14-day free trial · No credit card required
        </p>
      </div>
    </div>
  );
}

// ─── Step nav ─────────────────────────────────────────────────────────────
function StepNav({ step, setStep, unlocked }) {
  const steps = [
    { id: "build", label: "Business" },
    { id: "train", label: "Train" },
    { id: "test", label: "Test" },
    { id: "live", label: "Go Live" },
    { id: "dashboard", label: "Dashboard" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {steps.map((s, i) => {
        const active = step === s.id;
        const locked = !unlocked.includes(s.id);
        return (
          <button key={s.id} onClick={() => !locked && setStep(s.id)} disabled={locked}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: active ? C.navy : "transparent",
              color: locked ? "#C8C4BC" : active ? "#fff" : C.navy,
              fontWeight: 600, fontSize: 13, cursor: locked ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Build step ───────────────────────────────────────────────────────────
function BuildStep({ business, onChange, onNext, lang }) {
  const L = (nl, en) => lang === "nl" ? nl : en;
  const [templateKey, setTemplateKey] = useState(business.template || "garage");

  const selectTemplate = (key) => {
    setTemplateKey(key);
    const t = TEMPLATES[key];
    onChange({
      ...business,
      template: key,
      services: lang === "nl" ? [...t.services_nl] : [...t.services_en],
      faqs: lang === "nl" ? t.faqs_nl.map(f => ({q_nl: f.q, a_nl: f.a, q_en: f.q, a_en: f.a})) : t.faqs_en.map(f => ({q_nl: f.q, a_nl: f.a, q_en: f.q, a_en: f.a})),
    });
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Step 1 of 4</div>
        <h2 style={{ fontFamily: "serif", fontSize: 28, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: -0.5 }}>
          {L("Vertel ons over uw bedrijf", "Tell us about your business")}
        </h2>
        <p style={{ color: C.slate, fontSize: 14.5, marginTop: 8, lineHeight: 1.6 }}>
          {L("Uw AI-receptionist stelt zich straks voor op basis van deze gegevens.", "Your AI receptionist will introduce itself based on this information.")}
        </p>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={label}>{L("Type bedrijf", "Business type")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button key={key} onClick={() => selectTemplate(key)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderRadius: 10, border: `2px solid ${templateKey === key ? C.navy : C.border}`,
                background: "#fff", cursor: "pointer", textAlign: "left",
                boxShadow: templateKey === key ? `0 0 0 3px ${C.amberDim}` : "none",
                fontFamily: "inherit",
              }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>
                {lang === "nl" ? t.label_nl : t.label_en}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={label}>{L("Bedrijfsnaam", "Business name")}</div>
          <input style={inputStyle} placeholder={L("bijv. Garage De Vries", "e.g. Springfield Auto Repair")}
            value={business.name || ""} onChange={e => onChange({...business, name: e.target.value})} />
        </div>
        <div>
          <div style={label}>{L("Naam receptionist", "Receptionist name")}</div>
          <input style={inputStyle} placeholder={L("bijv. Eva", "e.g. Sarah")}
            value={business.agent_name || ""} onChange={e => onChange({...business, agent_name: e.target.value})} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={label}>{L("Openingstijden", "Opening hours")}</div>
          <input style={inputStyle} placeholder={L("ma-vr 9:00-17:00", "Mon-Fri 9am-5pm")}
            value={business.hours || ""} onChange={e => onChange({...business, hours: e.target.value})} />
        </div>
        <div>
          <div style={label}>{L("Adres (optioneel)", "Address (optional)")}</div>
          <input style={inputStyle} placeholder={L("Straatnaam 12, Amsterdam", "123 Main St, Springfield")}
            value={business.address || ""} onChange={e => onChange({...business, address: e.target.value})} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={label}>{L("Website (optioneel — we halen gegevens op)", "Website (optional — we'll import your info)")}</div>
        <input style={inputStyle} placeholder="https://www.yourbusiness.com"
          value={business.website_url || ""} onChange={e => onChange({...business, website_url: e.target.value})} />
        <p style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>
          {L("Wij halen openingstijden, diensten en FAQ's op van uw website.", "We'll pull hours, services, and FAQs from your website automatically.")}
          {" "}<span style={{ color: C.amber, fontWeight: 600 }}>{L("Binnenkort beschikbaar.", "Coming soon.")}</span>
        </p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={label}>{L("Speciale instructies (optioneel)", "Special instructions (optional)")}</div>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          placeholder={L("bijv. Verwijs prijsvragen over implantaten altijd door naar de eigenaar.", "e.g. Always refer transmission rebuild questions to the owner.")}
          value={business.custom_instructions || ""} onChange={e => onChange({...business, custom_instructions: e.target.value})} />
      </div>

      <button onClick={onNext} disabled={!business.name || !business.agent_name}
        style={{ ...btnPrimary, opacity: (!business.name || !business.agent_name) ? 0.4 : 1,
          cursor: (!business.name || !business.agent_name) ? "not-allowed" : "pointer" }}>
        {L("Volgende: trainen →", "Next: train →")}
      </button>
    </div>
  );
}

// ─── Train step ───────────────────────────────────────────────────────────
function TrainStep({ business, onChange, onNext, onBack, lang }) {
  const L = (nl, en) => lang === "nl" ? nl : en;
  const [newService, setNewService] = useState("");
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");

  const services = business.services || [];
  const faqs = business.faqs || [];

  const addService = () => {
    if (!newService.trim()) return;
    onChange({...business, services: [...services, newService.trim()]});
    setNewService("");
  };

  const removeService = (i) => onChange({...business, services: services.filter((_, idx) => idx !== i)});

  const addFaq = () => {
    if (!newQ.trim() || !newA.trim()) return;
    const faq = {q_nl: newQ, a_nl: newA, q_en: newQ, a_en: newA};
    onChange({...business, faqs: [...faqs, faq]});
    setNewQ(""); setNewA("");
  };

  const removeFaq = (i) => onChange({...business, faqs: faqs.filter((_, idx) => idx !== i)});

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Step 2 of 4</div>
        <h2 style={{ fontFamily: "serif", fontSize: 28, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: -0.5 }}>
          {L("Train uw receptionist", "Train your receptionist")}
        </h2>
        <p style={{ color: C.slate, fontSize: 14.5, marginTop: 8, lineHeight: 1.6 }}>
          {L("We hebben alvast wat ingevuld op basis van uw type bedrijf. Pas aan waar nodig.", "We've pre-filled based on your business type. Adjust as needed.")}
        </p>
      </div>

      {/* Services */}
      <div style={{ marginBottom: 24 }}>
        <div style={label}>{L("Wat kan de receptionist regelen?", "What can the receptionist handle?")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {services.map((s, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 20, padding: "6px 8px 6px 14px", fontSize: 13.5, color: C.navy, fontWeight: 500 }}>
              {s}
              <button onClick={() => removeService(i)} style={{ border: "none", background: "#F0EDE6", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder={L("bijv. Cadeaubon kopen", "e.g. Buy a gift card")}
            value={newService} onChange={e => setNewService(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addService()} />
          <button onClick={addService} style={{ ...btnSecondary, whiteSpace: "nowrap", padding: "10px 16px" }}>+ {L("Toevoegen", "Add")}</button>
        </div>
      </div>

      {/* FAQs */}
      <div style={{ marginBottom: 28 }}>
        <div style={label}>{L("Veelgestelde vragen & antwoorden", "FAQ — questions & answers")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ ...card, margin: 0, display: "flex", gap: 12, alignItems: "flex-start", padding: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: C.navy, marginBottom: 4 }}>{lang === "nl" ? f.q_nl : f.q_en}</div>
                <div style={{ fontSize: 13, color: C.slate, lineHeight: 1.5 }}>{lang === "nl" ? f.a_nl : f.a_en}</div>
              </div>
              <button onClick={() => removeFaq(i)} style={{ border: "none", background: "#F0EDE6", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ ...card, border: `1.5px dashed ${C.border}`, margin: 0, padding: 14 }}>
          <input style={{ ...inputStyle, marginBottom: 8 }}
            placeholder={L("Vraag, bijv. 'Heeft u parkeerplek?'", "Question, e.g. 'Do you have parking?'")}
            value={newQ} onChange={e => setNewQ(e.target.value)} />
          <input style={{ ...inputStyle, marginBottom: 10 }}
            placeholder={L("Antwoord dat de receptionist moet geven", "Answer the receptionist should give")}
            value={newA} onChange={e => setNewA(e.target.value)} />
          <button onClick={addFaq} style={{ ...btnSecondary, padding: "9px 16px", fontSize: 13 }}>+ {L("Vraag toevoegen", "Add question")}</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={btnSecondary}>← {L("Terug", "Back")}</button>
        <button onClick={onNext} style={{ ...btnPrimary, flex: 1 }}>{L("Volgende: testen →", "Next: test →")}</button>
      </div>
    </div>
  );
}

// ─── Test step ────────────────────────────────────────────────────────────
function TestStep({ business, onNext, onBack, lang, token }) {
  const L = (nl, en) => lang === "nl" ? nl : en;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const buildPrompt = () => {
    const services = (business.services || []).join(", ");
    const faqs = (business.faqs || []).map(f => lang === "nl" ? `Q: ${f.q_nl} A: ${f.a_nl}` : `Q: ${f.q_en} A: ${f.a_en}`).join("\n");
    if (lang === "nl") {
      return `Je bent een AI-telefoniste voor ${business.name}. Je naam is ${business.agent_name}. Openingstijden: ${business.hours || "niet opgegeven"}. Diensten: ${services}. FAQ:\n${faqs}\nSpeciale instructies: ${business.custom_instructions || "geen"}.\nHoud antwoorden kort (2-3 zinnen). Stel maar één vraag tegelijk. Antwoord altijd in het Nederlands.`;
    }
    return `You are an AI receptionist for ${business.name}. Your name is ${business.agent_name}. Hours: ${business.hours || "not specified"}. Services: ${services}. FAQ:\n${faqs}\nSpecial instructions: ${business.custom_instructions || "none"}.\nKeep replies short (2-3 sentences). Ask only one question at a time. Always respond in English.`;
  };

  const startChat = async () => {
    setStarted(true);
    const greeting = lang === "nl"
      ? `Goedemiddag, u spreekt met ${business.agent_name} van ${business.name}. Waarmee kan ik u helpen?`
      : `Good afternoon, you've reached ${business.name}, this is ${business.agent_name}. How can I help you?`;
    setMessages([{ role: "assistant", text: greeting }]);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    const newMsgs = [...messages, { role: "user", text: userText }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const apiMessages = newMsgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 300,
          system: buildPrompt(), messages: apiMessages,
        }),
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || L("Sorry, kunt u dat herhalen?", "Sorry, could you repeat that?");
      setMessages(m => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: L("Er is een technisch probleem.", "Technical issue, please try again.") }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Step 3 of 4</div>
        <h2 style={{ fontFamily: "serif", fontSize: 28, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: -0.5 }}>
          {L("Test een gesprek", "Test a conversation")}
        </h2>
        <p style={{ color: C.slate, fontSize: 14.5, marginTop: 8, lineHeight: 1.6 }}>
          {L("Praat met uw receptionist zoals een echte klant zou doen.", "Chat with your receptionist as a real customer would.")}
        </p>
      </div>

      {/* Call simulator */}
      <div style={{ background: C.navy, borderRadius: 16, padding: 24, marginBottom: 20, minHeight: 360, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: started ? C.green : "#6B7280" }} />
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
            {started ? `${business.agent_name} · ${business.name}` : L("Klaar om te starten", "Ready to start")}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, maxHeight: 280 }}>
          {!started && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={startChat} style={{ ...btnPrimary, background: C.green, padding: "14px 28px", fontSize: 15 }}>
                📞 {L("Start testgesprek", "Start test call")}
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "assistant" ? "flex-start" : "flex-end",
              maxWidth: "82%", background: m.role === "assistant" ? C.navyL : C.amber,
              color: m.role === "assistant" ? "#fff" : C.navy,
              padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.5,
            }}>{m.text}</div>
          ))}
          {loading && (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 4, padding: "4px 0" }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, display: "block", animation: `bounce 0.9s ${i*0.15}s infinite` }} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {started && (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder={L("Typ hier als klant...", "Type here as a customer...")}
              style={{ flex: 1, background: C.navyL, border: "1px solid #3A4655", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13.5, outline: "none", fontFamily: "inherit" }} />
            <button onClick={send} disabled={loading}
              style={{ background: C.amberDim, border: "none", borderRadius: 10, padding: "0 16px", color: C.amber, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {L("Stuur", "Send")}
            </button>
          </div>
        )}
      </div>

      <div style={{ background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#7A5520", marginBottom: 24 }}>
        💡 {L("Dit is een teksttest. De echte receptionist beantwoordt echte telefoongesprekken in het Nederlands.", "This is a text preview. Your real receptionist will answer actual phone calls in English.")}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={btnSecondary}>← {L("Terug", "Back")}</button>
        <button onClick={onNext} style={{ ...btnPrimary, flex: 1 }}>{L("Volgende: live zetten →", "Next: go live →")}</button>
      </div>

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-4px);opacity:1} }`}</style>
    </div>
  );
}

// ─── Go Live step ─────────────────────────────────────────────────────────
function LiveStep({ business, onSave, onBack, saving, saved, lang }) {
  const L = (nl, en) => lang === "nl" ? nl : en;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Step 4 of 4</div>
        <h2 style={{ fontFamily: "serif", fontSize: 28, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: -0.5 }}>
          {L("Zet uw receptionist live", "Go live")}
        </h2>
        <p style={{ color: C.slate, fontSize: 14.5, marginTop: 8, lineHeight: 1.6 }}>
          {L("Sla uw configuratie op. Wij activeren uw nummer zo snel mogelijk.", "Save your configuration. We'll activate your number shortly.")}
        </p>
      </div>

      {/* Summary */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 14 }}>
          {L("Samenvatting", "Summary")}
        </div>
        {[
          [L("Bedrijfsnaam", "Business name"), business.name],
          [L("Receptionist", "Receptionist"), business.agent_name],
          [L("Openingstijden", "Hours"), business.hours],
          [L("Diensten", "Services"), (business.services || []).length + " " + L("diensten", "services")],
          [L("FAQ's", "FAQs"), (business.faqs || []).length + " " + L("vragen", "questions")],
          [L("Taal", "Language"), business.language === "en" ? "English" : "Nederlands"],
        ].map(([k, v]) => v && (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
            <span style={{ color: C.slate }}>{k}</span>
            <span style={{ fontWeight: 600, color: C.navy }}>{v}</span>
          </div>
        ))}
      </div>

      {/* What happens next */}
      <div style={{ ...card, background: C.navy, border: "none", color: "#fff" }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>
          {L("Wat gebeurt er daarna?", "What happens next?")}
        </div>
        {[
          L("Wij activeren een uniek Nederlands telefoonnummer voor uw bedrijf", "We activate a unique phone number for your business"),
          L("U ontvangt het nummer per e-mail binnen 24 uur", "You'll receive the number by email within 24 hours"),
          L("Stel gespreksdoorschakeling in op uw bestaande nummer", "Set up call forwarding from your existing number"),
          L("Uw klanten worden automatisch door Eva te woord gestaan", "Your customers are automatically handled by your AI receptionist"),
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 14 }}>
            <span style={{ color: C.amber, fontWeight: 700, flexShrink: 0 }}>0{i+1}</span>
            <span style={{ color: "#C8D4E0", lineHeight: 1.5 }}>{s}</span>
          </div>
        ))}
      </div>

      {saved && (
        <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: 10, padding: "12px 16px", fontSize: 14, color: C.green, marginBottom: 16, fontWeight: 600 }}>
          ✓ {L("Opgeslagen! Wij nemen zo snel mogelijk contact met u op.", "Saved! We'll be in touch shortly to activate your number.")}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={btnSecondary}>← {L("Terug", "Back")}</button>
        <button onClick={onSave} disabled={saving || saved}
          style={{ ...btnPrimary, flex: 1, background: saved ? C.green : C.navy, opacity: saving ? 0.7 : 1 }}>
          {saving ? L("Opslaan…", "Saving…") : saved ? "✓ " + L("Opgeslagen", "Saved") : L("Opslaan & aanvragen", "Save & request activation")}
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ business, token, lang }) {
  const L = (nl, en) => lang === "nl" ? nl : en;
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!business?.id) { setLoading(false); return; }
    sb.getCalls(token, business.id).then(data => {
      setCalls(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [business?.id]);

  const totalCalls = calls.length;
  const booked = calls.filter(c => c.outcome === "booked").length;
  const escalated = calls.filter(c => c.outcome?.startsWith("escalated")).length;

  const duration = (c) => {
    if (!c.started_at || !c.ended_at) return "—";
    const s = Math.round((new Date(c.ended_at) - new Date(c.started_at)) / 1000);
    return s > 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
  };

  const outcomeColor = (o) => ({booked: C.green, message_taken: C.blue, escalated_connected: C.amber, escalated_no_answer: C.slate, unresolved: C.red}[o] || C.slate);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "serif", fontSize: 28, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: -0.5 }}>
          {L("Dashboard", "Dashboard")}
        </h2>
        <p style={{ color: C.slate, fontSize: 14.5, marginTop: 6 }}>
          {business?.twilio_number
            ? `📞 ${business.twilio_number} · ${business.name}`
            : L("Uw nummer wordt zo snel mogelijk geactiveerd.", "Your number will be activated shortly.")}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          [L("Totaal gesprekken", "Total calls"), totalCalls, C.navy],
          [L("Afspraken gemaakt", "Appointments booked"), booked, C.green],
          [L("Doorverbonden", "Escalated"), escalated, C.amber],
        ].map(([label, val, color]) => (
          <div key={label} style={card}>
            <div style={{ fontFamily: "serif", fontSize: 32, fontWeight: 800, color, marginBottom: 4 }}>{val}</div>
            <div style={{ fontSize: 12.5, color: C.slate }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: business?.status === "live" ? C.green : "#D1CCC0" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>
              {business?.status === "live" ? L("Receptionist is actief", "Receptionist is active") : L("Wacht op activering", "Awaiting activation")}
            </div>
            <div style={{ fontSize: 12.5, color: C.slate, marginTop: 2 }}>
              {business?.status === "live"
                ? L("Beantwoordt nu inkomende gesprekken", "Now answering incoming calls")
                : L("Uw nummer wordt binnen 24 uur geactiveerd", "Your number will be activated within 24 hours")}
            </div>
          </div>
        </div>
        <div style={{ background: business?.status === "live" ? C.greenDim : C.amberDim, color: business?.status === "live" ? C.green : C.amber, fontWeight: 700, fontSize: 12, padding: "6px 12px", borderRadius: 20 }}>
          {(business?.status || "draft").toUpperCase()}
        </div>
      </div>

      {/* Call history */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 12 }}>
          {L("Recente gesprekken", "Recent calls")}
        </div>
        {loading && <div style={{ color: C.slate, fontSize: 14, padding: 20, textAlign: "center" }}>{L("Laden…", "Loading…")}</div>}
        {!loading && calls.length === 0 && (
          <div style={{ ...card, textAlign: "center", color: C.slate, padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📞</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{L("Nog geen gesprekken", "No calls yet")}</div>
            <div style={{ fontSize: 13 }}>{L("Gesprekken verschijnen hier zodra uw nummer actief is.", "Calls will appear here once your number is active.")}</div>
          </div>
        )}
        {calls.map((c, i) => (
          <div key={c.id} style={{ ...card, cursor: "pointer", marginBottom: 10 }} onClick={() => setExpanded(expanded === i ? null : i)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>
                  {c.caller_number || L("Onbekend nummer", "Unknown number")}
                </div>
                <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>
                  {c.started_at ? new Date(c.started_at).toLocaleString(lang === "nl" ? "nl-NL" : "en-US") : "—"} · {duration(c)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ background: `${outcomeColor(c.outcome)}20`, color: outcomeColor(c.outcome), fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                  {(c.outcome || "unresolved").replace(/_/g, " ").toUpperCase()}
                </span>
                <span style={{ color: C.slate, fontSize: 12 }}>{expanded === i ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded === i && c.transcript && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                {(Array.isArray(c.transcript) ? c.transcript : []).map((t, j) => (
                  <div key={j} style={{ fontSize: 13, marginBottom: 8, color: t.role === "agent" ? C.navy : C.slate }}>
                    <strong>{t.role === "agent" ? (business?.agent_name || "Agent") : L("Beller", "Caller")}:</strong> {t.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin panel (for Priya) ──────────────────────────────────────────────
function AdminPanel({ token, onClose }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});

  useEffect(() => {
    sb.getAllBusinesses(token).then(data => {
      setBusinesses(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const save = async (id) => {
    await sb.updateBusiness(token, id, editing[id]);
    const updated = businesses.map(b => b.id === id ? {...b, ...editing[id]} : b);
    setBusinesses(updated);
    setEditing(e => { const n = {...e}; delete n[id]; return n; });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 860, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "serif", fontSize: 22, fontWeight: 800, color: C.navy }}>Admin — All businesses</div>
          <button onClick={onClose} style={{ border: "none", background: "#F0EDE6", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Close</button>
        </div>

        {loading && <p style={{ color: C.slate }}>Loading…</p>}
        {businesses.map(b => (
          <div key={b.id} style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4 }}>BUSINESS</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{b.name}</div>
                <div style={{ fontSize: 12, color: C.slate }}>{b.language?.toUpperCase()} · {b.country}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4 }}>TWILIO NUMBER</div>
                <input style={{ ...inputStyle, fontSize: 13 }}
                  defaultValue={b.twilio_number || ""}
                  onChange={e => setEditing(ed => ({...ed, [b.id]: {...(ed[b.id]||{}), twilio_number: e.target.value}}))}
                  placeholder="+31..." />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4 }}>STATUS</div>
                <select style={{ ...inputStyle, fontSize: 13 }}
                  defaultValue={b.status || "draft"}
                  onChange={e => setEditing(ed => ({...ed, [b.id]: {...(ed[b.id]||{}), status: e.target.value}}))}>
                  <option value="draft">Draft</option>
                  <option value="testing">Testing</option>
                  <option value="live">Live</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4 }}>OWNER PHONE</div>
                <input style={{ ...inputStyle, fontSize: 13 }}
                  defaultValue={b.owner_phone || ""}
                  onChange={e => setEditing(ed => ({...ed, [b.id]: {...(ed[b.id]||{}), owner_phone: e.target.value}}))}
                  placeholder="+31..." />
              </div>
              <button onClick={() => editing[b.id] && save(b.id)}
                disabled={!editing[b.id]}
                style={{ ...btnPrimary, opacity: editing[b.id] ? 1 : 0.35, padding: "10px 16px", fontSize: 13 }}>
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────
function Header({ user, step, setStep, unlocked, lang, setLang, onSignOut, onAdmin, business }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontFamily: "serif", fontSize: 20, fontWeight: 800, color: C.navy, letterSpacing: -0.5 }}>
        Op<span style={{ color: C.amber }}>name</span>
        {business?.status === "live" && (
          <span style={{ marginLeft: 8, fontSize: 11, background: C.greenDim, color: C.green, fontFamily: "inherit", fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>LIVE</span>
        )}
      </div>
      <StepNav step={step} setStep={setStep} unlocked={unlocked} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Lang toggle */}
        <div style={{ display: "flex", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3 }}>
          {["nl","en"].map(l => (
            <button key={l} onClick={() => setLang(l)}
              style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: lang === l ? C.navy : "transparent", color: lang === l ? "#fff" : C.slate, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {/* Admin button — only show for Priya's email */}
        {user?.email === "sriram.ganesan@YOUR_EMAIL.com" ? (
          <button onClick={onAdmin} style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>Admin</button>
        ) : null}
        <button onClick={onSignOut} style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>
          {lang === "nl" ? "Uitloggen" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null);      // { token, userId, email }
  const [lang, setLang] = useState("nl");
  const [step, setStep] = useState("build");
  const [business, setBusiness] = useState({ template: "garage", language: "nl", country: "NL", services: [], faqs: [], status: "draft" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync language to business record
  useEffect(() => {
    setBusiness(b => ({...b, language: lang, country: lang === "nl" ? "NL" : "US"}));
  }, [lang]);

  // Load existing business on login
  useEffect(() => {
    if (!auth) return;
    sb.getBusiness(auth.token, auth.userId).then(data => {
      if (data) {
        setBusiness(data);
        setLang(data.language || "nl");
        // If they have a saved business, unlock all steps
        setStep("dashboard");
      }
      setLoaded(true);
    });
  }, [auth?.userId]);

  const getUnlocked = () => {
    const steps = ["build"];
    if (business.name && business.agent_name) steps.push("train");
    if (steps.includes("train")) steps.push("test");
    if (steps.includes("test")) steps.push("live");
    if (saved || business.id) steps.push("dashboard");
    return steps;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = {
        ...business,
        user_id: auth.userId,
        status: business.status === "live" ? "live" : "draft",
      };
      const result = await sb.upsertBusiness(auth.token, toSave);
      if (result?.id) setBusiness(r => ({...r, id: result.id, ...result}));
      setSaved(true);
      setTimeout(() => setStep("dashboard"), 1200);
    } catch (e) {
      console.error("Save failed:", e);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await sb.signOut(auth.token);
    setAuth(null);
    setBusiness({ template: "garage", language: lang, country: "NL", services: [], faqs: [], status: "draft" });
    setSaved(false);
    setStep("build");
  };

  if (!auth) return <AuthScreen onAuth={setAuth} />;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <Header
        user={auth} step={step} setStep={setStep}
        unlocked={getUnlocked()} lang={lang} setLang={setLang}
        onSignOut={handleSignOut} onAdmin={() => setShowAdmin(true)}
        business={business}
      />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
        {step === "build" && (
          <BuildStep business={business} onChange={setBusiness} lang={lang}
            onNext={() => setStep("train")} />
        )}
        {step === "train" && (
          <TrainStep business={business} onChange={setBusiness} lang={lang}
            onNext={() => setStep("test")} onBack={() => setStep("build")} />
        )}
        {step === "test" && (
          <TestStep business={business} lang={lang} token={auth.token}
            onNext={() => setStep("live")} onBack={() => setStep("train")} />
        )}
        {step === "live" && (
          <LiveStep business={business} lang={lang}
            onSave={handleSave} onBack={() => setStep("test")}
            saving={saving} saved={saved} />
        )}
        {step === "dashboard" && (
          <Dashboard business={business} token={auth.token} lang={lang} />
        )}
      </div>

      {showAdmin && <AdminPanel token={auth.token} onClose={() => setShowAdmin(false)} />}

      <style>{`
        * { box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { border-color: ${C.navy} !important; outline: none; box-shadow: 0 0 0 3px ${C.amberDim}; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
