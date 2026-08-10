"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const APP_NAME = "Blue Nook";
const STORE = "blue-nook:v1";
const TAGS = ["Работа", "Паблик", "Личное"] as const;
const STAGES = [0, 100, 300, 650, 1100];
const STAGE_NAMES = ["Крошка", "Маленький исследователь", "Растущий котёнок", "Юный кот", "Верный спутник"];
type Tag = typeof TAGS[number];
type Task = { id: string; text: string; tag: Tag | null; completed: boolean; createdAt: string; completedAt: string | null };
type Focus = { id: string; startedAt: string; completedAt: string; durationMinutes: number };
type Data = { petName: string; onboarded: boolean; tasks: Task[]; focus: Focus[]; volume: number; uiSounds: boolean };
type TimerState = { duration: number; remaining: number; target: number | null; startedAt: string | null; running: boolean };
const blank: Data = { petName: "Облачко", onboarded: false, tasks: [], focus: [], volume: .35, uiSounds: true };

function safeLoad(): Data {
  if (typeof window === "undefined") return blank;
  try { return { ...blank, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { return blank; }
}
const key = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE");
const plural = (n: number, a: string, b: string, c: string) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? b : c;

export default function Home() {
  const [data, setData] = useState<Data>(blank);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [newTag, setNewTag] = useState<Tag | null>("Личное");
  const [status, setStatus] = useState<"all" | "active" | "done">("all");
  const [tagFilter, setTagFilter] = useState<Tag | "Все">("Все");
  const [timer, setTimer] = useState<TimerState>({ duration: 25, remaining: 1500, target: null, startedAt: null, running: false });
  const [custom, setCustom] = useState(30);
  const [mood, setMood] = useState<"calm" | "happy" | "sleepy">("calm");
  const [reaction, setReaction] = useState("Сегодня можно двигаться в своём ритме.");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [noiseState, setNoiseState] = useState<"idle" | "playing" | "missing">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setData(safeLoad()); setReady(true); const saved = localStorage.getItem(`${STORE}:timer`); if (saved) try { setTimer(JSON.parse(saved)); } catch {} }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORE, JSON.stringify(data)); }, [data, ready]);
  useEffect(() => { if (ready) localStorage.setItem(`${STORE}:timer`, JSON.stringify(timer)); }, [timer, ready]);

  const ping = (kind: "soft" | "success" = "soft") => {
    if (!data.uiSounds) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(kind === "success" ? 660 : 360, ctx.currentTime);
    if (kind === "success") osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + .12);
    gain.gain.setValueAtTime(.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .17);
  };
  const react = (message: string, nextMood: "happy" | "sleepy" = "happy") => {
    setMood(nextMood); setReaction(message); if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => { setMood("calm"); setReaction("Я рядом. Продолжим, когда захочется."); }, 3800);
  };

  const xp = useMemo(() => data.tasks.filter(t => t.completed).length * 10 + data.focus.reduce((n, f) => n + Math.min(45, Math.round(f.durationMinutes * .6)), 0), [data]);
  const stage = Math.max(0, STAGES.findLastIndex(x => xp >= x));
  const next = STAGES[stage + 1];
  const stageProgress = next ? ((xp - STAGES[stage]) / (next - STAGES[stage])) * 100 : 100;
  const today = key(new Date());
  const todayTasks = data.tasks.filter(t => t.completedAt && key(t.completedAt) === today);
  const todayFocus = data.focus.filter(f => key(f.completedAt) === today);
  const todayMinutes = todayFocus.reduce((n, f) => n + f.durationMinutes, 0);

  useEffect(() => {
    if (!timer.running || !timer.target) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((timer.target! - Date.now()) / 1000));
      if (left === 0) {
        const completed: Focus = { id: crypto.randomUUID(), startedAt: timer.startedAt || new Date(Date.now() - timer.duration * 60000).toISOString(), completedAt: new Date().toISOString(), durationMinutes: timer.duration };
        setData(d => ({ ...d, focus: [...d.focus, completed] }));
        setTimer(t => ({ ...t, remaining: t.duration * 60, running: false, target: null, startedAt: null }));
        ping("success"); react("Мы хорошо поработали. Я чувствую, как расту!");
      } else setTimer(t => ({ ...t, remaining: left }));
    };
    tick(); const id = setInterval(tick, 500); return () => clearInterval(id);
  }, [timer.running, timer.target]);

  const addTask = () => {
    const clean = text.trim(); if (!clean) return;
    setData(d => ({ ...d, tasks: [{ id: crypto.randomUUID(), text: clean, tag: newTag, completed: false, createdAt: new Date().toISOString(), completedAt: null }, ...d.tasks] }));
    setText(""); ping();
  };
  const toggleTask = (id: string) => setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t) }));
  const completeTask = (id: string, completed: boolean) => { toggleTask(id); ping(completed ? "soft" : "success"); if (!completed) react("Мур, ещё одно дело готово!"); };
  const choosePreset = (minutes: number) => { setTimer({ duration: minutes, remaining: minutes * 60, target: null, startedAt: null, running: false }); ping(); };
  const startPause = () => setTimer(t => t.running ? { ...t, running: false, target: null } : { ...t, running: true, target: Date.now() + t.remaining * 1000, startedAt: t.startedAt || new Date().toISOString() });
  const resetTimer = () => setTimer(t => ({ ...t, remaining: t.duration * 60, running: false, target: null, startedAt: null }));
  const toggleNoise = async () => {
    const a = audioRef.current; if (!a) return;
    if (noiseState === "playing") { a.pause(); setNoiseState("idle"); return; }
    try { await a.play(); setNoiseState("playing"); } catch { setNoiseState("missing"); }
  };
  const filtered = data.tasks.filter(t => (status === "all" || (status === "done" ? t.completed : !t.completed)) && (tagFilter === "Все" || t.tag === tagFilter));

  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1), offset = (first.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, i) => { const day = i - offset + 1; return day > 0 && day <= days ? new Date(month.getFullYear(), month.getMonth(), day) : null; });
  }, [month]);
  const dayStats = (dateKey: string) => ({ tasks: data.tasks.filter(t => t.completedAt && key(t.completedAt) === dateKey), focus: data.focus.filter(f => key(f.completedAt) === dateKey) });
  const selected = selectedDay ? dayStats(selectedDay) : null;
  const timeText = `${String(Math.floor(timer.remaining / 60)).padStart(2, "0")}:${String(timer.remaining % 60).padStart(2, "0")}`;

  if (!ready) return null;
  return <main className="app-shell">
    <video className="ambient-video" autoPlay muted loop playsInline poster="/assets/pet/character-reference.png"><source src="/assets/background/ambient-field.mp4" type="video/mp4" /></video>
    <div className="backdrop" />
    <header className="topbar">
      <div><span className="eyebrow">Личное пространство</span><h1>{APP_NAME}</h1></div>
      <div className="datebox"><b>{new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</b><LiveClock /></div>
      <button className="sound-toggle" onClick={() => setData(d => ({ ...d, uiSounds: !d.uiSounds }))}>Звуки интерфейса: {data.uiSounds ? "вкл" : "выкл"}</button>
    </header>

    <section className="dashboard">
      <section className="focus-panel panel">
        <div className="section-head"><div><span className="eyebrow">Глубокая работа</span><h2>Фокус</h2></div><span className={`status-dot ${timer.running ? "on" : ""}`}>{timer.running ? "в процессе" : "готов"}</span></div>
        <div className="preset-row">{[25,45,60].map(n => <button key={n} className={timer.duration === n ? "active" : ""} onClick={() => choosePreset(n)}>{n} мин</button>)}<button onClick={() => choosePreset(Math.max(1, custom))}>Свой</button></div>
        <div className="custom-row"><label>Своя длительность</label><input type="number" min="1" max="180" value={custom} onChange={e => setCustom(+e.target.value)} /></div>
        <div className="timer-ring" style={{"--progress": `${100 - timer.remaining / (timer.duration * 60) * 100}%`} as React.CSSProperties}><span>{timeText}</span><small>{timer.running ? "сохраняем ритм" : "время принадлежит вам"}</small></div>
        <div className="timer-actions"><button className="primary" onClick={() => { startPause(); ping(); }}>{timer.running ? "Пауза" : timer.remaining < timer.duration * 60 ? "Продолжить" : "Начать"}</button><button onClick={resetTimer}>Сбросить</button></div>
        <div className="noise-control">
          <div><span className="wave-bars" aria-hidden="true"><i/><i/><i/><i/></span><div><b>Brown noise</b><small>{noiseState === "missing" ? "Добавьте /public/audio/brown-noise.mp3" : noiseState === "playing" ? "играет по кругу" : "тихий звуковой фон"}</small></div></div>
          <button onClick={toggleNoise}>{noiseState === "playing" ? "Пауза" : "Включить"}</button>
          <input aria-label="Громкость brown noise" type="range" min="0" max="1" step=".01" value={data.volume} onChange={e => { const v=+e.target.value; setData(d=>({...d,volume:v})); if(audioRef.current) audioRef.current.volume=v; }} />
          <audio ref={audioRef} src="/audio/brown-noise.mp3" loop onError={() => setNoiseState("missing")} />
        </div>
      </section>

      <section className="pet-panel panel">
        <div className="pet-copy"><span className="eyebrow">Растём вместе</span><h2>{data.petName}</h2><p>{reaction}</p></div>
        <div className={`pet-stage mood-${mood}`}><div className="pet-glow"/><img src={`/assets/pet/stage-${stage + 1}-${mood}.png`} alt={`${data.petName}, ${STAGE_NAMES[stage]}`} /></div>
        <div className="pet-progress"><div><b>{STAGE_NAMES[stage]}</b><span>{next ? `${next - xp} XP до следующего роста` : "Максимальная стадия"}</span></div><div className="progress"><i style={{width:`${stageProgress}%`}}/></div></div>
        <button className="rename" onClick={() => { const name = prompt("Новое имя котёнка", data.petName); if(name?.trim()) setData(d=>({...d,petName:name.trim()})); }}>Переименовать</button>
      </section>

      <section className="stats-strip panel">
        <Stat value={todayTasks.length} label={plural(todayTasks.length, "задача готова", "задачи готовы", "задач готово")} />
        <Stat value={`${todayMinutes} м`} label="в фокусе сегодня" />
        <Stat value={todayFocus.length} label={plural(todayFocus.length, "сессия", "сессии", "сессий")} />
      </section>

      <section className="todo-panel panel">
        <div className="section-head"><div><span className="eyebrow">Маленькие шаги</span><h2>Дела</h2></div><span className="task-count">{data.tasks.filter(t=>!t.completed).length} активных</span></div>
        <div className="add-task"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Что хочется сделать?" maxLength={240}/><button className="primary" onClick={addTask}>Добавить</button></div>
        <div className="tag-pick">{TAGS.map(t=><button key={t} data-tag={t} className={newTag===t?"selected":""} onClick={()=>setNewTag(t)}>{t}</button>)}</div>
        <div className="filters"><div>{[["all","Все"],["active","Активные"],["done","Готовые"]].map(([v,l])=><button key={v} className={status===v?"active":""} onClick={()=>setStatus(v as typeof status)}>{l}</button>)}</div><select value={tagFilter} onChange={e=>setTagFilter(e.target.value as Tag|"Все")}><option>Все</option>{TAGS.map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="task-list">{filtered.length ? filtered.map(task=><article className={`task ${task.completed?"done":""}`} key={task.id}>
          <button className="check" aria-label={task.completed?"Вернуть задачу":"Завершить задачу"} onClick={()=>completeTask(task.id,task.completed)}><i/></button>
          <div className="task-main"><p>{task.text}</p><select value={task.tag||""} onChange={e=>setData(d=>({...d,tasks:d.tasks.map(t=>t.id===task.id?{...t,tag:(e.target.value||null) as Tag|null}:t)}))}><option value="">Без тега</option>{TAGS.map(t=><option key={t}>{t}</option>)}</select></div>
          <button className="quiet" onClick={()=>{const value=prompt("Изменить задачу",task.text);if(value?.trim())setData(d=>({...d,tasks:d.tasks.map(t=>t.id===task.id?{...t,text:value.trim()}:t)}))}}>Изменить</button>
          <button className="delete" onClick={()=>setData(d=>({...d,tasks:d.tasks.filter(t=>t.id!==task.id)}))}>Удалить</button>
        </article>) : <div className="empty"><span>Тихо и свободно</span><p>Добавьте одно небольшое дело — котёнок будет рядом.</p></div>}</div>
      </section>

      <section className="calendar-panel panel">
        <div className="section-head"><div><span className="eyebrow">История ритма</span><h2>{month.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</h2></div><div className="month-nav"><button aria-label="Предыдущий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>Назад</button><button aria-label="Следующий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>Вперёд</button></div></div>
        <div className="weekdays">{"Пн Вт Ср Чт Пт Сб Вс".split(" ").map(x=><span key={x}>{x}</span>)}</div>
        <div className="calendar-grid">{monthCells.map((d,i)=>d?<button key={i} className={key(d)===today?"today":""} onClick={()=>setSelectedDay(key(d))}><span>{d.getDate()}</span>{(()=>{const s=dayStats(key(d)),score=s.tasks.length+s.focus.length;return score?<i data-level={Math.min(3,score)}/>:null})()}</button>:<span key={i}/>)}</div>
        {selectedDay&&selected&&<div className="day-detail"><button className="close" onClick={()=>setSelectedDay(null)}>Закрыть</button><b>{new Date(selectedDay+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</b><p>{selected.tasks.length} дел · {selected.focus.length} сессий · {selected.focus.reduce((n,f)=>n+f.durationMinutes,0)} минут фокуса</p>{selected.tasks.length>0&&<small>{selected.tasks.slice(0,3).map(t=>t.text).join(" · ")}</small>}</div>}
      </section>
    </section>

    {!data.onboarded && <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div className="onboarding"><img src="/assets/pet/stage-1-happy.png" alt="Ваш новый котёнок"/><span className="eyebrow">Добро пожаловать в {APP_NAME}</span><h2 id="welcome-title">Как назовём котёнка?</h2><p>Он будет спокойно расти вместе с завершёнными делами и фокус‑сессиями. Никаких наказаний и чувства вины.</p><input autoFocus value={data.petName} onChange={e=>setData(d=>({...d,petName:e.target.value}))}/><button className="primary" onClick={()=>setData(d=>({...d,onboarded:true,petName:d.petName.trim()||"Облачко"}))}>Познакомиться</button></div></div>}
  </main>;
}

function LiveClock(){const [time,setTime]=useState("");useEffect(()=>{const run=()=>setTime(new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}));run();const id=setInterval(run,1000);return()=>clearInterval(id)},[]);return <span>{time}</span>}
function Stat({value,label}:{value:string|number,label:string}){return <div className="stat"><strong>{value}</strong><span>{label}</span></div>}
