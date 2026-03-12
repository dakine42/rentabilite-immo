import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS_CHART = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

const defaultBien = {
  nom: "Mon bien",
  prix: 180000,
  travaux: 0,
  surface: 80,
  apport: 20000,
  taux: 3,
  duree: 15,
  tauxAssurance: 0.3,
  loyer: 900,
  taxeFonciere: 1200,
  entretien: 0,
  assurancePNO: 500,
  comptable: 0,
  autresCharges: 0,
  emplacement: 3,
};

function calculer(b) {
  const notaire = b.prix * 1.085;
  const coutTotal = notaire + b.travaux;
  const aEmprunter = coutTotal - b.apport;
  const loyerAnnuel = b.loyer * 12;
  const charges = b.taxeFonciere + b.entretien + b.assurancePNO + b.comptable + b.autresCharges;
  const r = b.taux / 100 / 12;
  const n = b.duree * 12;
  const mensualiteCredit = r === 0 ? aEmprunter / n : aEmprunter * (r / (1 - Math.pow(1 + r, -n)));
  const mensualiteAssurance = aEmprunter * (b.tauxAssurance / 100) / 12;
  const mensualiteTotale = mensualiteCredit + mensualiteAssurance;
  const coutTotalCredit = mensualiteTotale * n - aEmprunter;
  const rentaBrute = (loyerAnnuel / coutTotal) * 100;
  const rentaNette = ((loyerAnnuel - charges) / coutTotal) * 100;
  const rentaNetNet = b.apport + b.travaux > 0 ? ((loyerAnnuel - charges) - (mensualiteTotale * 12)) / (b.apport + b.travaux) * 100 : 0;
  const dscr = (loyerAnnuel - charges) / (mensualiteTotale * 12);
  const cashflowMensuel = b.loyer - mensualiteTotale - (charges / 12);
  const prixM2 = notaire / b.surface;
  const prixM2Travaux = coutTotal / b.surface;
  const interpRentaNette = rentaNette < 4 ? ["Faible", 1, "🔴"] : rentaNette < 6 ? ["Correct", 2, "🟡"] : rentaNette < 8 ? ["Bon", 3, "🟢"] : rentaNette < 10 ? ["Très bon", 4, "🟢"] : ["Excellent", 5, "💎"];
  const interpRentaNetNet = rentaNetNet < 0 ? ["Risque", 1, "🔴"] : rentaNetNet < 3 ? ["Faible", 2, "🟠"] : rentaNetNet < 6 ? ["Correct", 3, "🟡"] : rentaNetNet < 10 ? ["Bon", 4, "🟢"] : ["Excellent", 5, "💎"];
  const interpDSCR = dscr < 1 ? ["Dangereux", 1, "🔴"] : dscr === 1 ? ["Équilibre", 2, "🟠"] : dscr <= 1.2 ? ["Correct", 3, "🟡"] : dscr <= 1.5 ? ["Solide", 4, "🟢"] : ["Très sécurisé", 5, "💎"];
  const interpCash = cashflowMensuel < 0 ? ["Mauvais", 1, "🔴"] : cashflowMensuel < 100 ? ["Moyen", 2, "🟠"] : cashflowMensuel < 300 ? ["Correct", 3, "🟡"] : cashflowMensuel < 500 ? ["Bon", 4, "🟢"] : ["Excellent", 5, "💎"];
  const score = interpRentaNetNet[1] + interpDSCR[1] + interpRentaNette[1] + interpCash[1] + b.emplacement;
  const interpScore = score < 10 ? ["Mauvais investissement", "🔴"] : score < 15 ? ["Moyen", "🟠"] : score < 18 ? ["Bon", "🟢"] : score < 22 ? ["Très bon", "🟢"] : ["Pépite 💎", "💎"];
  let capitalRestant = aEmprunter;
  const amortissement = [];
  for (let i = 1; i <= n; i++) {
    const interets = capitalRestant * r;
    const capitalRembourse = mensualiteCredit - interets;
    capitalRestant = Math.max(0, capitalRestant - capitalRembourse);
    amortissement.push({ mois: i, mensualiteCredit: Math.round(mensualiteCredit * 100) / 100, interets: Math.round(interets * 100) / 100, capitalRembourse: Math.round(capitalRembourse * 100) / 100, assurance: Math.round(mensualiteAssurance * 100) / 100, mensualiteTotale: Math.round(mensualiteTotale * 100) / 100, capitalRestant: Math.round(capitalRestant * 100) / 100, cashflowCumule: Math.round((cashflowMensuel * i) * 100) / 100 });
  }
  return { notaire, coutTotal, aEmprunter, loyerAnnuel, charges, mensualiteCredit, mensualiteAssurance, mensualiteTotale, coutTotalCredit, rentaBrute, rentaNette, rentaNetNet, dscr, cashflowMensuel, prixM2, prixM2Travaux, interpRentaNette, interpRentaNetNet, interpDSCR, interpCash, score, interpScore, amortissement };
}

function fmt(n, d = 0) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
function fmtEur(n) { return fmt(n) + " €"; }
function fmtPct(n) { return fmt(n, 2) + " %"; }

