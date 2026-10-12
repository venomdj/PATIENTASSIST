"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CalendarDays, CheckCircle2, IndianRupee, Loader2, MapPin, Search, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Slot {
  id: string; hospital: string; category: "public" | "private"; department: string; doctor: string | null;
  date: string; time: string; fee: number; location: string; distance_km: number; quota_tokens: number | null; source: "live" | "demo";
}
interface Triage { department: string; urgency: string; city: string; max_fee: number | null; note: string | null }
interface StageResult { staged: boolean; otp_sent: boolean; stopped_at: string; source: string; steps: string[] }

const PRESETS = [
  "Pediatric OPD (Delhi)",
  "Urgent MRI scan in Delhi NCR",
  "Cardiology AIIMS",
  "Earliest Pediatric Neurology in Delhi NCR, under ₹1500 or public AIIMS",
];

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

export default function Page() {
  const [query, setQuery] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const esRef = useRef<EventSource | null>(null);

  async function search(q: string) {
    if (q.trim().length < 3 || running) return;
    esRef.current?.close();
    setRunning(true); setError(null); setSteps([]); setSlots([]); setDone(false); setTriage(null);
    try {
      const res = await fetch(`${API}/api/search-slots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const { job_id, triage: t, live_mode } = await res.json();
      setTriage(t);
      setSteps([live_mode ? "Live browser agents started." : "Demo mode: no TinyFish key set, using sample data."]);
      const es = new EventSource(`${API}/api/agent/stream?job_id=${job_id}`);
      esRef.current = es;
      es.addEventListener("progress", (e) => setSteps((s) => [...s, JSON.parse((e as MessageEvent).data).message]));
      es.addEventListener("result", (e) => setSlots(JSON.parse((e as MessageEvent).data).slots));
      es.addEventListener("completed", () => { setDone(true); setRunning(false); es.close(); });
      es.addEventListener("error", (e) => {
        const data = (e as MessageEvent).data;
        if (data) setError(JSON.parse(data).message);
        else if (es.readyState === EventSource.CLOSED || es.readyState === EventSource.CONNECTING) setError("Lost connection to the server. Check that the backend is running, then try again.");
        setRunning(false); es.close();
      });
    } catch (err) {
      setError(`Could not start the search. ${(err as Error).message}. Check that the backend is running at ${API}.`);
      setRunning(false);
    }
  }

  const earliest = slots[0]?.id;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-semibold text-tealdk">Find the earliest doctor visit, public or private.</h1>
        <p className="mt-3 max-w-2xl text-slate2">Describe what you need. Our agents check government and private hospital booking pages for you and line up the options.</p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); search(query); }} role="search" className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="q" className="sr-only">What do you need?</label>
        <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Earliest pediatric neurology in Delhi NCR, under ₹1500"
          className="flex-1 rounded-lg border-2 border-slate-300 bg-white px-4 py-3.5 text-lg placeholder:text-slate-500" />
        <button disabled={running || query.trim().length < 3} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal2 px-6 py-3.5 font-semibold text-white hover:bg-tealdk disabled:opacity-50">
          {running ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
          {running ? "Searching" : "Find slots"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick searches">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => { setQuery(p); search(p); }} className="rounded-full border border-teal2/40 bg-mint px-4 py-1.5 text-sm font-medium text-tealdk hover:bg-teal2 hover:text-white">{p}</button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-6 flex gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p>{error}</p>
        </div>
      )}

      {triage && !triage.note && (
        <p className="mt-6 text-slate2">Searching <strong className="text-ink">{triage.department}</strong> in {triage.city}
          {triage.urgency === "urgent" && " (marked urgent)"}{triage.max_fee ? `, up to ₹${triage.max_fee}` : ""}.</p>
      )}

      {steps.length > 0 && (
        <section aria-live="polite" aria-label="Agent progress" className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">What the agents are doing</h2>
          <ul className="max-h-52 space-y-2 overflow-y-auto">
            {steps.map((s, i) => {
              const last = i === steps.length - 1 && running;
              return (
                <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 text-sm">
                  {last ? <span className="relative mt-1.5 flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal2 opacity-60" /><span className="relative h-2.5 w-2.5 rounded-full bg-teal2" /></span>
                        : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal2" aria-hidden />}
                  <span>{s}</span>
                </motion.li>
              );
            })}
          </ul>
        </section>
      )}

      {done && slots.length === 0 && !error && (
        <p className="mt-8 rounded-lg bg-white p-5">No slots matched. Try removing the fee limit or searching a broader department.</p>
      )}

      {slots.length > 0 && (
        <section className="mt-8" aria-label="Slot comparison">
          <h2 className="mb-4 text-2xl font-semibold">{slots.length} slots, earliest first</h2>
          <div className="space-y-3">
            {slots.map((s) => (
              <article key={s.id} className={`grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-center ${s.id === earliest ? "border-teal2 border-2" : "border-slate-200"}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{s.hospital}</h3>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.category === "public" ? "bg-mint text-tealdk" : "bg-amber-100 text-amber2"}`}>
                      {s.category === "public" ? "Government" : "Private super-specialty"}
                    </span>
                    {s.id === earliest && <span className="rounded-md bg-teal2 px-2 py-0.5 text-xs font-semibold text-white">Earliest</span>}
                    {s.source === "demo" && <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-700">Sample data</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate2">{s.doctor ?? s.department}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate2"><MapPin className="h-4 w-4" aria-hidden />{s.location} · {s.distance_km} km</p>
                </div>
                <div className="flex items-start gap-2"><CalendarDays className="mt-1 h-5 w-5 text-teal2" aria-hidden />
                  <div><p className="font-semibold">{fmtDate(s.date)}</p><p className="text-sm text-slate2">{s.time}{s.quota_tokens != null && ` · ${s.quota_tokens} tokens left`}</p></div></div>
                <div className="flex items-center gap-1 text-xl font-semibold"><IndianRupee className="h-5 w-5" aria-hidden />{s.fee === 0 ? "0" : s.fee.toLocaleString("en-IN")}
                  {s.category === "public" && <span className="ml-1 text-xs font-normal text-slate2">nominal</span>}</div>
                <button onClick={() => setChosen(s)} className="rounded-lg bg-tealdk px-5 py-3 font-semibold text-white hover:bg-teal2">Stage appointment</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>{chosen && <BookingModal slot={chosen} onClose={() => setChosen(null)} />}</AnimatePresence>
    </main>
  );
}

function BookingModal({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<StageResult | null>(null);
  const valid = name.trim().length >= 2 && /^[6-9]\d{9}$/.test(phone);

  async function stage() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/stage-booking`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, patient_name: name.trim(), phone }) });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setResult(await res.json());
    } catch (e) { setErr(`Could not stage the booking. ${(e as Error).message}`); }
    setBusy(false);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="bm-title" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between">
          <h2 id="bm-title" className="text-2xl font-semibold">Stage appointment</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-slate2">{slot.hospital}, {fmtDate(slot.date)} at {slot.time}</p>

        {!result ? (
          <>
            <p className="mt-4 rounded-lg bg-mint p-3 text-sm text-tealdk">The agent fills in the form and requests the OTP. You enter the OTP yourself to confirm. Nothing is booked until then.</p>
            <label className="mt-4 block font-medium" htmlFor="pn">Patient name</label>
            <input id="pn" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-slate-300 px-3 py-2.5" />
            <label className="mt-4 block font-medium" htmlFor="ph">Mobile number</label>
            <input id="ph" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border-2 border-slate-300 px-3 py-2.5" />
            {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
            <button disabled={!valid || busy} onClick={stage} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-teal2 py-3 font-semibold text-white hover:bg-tealdk disabled:opacity-50">
              {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}{busy ? "Staging" : "Fill form and send OTP"}
            </button>
          </>
        ) : (
          <div className="mt-4" aria-live="polite">
            <p className="flex items-center gap-2 font-semibold text-tealdk"><CheckCircle2 className="h-5 w-5" aria-hidden />Form ready at: {result.stopped_at}</p>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate2">{result.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
            <p className="mt-3 text-sm">{result.otp_sent ? "Check your phone for the OTP and finish on the hospital's page." : "Open the hospital's page to finish verification."}
              {result.source === "demo" && " (Simulated in demo mode.)"}</p>
            <button onClick={onClose} className="mt-5 w-full rounded-lg border-2 border-teal2 py-3 font-semibold text-tealdk">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