async function fetchDiagnostic(bien, res) {
  const emplacementLabel = ["", "Mauvais secteur", "Secteur moyen", "Correct", "Bon emplacement", "Très recherché"][bien.emplacement];
  const prompt = `Tu es un expert en investissement immobilier locatif français avec 20 ans d'expérience. Analyse ce bien immobilier de manière professionnelle, honnête et pédagogique.

## DONNÉES DU BIEN : "${bien.nom}"

### Acquisition
- Prix d'achat : ${fmtEur(bien.prix)}
- Frais de notaire : ${fmtEur(res.notaire - bien.prix)} (total avec notaire : ${fmtEur(res.notaire)})
- Travaux : ${fmtEur(bien.travaux)}
- Coût total d'acquisition : ${fmtEur(res.coutTotal)}
- Surface : ${bien.surface} m²
- Prix au m² : ${fmtEur(res.prixM2)} (${fmtEur(res.prixM2Travaux)} travaux inclus)
- Apport personnel : ${fmtEur(bien.apport)} (soit ${fmt((bien.apport / res.coutTotal) * 100, 1)}% du coût total)
- Montant emprunté : ${fmtEur(res.aEmprunter)}

### Financement
- Taux d'intérêt : ${bien.taux}%
- Durée : ${bien.duree} ans
- Mensualité crédit : ${fmtEur(Math.round(res.mensualiteCredit))}
- Mensualité totale (avec assurance ${bien.tauxAssurance}%) : ${fmtEur(Math.round(res.mensualiteTotale))}
- Coût total du crédit (intérêts) : ${fmtEur(Math.round(res.coutTotalCredit))}

### Revenus et charges
- Loyer mensuel : ${fmtEur(bien.loyer)}
- Loyer annuel : ${fmtEur(res.loyerAnnuel)}
- Charges annuelles totales : ${fmtEur(res.charges)}
  - Taxe foncière : ${fmtEur(bien.taxeFonciere)}
  - Assurance PNO : ${fmtEur(bien.assurancePNO)}
  - Entretien : ${fmtEur(bien.entretien)}
  - Comptable : ${fmtEur(bien.comptable)}
  - Autres : ${fmtEur(bien.autresCharges)}
- Taux de charges / loyers : ${fmt((res.charges / res.loyerAnnuel) * 100, 1)}%

### Indicateurs de rentabilité
- Rentabilité brute : ${fmtPct(res.rentaBrute)}
- Rentabilité nette : ${fmtPct(res.rentaNette)} → ${res.interpRentaNette[0]}
- Rentabilité net-net : ${fmtPct(res.rentaNetNet)} → ${res.interpRentaNetNet[0]}
- DSCR : ${fmt(res.dscr, 2)} → ${res.interpDSCR[0]}
- Cash-flow mensuel net : ${fmtEur(Math.round(res.cashflowMensuel))} → ${res.interpCash[0]}
- Score global : ${res.score}/25 → ${res.interpScore[0]}

### Évaluation qualitative
- Emplacement : ${bien.emplacement}/5 — ${emplacementLabel}

---

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans balises markdown. Structure exacte :
{"verdict":"string court max 12 mots","note_globale":"${res.score}/25","resume":"3-4 phrases résumant le bien","points_forts":["point 1","point 2","point 3"],"points_faibles":["point 1","point 2"],"risques":["risque 1","risque 2"],"opportunites":["opportunité 1","opportunité 2"],"analyse_cashflow":"2-3 phrases sur le cash-flow et soutenabilité financière mensuelle","analyse_credit":"2-3 phrases sur la structure du financement taux durée effet levier","analyse_rendement":"2-3 phrases comparant les 3 niveaux de rentabilité","conseils":["conseil actionnable 1","conseil actionnable 2","conseil actionnable 3"],"verdict_final":"3-4 phrases de conclusion avec recommandation claire acheter négocier ou éviter"}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  const raw = data.content?.map(i => i.text || "").join("") || "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function ScoreBadge({ label, emoji, note }) {
  const colors = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#10b981" };
  return (
    <div style={{ background: colors[note] + "22", border: `1.5px solid ${colors[note]}44`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ color: colors[note], fontWeight: 700, fontFamily: "Georgia, serif", fontSize: 13 }}>{label}</span>
      <span style={{ marginLeft: "auto", color: colors[note], fontWeight: 900, fontSize: 15 }}>{note}/5</span>
    </div>
  );
}

function InputField({ label, value, onChange, suffix, step = 1, min = 0 }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <input type="number" value={value} min={min} step={step} onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ flex: 1, border: "none", background: "transparent", padding: "10px 12px", fontSize: 14, color: "#1e293b", fontFamily: "Georgia, serif", fontWeight: 600, outline: "none" }} />
        {suffix && <span style={{ padding: "0 10px", color: "#94a3b8", fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 20, border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "#f8fafc", border: "none", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, color: "#1e293b", fontFamily: "Georgia, serif", fontSize: 15 }}>{title}</span>
        <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 18 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "16px 18px" }}>{children}</div>}
    </div>
  );
}

function BienForm({ bien, onChange }) {
  const f = (key) => (val) => onChange({ ...bien, [key]: val });
  return (
    <div>
      <Section title="Bien immobilier" icon="🏠">
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nom du bien</label>
          <input value={bien.nom} onChange={e => onChange({ ...bien, nom: e.target.value })} style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "#1e293b", fontFamily: "Georgia, serif", fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
        </div>
        <InputField label="Prix d'achat" value={bien.prix} onChange={f("prix")} suffix="€" step={1000} />
        <InputField label="Travaux" value={bien.travaux} onChange={f("travaux")} suffix="€" step={500} />
        <InputField label="Surface" value={bien.surface} onChange={f("surface")} suffix="m²" />
        <InputField label="Apport personnel" value={bien.apport} onChange={f("apport")} suffix="€" step={1000} />
      </Section>
      <Section title="Financement crédit" icon="🏦">
        <InputField label="Taux d'intérêt" value={bien.taux} onChange={f("taux")} suffix="%" step={0.05} />
        <InputField label="Durée" value={bien.duree} onChange={f("duree")} suffix="ans" step={1} min={1} />
        <InputField label="Taux assurance" value={bien.tauxAssurance} onChange={f("tauxAssurance")} suffix="%" step={0.05} />
      </Section>
      <Section title="Revenus locatifs" icon="💰">
        <InputField label="Loyer mensuel" value={bien.loyer} onChange={f("loyer")} suffix="€" step={50} />
      </Section>
      <Section title="Charges annuelles" icon="📋">
        <InputField label="Taxe foncière" value={bien.taxeFonciere} onChange={f("taxeFonciere")} suffix="€" step={100} />
        <InputField label="Entretien" value={bien.entretien} onChange={f("entretien")} suffix="€" step={100} />
        <InputField label="Assurance PNO" value={bien.assurancePNO} onChange={f("assurancePNO")} suffix="€" step={50} />
        <InputField label="Comptable" value={bien.comptable} onChange={f("comptable")} suffix="€" step={50} />
        <InputField label="Autres charges" value={bien.autresCharges} onChange={f("autresCharges")} suffix="€" step={100} />
      </Section>
      <Section title="Emplacement & Potentiel" icon="📍">
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Note d'emplacement</label>
        <div style={{ display: "grid", gap: 8 }}>
          {[["1","🔴","Mauvais secteur"],["2","🟠","Secteur moyen"],["3","🟡","Correct"],["4","🟢","Bon emplacement"],["5","💎","Très recherché"]].map(([val, em, label]) => (
            <button key={val} onClick={() => onChange({ ...bien, emplacement: parseInt(val) })} style={{ background: bien.emplacement === parseInt(val) ? "#0f172a" : "#f8fafc", color: bien.emplacement === parseInt(val) ? "white" : "#475569", border: "1.5px solid " + (bien.emplacement === parseInt(val) ? "#0f172a" : "#e2e8f0"), borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>
              <span>{em}</span><span>{label}</span><span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>{val}/5</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ResultCard({ label, value, sub, emoji, note }) {
  const colors = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#10b981" };
  return (
    <div style={{ background: note ? colors[note] + "11" : "#f8fafc", border: `1.5px solid ${note ? colors[note] + "44" : "#e2e8f0"}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#1e293b", fontFamily: "Georgia, serif" }}>{emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}{value}</div>
      {sub && <div style={{ fontSize: 12, color: note ? colors[note] : "#94a3b8", fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DiagnosticIA({ bien, res }) {
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lancer = async () => {
    setLoading(true); setError(null); setDiag(null);
    try { setDiag(await fetchDiagnostic(bien, res)); }
    catch (e) { setError("Erreur lors de l'analyse. Vérifiez les données et réessayez."); }
    setLoading(false);
  };

  const scoreColor = res.score >= 18 ? "#10b981" : res.score >= 10 ? "#eab308" : "#ef4444";

  return (
    <div>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .diag-enter { animation: fadeUp 0.5s ease forwards; }
        .diag-enter-delay-1 { animation: fadeUp 0.5s 0.1s ease both; }
        .diag-enter-delay-2 { animation: fadeUp 0.5s 0.2s ease both; }
        .diag-enter-delay-3 { animation: fadeUp 0.5s 0.3s ease both; }
        .diag-enter-delay-4 { animation: fadeUp 0.5s 0.4s ease both; }
        .diag-enter-delay-5 { animation: fadeUp 0.5s 0.5s ease both; }
      `}</style>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d2444 100%)", borderRadius: 22, padding: "36px 40px", marginBottom: 28, display: "flex", alignItems: "center", gap: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 220, height: 220, background: "rgba(16,185,129,0.07)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 80, bottom: -60, width: 160, height: 160, background: "rgba(59,130,246,0.05)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ fontSize: 56, zIndex: 1, filter: "drop-shadow(0 4px 12px rgba(16,185,129,0.4))" }}>🤖</div>
        <div style={{ zIndex: 1, flex: 1 }}>
          <div style={{ fontSize: 11, color: "#10b981", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Powered by Claude AI</div>
          <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>Diagnostic Expert IA</h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.7, maxWidth: 480 }}>
            Claude analyse en profondeur tous les indicateurs financiers de <strong style={{ color: "#e2e8f0" }}>{bien.nom}</strong> — forces, faiblesses, risques, opportunités — et vous livre une recommandation d'investissement argumentée.
          </p>
        </div>
        <div style={{ zIndex: 1, textAlign: "center", background: "rgba(255,255,255,0.06)", borderRadius: 18, padding: "18px 26px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Score actuel</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor, lineHeight: 1, fontFamily: "Georgia, serif" }}>{res.score}</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>/ 25</div>
          <div style={{ fontSize: 12, color: scoreColor, fontWeight: 700, marginTop: 6 }}>{res.interpScore[0]}</div>
        </div>
      </div>

      {/* Résumé des données envoyées */}
      {!diag && !loading && (
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 18, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>📋 Données transmises à l'IA</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[["Prix d'achat", fmtEur(bien.prix)], ["Loyer mensuel", fmtEur(bien.loyer)], ["Renta nette", fmtPct(res.rentaNette)], ["Cash-flow", fmtEur(Math.round(res.cashflowMensuel))], ["DSCR", fmt(res.dscr, 2)], ["Net-net", fmtPct(res.rentaNetNet)], ["Charges/an", fmtEur(res.charges)], ["Emplacement", `${bien.emplacement}/5`]].map(([k, v]) => (
              <div key={k} style={{ background: "white", borderRadius: 10, padding: "10px 14px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>{k}</div>
                <div style={{ fontWeight: 900, color: "#1e293b", fontSize: 14, fontFamily: "Georgia, serif" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!diag && !loading && (
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <button onClick={lancer} style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", borderRadius: 18, padding: "20px 56px", fontSize: 17, fontWeight: 900, cursor: "pointer", fontFamily: "Georgia, serif", boxShadow: "0 10px 30px rgba(16,185,129,0.4)", letterSpacing: "-0.01em", transition: "transform 0.15s" }}>
            ✨ Lancer le Diagnostic IA
          </button>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 12 }}>Analyse complète basée sur 15+ indicateurs financiers · Résultat en quelques secondes</p>
        </div>
      )}

      {loading && (
        <div style={{ background: "white", borderRadius: 22, padding: "56px 40px", textAlign: "center", border: "1.5px solid #e2e8f0" }}>
          <div style={{ fontSize: 52, marginBottom: 20, animation: "spin 3s linear infinite", display: "inline-block" }}>🔍</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", marginBottom: 10, fontFamily: "Georgia, serif" }}>Analyse en cours…</div>
          <div style={{ color: "#64748b", fontSize: 14, marginBottom: 30, lineHeight: 1.6 }}>Claude examine tous vos indicateurs financiers<br/>et rédige votre diagnostic personnalisé</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {["💰 Rentabilité", "🔒 DSCR", "📉 Cash-flow", "⚠️ Risques", "💡 Conseils"].map((step, i) => (
              <div key={step} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "7px 16px", fontSize: 12, color: "#10b981", fontWeight: 700, animation: `pulse 1.6s ${i * 0.25}s infinite` }}>{step}</div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 16, padding: 20, marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Erreur d'analyse</div><div style={{ fontSize: 13, color: "#b91c1c" }}>{error}</div></div>
          <button onClick={lancer} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Réessayer</button>
        </div>
      )}

      {diag && (
        <div>
          {/* Verdict */}
          <div className="diag-enter" style={{ background: res.score >= 18 ? "linear-gradient(135deg,#064e3b,#065f46)" : res.score >= 10 ? "linear-gradient(135deg,#78350f,#92400e)" : "linear-gradient(135deg,#7f1d1d,#991b1b)", borderRadius: 20, padding: "28px 32px", marginBottom: 22, color: "white", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 180, height: 180, background: "rgba(255,255,255,0.04)", borderRadius: "50%" }} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
              <div style={{ fontSize: 50 }}>{res.score >= 18 ? "💎" : res.score >= 10 ? "🟡" : "🔴"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 6 }}>Verdict de l'IA</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 10, letterSpacing: "-0.01em" }}>{diag.verdict}</div>
                <p style={{ margin: 0, opacity: 0.85, lineHeight: 1.75, fontSize: 14 }}>{diag.resume}</p>
              </div>
              <div style={{ textAlign: "center", background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 22px", border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Note globale</div>
                <div style={{ fontSize: 38, fontWeight: 900, fontFamily: "Georgia, serif" }}>{diag.note_globale}</div>
              </div>
            </div>
          </div>

          {/* Points forts / faibles */}
          <div className="diag-enter-delay-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 18, padding: 24 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#10b981", color: "white", borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 900, marginBottom: 18 }}>✅ Points forts</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {diag.points_forts?.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, color: "#14532d", lineHeight: 1.6 }}>
                    <span style={{ background: "#10b981", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 18, padding: 24 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#ef4444", color: "white", borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 900, marginBottom: 18 }}>⚠️ Points faibles</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {diag.points_faibles?.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, color: "#7f1d1d", lineHeight: 1.6 }}>
                    <span style={{ background: "#ef4444", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>!</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risques / Opportunités */}
          <div className="diag-enter-delay-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div style={{ background: "#fff7ed", border: "1.5px solid #fdba74", borderRadius: 18, padding: 24 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f97316", color: "white", borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 900, marginBottom: 18 }}>🔺 Risques identifiés</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {diag.risques?.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, color: "#7c2d12", lineHeight: 1.6 }}>
                    <span style={{ color: "#f97316", fontWeight: 900, fontSize: 16, marginTop: 1, flexShrink: 0 }}>▲</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 18, padding: 24 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#3b82f6", color: "white", borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 900, marginBottom: 18 }}>💡 Opportunités</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {diag.opportunites?.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, color: "#1e3a8a", lineHeight: 1.6 }}>
                    <span style={{ color: "#3b82f6", fontWeight: 900, fontSize: 16, marginTop: 1, flexShrink: 0 }}>→</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Analyses détaillées */}
          <div className="diag-enter-delay-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
            {[["💵 Analyse Cash-flow", diag.analyse_cashflow, "#10b981"], ["🏦 Analyse Crédit", diag.analyse_credit, "#3b82f6"], ["📊 Analyse Rendement", diag.analyse_rendement, "#8b5cf6"]].map(([title, content, color]) => (
              <div key={title} style={{ background: "white", border: `1.5px solid ${color}33`, borderTop: `4px solid ${color}`, borderRadius: 16, padding: 20 }}>
                <h4 style={{ margin: "0 0 12px", color, fontWeight: 900, fontSize: 14 }}>{title}</h4>
                <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.75 }}>{content}</p>
              </div>
            ))}
          </div>

          {/* Conseils */}
          <div className="diag-enter-delay-4" style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: 20, padding: 26, marginBottom: 18 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0f172a", color: "white", borderRadius: 12, padding: "6px 18px", fontSize: 14, fontWeight: 900, marginBottom: 20 }}>🎯 Conseils actionnables</div>
            <div style={{ display: "grid", gap: 12 }}>
              {diag.conseils?.map((conseil, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "#f8fafc", borderRadius: 14, padding: "16px 18px", border: "1px solid #f1f5f9" }}>
                  <div style={{ background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "white", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{i + 1}</div>
                  <p style={{ margin: 0, color: "#334155", fontSize: 14, lineHeight: 1.7 }}>{conseil}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Verdict final */}
          <div className="diag-enter-delay-5" style={{ background: "linear-gradient(135deg, #0f172a, #1a2744)", borderRadius: 22, padding: "30px 36px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -30, top: -30, width: 200, height: 200, background: "rgba(16,185,129,0.06)", borderRadius: "50%" }} />
            <div style={{ position: "absolute", left: -20, bottom: -40, width: 150, height: 150, background: "rgba(59,130,246,0.05)", borderRadius: "50%" }} />
            <h3 style={{ margin: "0 0 14px", color: "#10b981", fontWeight: 900, fontSize: 17, zIndex: 1, position: "relative" }}>📋 Conclusion & Recommandation finale</h3>
            <p style={{ margin: "0 0 22px", color: "#cbd5e1", fontSize: 15, lineHeight: 1.85, zIndex: 1, position: "relative" }}>{diag.verdict_final}</p>
            <button onClick={lancer} style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, zIndex: 1, position: "relative" }}>
              🔄 Relancer l'analyse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("simulateur");
  const [biens, setBiens] = useState([{ ...defaultBien }]);
  const [activeBien, setActiveBien] = useState(0);
  const [showAmort, setShowAmort] = useState(false);

  const resultats = useMemo(() => biens.map(calculer), [biens]);
  const res = resultats[activeBien];
  const bien = biens[activeBien];

  const updateBien = useCallback((idx, val) => { setBiens(prev => { const n = [...prev]; n[idx] = val; return n; }); }, []);
  const addBien = () => { if (biens.length < 3) { setBiens(prev => [...prev, { ...defaultBien, nom: `Bien ${prev.length + 1}` }]); setActiveBien(biens.length); } };
  const removeBien = (idx) => { if (biens.length > 1) { setBiens(prev => prev.filter((_, i) => i !== idx)); setActiveBien(Math.max(0, activeBien - 1)); } };

  const chargesData = [{ name: "Taxe foncière", value: bien.taxeFonciere }, { name: "Assurance PNO", value: bien.assurancePNO }, { name: "Entretien", value: bien.entretien }, { name: "Comptable", value: bien.comptable }, { name: "Autres", value: bien.autresCharges }].filter(d => d.value > 0);

  const amortAnnuel = useMemo(() => {
    const arr = [];
    for (let a = 0; a < bien.duree; a++) {
      const slice = res.amortissement.slice(a * 12, (a + 1) * 12);
      if (!slice.length) break;
      arr.push({ annee: `An ${a + 1}`, capitalRestant: slice[slice.length - 1]?.capitalRestant || 0, cashflowCumule: slice[slice.length - 1]?.cashflowCumule || 0, interets: slice.reduce((s, m) => s + m.interets, 0), capital: slice.reduce((s, m) => s + m.capitalRembourse, 0) });
    }
    return arr;
  }, [res.amortissement, bien.duree]);

  const TABS = [["simulateur", "📊 Simulateur", false], ["diagnostic", "🤖 Diagnostic IA", true], ["graphiques", "📈 Graphiques", false], ["amortissement", "🗓️ Amortissement", false], ["comparaison", "⚖️ Comparaison", false], ["guide", "📖 Guide", false]];
  const tabStyle = (t) => ({ padding: "10px 18px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif", borderRadius: "10px 10px 0 0", background: activeTab === t ? "#0f172a" : "transparent", color: activeTab === t ? "white" : "#64748b", transition: "all 0.2s", whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 50%, #f0fff4 100%)", fontFamily: "'Georgia', serif" }}>
      <div style={{ background: "#0f172a", color: "white", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Outil professionnel</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em" }}>🏠 Rentabilité <span style={{ color: "#10b981" }}>Immo</span></h1>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Simulateur · Diagnostic IA · Graphiques</div>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 16, padding: "14px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Score global</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: res.score >= 18 ? "#10b981" : res.score >= 10 ? "#eab308" : "#ef4444" }}>{res.score}<span style={{ fontSize: 16, color: "#475569" }}>/25</span></div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{res.interpScore[0]}</div>
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", padding: "0 40px", display: "flex", gap: 4, overflowX: "auto" }}>
        {TABS.map(([t, label, isAI]) => (
          <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
            {isAI ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{label}<span style={{ background: "#10b981", color: "white", fontSize: 9, padding: "2px 6px", borderRadius: 20, fontWeight: 900 }}>NEW</span></span> : label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 156px)" }}>
        <div style={{ width: 340, minWidth: 340, background: "white", borderRight: "1.5px solid #e2e8f0", padding: "24px 20px", overflowY: "auto", maxHeight: "calc(100vh - 156px)" }}>
          {biens.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {biens.map((b, i) => <button key={i} onClick={() => setActiveBien(i)} style={{ flex: 1, padding: "8px 10px", border: "1.5px solid " + (activeBien === i ? "#0f172a" : "#e2e8f0"), borderRadius: 10, background: activeBien === i ? "#0f172a" : "white", color: activeBien === i ? "white" : "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{b.nom}</button>)}
            </div>
          )}
          <BienForm bien={bien} onChange={(v) => updateBien(activeBien, v)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {biens.length < 3 && <button onClick={addBien} style={{ flex: 1, padding: "12px", border: "1.5px dashed #10b981", borderRadius: 12, background: "#f0fdf4", color: "#10b981", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Ajouter un bien</button>}
            {biens.length > 1 && <button onClick={() => removeBien(activeBien)} style={{ padding: "12px 16px", border: "1.5px solid #fecaca", borderRadius: 12, background: "#fef2f2", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🗑️</button>}
          </div>
        </div>

        <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
          {activeTab === "simulateur" && (
            <div>
              <div style={{ background: res.score >= 18 ? "linear-gradient(135deg,#064e3b,#065f46)" : res.score >= 10 ? "linear-gradient(135deg,#78350f,#92400e)" : "linear-gradient(135deg,#7f1d1d,#991b1b)", color: "white", borderRadius: 18, padding: "20px 28px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ fontSize: 48 }}>{res.interpScore[1]}</div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.15em", textTransform: "uppercase" }}>Verdict global</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{res.interpScore[0]}</div>
                  <div style={{ opacity: 0.8, fontSize: 13, marginTop: 2 }}>{bien.nom} — Score {res.score}/25</div>
                </div>
                <div style={{ marginLeft: "auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
                  <div><div style={{ fontSize: 11, opacity: 0.7 }}>Prix achat</div><div style={{ fontWeight: 900, fontSize: 15 }}>{fmtEur(bien.prix)}</div></div>
                  <div><div style={{ fontSize: 11, opacity: 0.7 }}>Loyer</div><div style={{ fontWeight: 900, fontSize: 15 }}>{fmtEur(bien.loyer)}/mois</div></div>
                  <div><div style={{ fontSize: 11, opacity: 0.7 }}>Surface</div><div style={{ fontWeight: 900, fontSize: 15 }}>{bien.surface} m²</div></div>
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 16, borderLeft: "4px solid #3b82f6", paddingLeft: 12 }}>💰 Coûts d'acquisition</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <ResultCard label="Prix + Notaire" value={fmtEur(res.notaire)} sub={`Notaire: ${fmtEur(res.notaire - bien.prix)}`} />
                  <ResultCard label="Coût total" value={fmtEur(res.coutTotal)} sub={bien.travaux > 0 ? `dont ${fmtEur(bien.travaux)} travaux` : "Frais inclus"} />
                  <ResultCard label="À emprunter" value={fmtEur(res.aEmprunter)} sub={`Apport: ${fmtEur(bien.apport)}`} />
                  <ResultCard label="Prix au m²" value={fmtEur(res.prixM2)} sub={`${fmtEur(res.prixM2Travaux)} travaux incl.`} />
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 16, borderLeft: "4px solid #8b5cf6", paddingLeft: 12 }}>🏦 Financement</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <ResultCard label="Mensualité crédit" value={fmtEur(Math.round(res.mensualiteCredit))} sub="Hors assurance" />
                  <ResultCard label="Assurance mensuelle" value={fmtEur(Math.round(res.mensualiteAssurance))} sub={`${bien.tauxAssurance}% annuel`} />
                  <ResultCard label="Mensualité totale" value={fmtEur(Math.round(res.mensualiteTotale))} sub="Crédit + assurance" />
                  <ResultCard label="Coût total crédit" value={fmtEur(Math.round(res.coutTotalCredit))} sub="Intérêts totaux" />
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 16, borderLeft: "4px solid #10b981", paddingLeft: 12 }}>📊 Indicateurs de rentabilité</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
                  <ResultCard label="Rentabilité brute" value={fmtPct(res.rentaBrute)} sub="Loyers / coût total" />
                  <ResultCard label="Cash-flow mensuel net" value={fmtEur(Math.round(res.cashflowMensuel))} sub={res.interpCash[0]} note={res.interpCash[1]} emoji={res.interpCash[2]} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <ResultCard label="Rentabilité nette" value={fmtPct(res.rentaNette)} sub={res.interpRentaNette[0]} note={res.interpRentaNette[1]} emoji={res.interpRentaNette[2]} />
                  <ResultCard label="Rentabilité net-net" value={fmtPct(res.rentaNetNet)} sub={res.interpRentaNetNet[0]} note={res.interpRentaNetNet[1]} emoji={res.interpRentaNetNet[2]} />
                  <ResultCard label="DSCR" value={fmt(res.dscr, 2)} sub={res.interpDSCR[0]} note={res.interpDSCR[1]} emoji={res.interpDSCR[2]} />
                </div>
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 16, borderLeft: "4px solid #f59e0b", paddingLeft: 12 }}>🎯 Notes par critère (/5 chacun)</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                  <ScoreBadge label="Renta net-net" emoji={res.interpRentaNetNet[2]} note={res.interpRentaNetNet[1]} />
                  <ScoreBadge label="DSCR" emoji={res.interpDSCR[2]} note={res.interpDSCR[1]} />
                  <ScoreBadge label="Renta nette" emoji={res.interpRentaNette[2]} note={res.interpRentaNette[1]} />
                  <ScoreBadge label="Cash-flow" emoji={res.interpCash[2]} note={res.interpCash[1]} />
                  <ScoreBadge label="Emplacement" emoji={bien.emplacement >= 4 ? "💎" : bien.emplacement === 3 ? "🟡" : "🔴"} note={bien.emplacement} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "diagnostic" && <DiagnosticIA key={bien.nom} bien={bien} res={res} />}

          {activeTab === "graphiques" && (
            <div style={{ display: "grid", gap: 28 }}>
              <div style={{ background: "white", borderRadius: 18, padding: 24, border: "1.5px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 20px", fontWeight: 900, color: "#1e293b" }}>📉 Évolution du capital restant dû</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={amortAnnuel}>
                    <defs><linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="annee" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => fmt(v / 1000) + "k€"} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtEur(v)} />
                    <Area type="monotone" dataKey="capitalRestant" stroke="#3b82f6" fill="url(#cg1)" strokeWidth={2} name="Capital restant" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={{ background: "white", borderRadius: 18, padding: 24, border: "1.5px solid #e2e8f0" }}>
                  <h3 style={{ margin: "0 0 20px", fontWeight: 900, color: "#1e293b" }}>🟢 Cash-flow cumulé</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={amortAnnuel}>
                      <defs><linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="annee" tick={{ fontSize: 10 }} /><YAxis tickFormatter={v => fmt(v / 1000) + "k€"} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => fmtEur(v)} />
                      <Area type="monotone" dataKey="cashflowCumule" stroke="#10b981" fill="url(#cg2)" strokeWidth={2} name="Cash-flow cumulé" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {chargesData.length > 0 && (
                  <div style={{ background: "white", borderRadius: 18, padding: 24, border: "1.5px solid #e2e8f0" }}>
                    <h3 style={{ margin: "0 0 20px", fontWeight: 900, color: "#1e293b" }}>🥧 Répartition des charges</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={chargesData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {chargesData.map((_, i) => <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmtEur(v)} /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div style={{ background: "white", borderRadius: 18, padding: 24, border: "1.5px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 20px", fontWeight: 900, color: "#1e293b" }}>📊 Intérêts vs Capital remboursé par an</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={amortAnnuel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="annee" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => fmt(v / 1000) + "k€"} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtEur(v)} /><Legend />
                    <Bar dataKey="interets" name="Intérêts" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="capital" name="Capital remboursé" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === "amortissement" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontWeight: 900, color: "#1e293b" }}>🗓️ Tableau d'amortissement — {bien.nom}</h2>
                <button onClick={() => setShowAmort(!showAmort)} style={{ padding: "8px 16px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "white", color: "#475569", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{showAmort ? "Vue annuelle" : "Vue mensuelle"}</button>
              </div>
              <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ overflowX: "auto", maxHeight: "65vh", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ position: "sticky", top: 0, background: "#0f172a", color: "white" }}>
                      <tr>{["Mois","Mensualité","Intérêts","Capital remb.","Assurance","Total","Capital restant","Cash-flow cumulé"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(showAmort ? res.amortissement : res.amortissement.filter(m => m.mois % 12 === 0 || m.mois === 1)).map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>{row.mois}</td>
                          {[row.mensualiteCredit, row.interets, row.capitalRembourse, row.assurance, row.mensualiteTotale].map((v, j) => <td key={j} style={{ padding: "10px 14px", textAlign: "right", color: "#1e293b", fontFamily: "monospace" }}>{fmtEur(v)}</td>)}
                          <td style={{ padding: "10px 14px", textAlign: "right", color: "#3b82f6", fontWeight: 700, fontFamily: "monospace" }}>{fmtEur(row.capitalRestant)}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", color: row.cashflowCumule >= 0 ? "#10b981" : "#ef4444", fontWeight: 700, fontFamily: "monospace" }}>{fmtEur(row.cashflowCumule)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "comparaison" && (
            <div>
              <h2 style={{ margin: "0 0 20px", fontWeight: 900, color: "#1e293b" }}>⚖️ Comparaison des biens</h2>
              {biens.length < 2 ? (
                <div style={{ background: "white", borderRadius: 18, padding: 40, border: "1.5px dashed #e2e8f0", textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>➕</div>
                  <div style={{ color: "#64748b", fontWeight: 600 }}>Ajoutez un deuxième bien dans la barre latérale pour comparer</div>
                </div>
              ) : (
                <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#0f172a" }}>
                        <th style={{ padding: "14px 18px", textAlign: "left", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Indicateur</th>
                        {biens.map((b, i) => <th key={i} style={{ padding: "14px 18px", textAlign: "center", color: "white", fontSize: 14, fontWeight: 900 }}>{b.nom}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[["Prix d'achat",(r,b)=>fmtEur(b.prix),false],["Coût total",(r)=>fmtEur(r.coutTotal),false],["Loyer mensuel",(r,b)=>fmtEur(b.loyer),true],["Mensualité totale",(r)=>fmtEur(Math.round(r.mensualiteTotale)),false],["Rentabilité brute",(r)=>fmtPct(r.rentaBrute),true],["Rentabilité nette",(r)=>fmtPct(r.rentaNette),true],["Rentabilité net-net",(r)=>fmtPct(r.rentaNetNet),true],["DSCR",(r)=>fmt(r.dscr,2),true],["Cash-flow mensuel",(r)=>fmtEur(Math.round(r.cashflowMensuel)),true],["Score global /25",(r)=>r.score,true],["Verdict",(r)=>r.interpScore[0],false]].map(([label,fn,higher],rowIdx) => {
                        const values = resultats.map((r, i) => fn(r, biens[i]));
                        const numValues = values.map(v => typeof v === "number" ? v : parseFloat(v.replace(/[^\d.-]/g,"")));
                        const best = higher ? Math.max(...numValues) : null;
                        return (
                          <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? "#f8fafc" : "white", borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 18px", fontWeight: 600, color: "#475569", fontSize: 13 }}>{label}</td>
                            {values.map((v, i) => { const isBest = higher && numValues[i] === best && numValues.filter(n => n === best).length < numValues.length; return <td key={i} style={{ padding: "12px 18px", textAlign: "center", fontWeight: 700, color: isBest ? "#10b981" : "#1e293b", background: isBest ? "#f0fdf4" : "transparent", fontSize: 14 }}>{isBest && "✅ "}{v}</td>; })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "guide" && (
            <div style={{ maxWidth: 760 }}>
              <h2 style={{ margin: "0 0 24px", fontWeight: 900, color: "#1e293b" }}>📖 Guide des indicateurs</h2>
              {[
                { titre: "🏠 Rentabilité brute", color: "#3b82f6", formule: "Loyers annuels / Coût total × 100", description: "Premier indicateur rapide. Ne tient pas compte des charges ni du crédit. Utile pour une première comparaison.", seuils: [["< 4%","Faible"],["4–6%","Correct"],["6–8%","Bon"],["> 8%","Excellent"]] },
                { titre: "📊 Rentabilité nette", color: "#8b5cf6", formule: "(Loyers − Charges) / Coût total × 100", description: "Bon indicateur du potentiel réel. Intègre les charges mais pas le crédit.", seuils: [["< 4%","Faible"],["4–6%","Correct"],["6–8%","Bon"],["8–10%","Très bon"],["> 10%","Excellent"]] },
                { titre: "💎 Rentabilité net-net", color: "#10b981", formule: "(Loyers − Charges − Crédit annuel) / Capital investi × 100", description: "L'indicateur clé. Mesure le cash réel généré par rapport au capital investi.", seuils: [["< 0%","🔴 Perte mensuelle"],["0–3%","🟠 Faible"],["3–6%","🟡 Correct"],["6–10%","🟢 Bon"],["> 10%","💎 Excellent"]] },
                { titre: "🔒 DSCR", color: "#f59e0b", formule: "(Loyers − Charges) / Crédit annuel", description: "Mesure si vos loyers couvrent votre crédit. En dessous de 1, le bien ne s'autofinance pas.", seuils: [["< 1","🔴 Dangereux"],["= 1","🟠 Équilibre"],["1–1.2","🟡 Correct"],["1.2–1.5","🟢 Solide"],["> 1.5","💎 Très sécurisé"]] },
                { titre: "💵 Cash-flow mensuel", color: "#ef4444", formule: "Loyer − Mensualité crédit − (Charges / 12)", description: "L'argent qui reste dans votre poche chaque mois après avoir tout payé.", seuils: [["< 0€","🔴 Perte mensuelle"],["0–100€","🟠 Moyen"],["100–300€","🟡 Correct"],["300–500€","🟢 Bon"],["> 500€","💎 Excellent"]] },
              ].map((item, i) => (
                <div key={i} style={{ background: "white", borderRadius: 18, padding: 24, marginBottom: 20, border: `1.5px solid ${item.color}33`, borderLeft: `5px solid ${item.color}` }}>
                  <h3 style={{ margin: "0 0 8px", color: item.color, fontWeight: 900, fontSize: 17 }}>{item.titre}</h3>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 14px", fontFamily: "monospace", fontSize: 13, color: "#475569", marginBottom: 12 }}>📐 {item.formule}</div>
                  <p style={{ color: "#475569", lineHeight: 1.6, margin: "0 0 14px", fontSize: 14 }}>{item.description}</p>
                  <div style={{ display: "grid", gap: 6 }}>
                    {item.seuils.map(([seuil, label], j) => (
                      <div key={j} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: item.color, minWidth: 70 }}>{seuil}</span>
                        <span style={{ color: "#64748b" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
