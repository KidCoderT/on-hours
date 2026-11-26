import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { ANSWER, COUNT_LABELS, hideBubble, placeBubble, showBubble, stretchLabels, type BubbleAnswer } from "../lib/bubble";
import { addExtra, clearExtra, endBreak, extraFor, heartbeat, lastBreak, lastClosedSession, lastSessionEnd, pauseSession, recoverOpenSession, reopenSession, sessionsBetween, STALE_MS, startBreak, startSession } from "../lib/db";
import { fixture } from "../lib/fixture";
import { fmtTime } from "../lib/format";
import type { Settings } from "../lib/settings";
import { awayAction, dayRange, holdMs, nagMs, trimmedTotal, workDayOf } from "../lib/time";

const HEARTBEAT_MS = 30_000;
/** How often a running timer (or a waiting bubble) checks whether anyone is at the PC (away.rs). */
const AWAY_POLL_MS = 2_000;
/** Idle under this after an away-pause: they're back, so ask. */
const BACK_MS = 3_000;
/** "Welcome back" and "push some more?" wait this long for an answer, then go: a No. */
const COUNT_WAIT_MS = 60_000;
/** Goal met: the confetti plays this long before the bubble asks about a stretch. */
const STRETCH_ASK_DELAY_MS = 1_200;

type AwayCheck = { idle_ms: number; locked: boolean };
const checkAway = () => invoke<AwayCheck>("away").catch(() => null);
/** The session an away-pause closed, until the person answers whether that time was work. */
type AwaySession = { id: number; start: number; end: number };
/** What the away bubble is showing. `from`: the last input before the check-in. */
type Bubble =
  | { kind: "check"; from: number }
  | { kind: "paused"; away: AwaySession }
  | { kind: "count"; away: AwaySession; shownAt: number }
  | { kind: "stretch"; shownAt: number };

/** Today's finished sessions, trimmed to the work-day. The running one is added live. */
const finishedTotal = async (from: number, to: number) =>
  trimmedTotal((await sessionsBetween(from, to)).filter((s) => !s.open), from, to);

/** The timer engine: sessions in the DB, a 1s tick for the display, a 30s heartbeat. */
export function useTimer(settings: Settings, settingsLoaded: boolean) {
  const [recovered, setRecovered] = useState(false);
  const [baseMs, setBaseMs] = useState(0); // today's finished sessions
  const [extraMs, setExtraMs] = useState(0); // today's stretch: added to the goal, just for today
  const [loadedDay, setLoadedDay] = useState<number | null>(null); // the day baseMs and extraMs are for
  const [openStart, setOpenStart] = useState<number | null>(null); // running session's start
  const [pausedSince, setPausedSince] = useState<number | null>(null); // end of the last session
  const [now, setNow] = useState(Date.now());
  const [launchedAt] = useState(Date.now);
  const [brk, setBrk] = useState<{ start: number; end: number } | null>(null); // the latest break
  const [synced, setSynced] = useState(0); // bump to re-read today's total from the DB
  const [saveFailed, setSaveFailed] = useState(false); // the last session write failed: the pill shows it
  const [away, setAway] = useState(false); // paused and nobody at the PC: locked, or idle for "Pause after"
  const [backAt, setBackAt] = useState<number | null>(null); // the last return to the PC while paused
  const awayRef = useRef(false);
  const bubbleRef = useRef<Bubble | null>(null);
  const [bubbleKind, setBubbleKind] = useState<Bubble["kind"] | null>(null); // bubbleRef's kind, to drive effects
  const busy = useRef(false); // ignore double-clicks while a DB write is in flight
  const runningRef = useRef(false);
  const lastTick = useRef(Date.now());

  // Play stays disabled until we know the real goal/day-start and whether a session is open.
  const ready = recovered && settingsLoaded;
  const workDay = workDayOf(new Date(now), settings.dayStart);
  const today = dayRange(workDay, settings.dayStart);
  // No reminders today: a rest day, or snoozed / done for today from the menus.
  const restDay = settings.restDays.includes(workDay.getDay());
  const quiet = restDay || now < settings.quietUntil;
  const running = openStart !== null;
  runningRef.current = running;
  // A session that began before today's start only counts from the day boundary.
  const runningMs = running ? Math.max(0, now - Math.max(openStart, today.from)) : 0;
  const elapsed = baseMs + runningMs;
  const done = elapsed >= settings.dailyGoalMs; // the day is kept: green, and pauses stop nagging
  // What the pill counts toward: the goal plus any stretch said yes to today. Missing it never
  // un-keeps the day: `done` stays on the plain goal.
  const target = settings.dailyGoalMs + extraMs;
  const reached = elapsed >= target;
  // Today's totals are loaded: a jump in `elapsed` from here on is real time, not the load.
  const known = ready && loadedDay === today.from;
  const pausedMs = running ? 0 : holdMs(now, pausedSince, today.from, launchedAt);
  const nag = running ? 0 : nagMs(now, pausedMs, backAt, today.from);
  const onBreak = !running && brk !== null && brk.start <= now && now < brk.end;
  // Rounded up to the second, so a 10 min break starts at 0:10:00 and ends at 0:00:01, never 0:00:00.
  const breakLeftMs = onBreak ? Math.ceil((brk.end - now) / 1000) * 1000 : 0;
  // A break that ended during this pause: the nagging counts from its end (lib/time.ts pauseLevel).
  const sinceBreakMs = !running && !onBreak && brk !== null && brk.end >= now - pausedMs ? now - brk.end : null;

  // On launch: resume a session still running from before a reload/restart,
  // otherwise remember when the last one ended so hold time survives the restart.
  useEffect(() => {
    if (!isTauri()) return; // design preview in a plain browser: static pill
    (async () => {
      const open = await recoverOpenSession();
      setOpenStart(open?.start_ms ?? null);
      if (!open) setPausedSince(await lastSessionEnd());
      const b = await lastBreak(); // a restart mid-break carries on with it
      if (b) setBrk({ start: b.start_ms, end: b.end_ms });
      setRecovered(true);
    })().catch((e) => console.error("could not load timer", e));
  }, []);

  // (Re)load today's finished total on launch and whenever the work-day changes.
  useEffect(() => {
    if (!ready) return;
    Promise.all([finishedTotal(today.from, today.to), extraFor(today.from)])
      .then(([base, extra]) => {
        setBaseMs(base);
        setExtraMs(extra);
        setLoadedDay(today.from);
      })
      .catch((e) => console.error("could not load today's total", e));
  }, [ready, today.from, today.to, synced]);

  /**
   * Keep the running session's end fresh. If the DB finds it stale (the PC slept with the timer
   * on) it closes it at the last heartbeat, and the pill shows paused from that moment.
   */
  const beat = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const fresh = await heartbeat();
      setSaveFailed(false);
      if (!fresh) {
        setOpenStart(null);
        setPausedSince(await lastSessionEnd());
        setSynced((n) => n + 1);
      }
    } catch (e) {
      console.error("heartbeat failed", e);
      setSaveFailed(true);
    } finally {
      busy.current = false;
      setNow(Date.now());
    }
  };

  // Clock tick. Runs while paused too, so the display resets at the day boundary.
  // A long gap between ticks means the PC slept: check the session before showing the slept time.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      const slept = t - lastTick.current >= STALE_MS;
      lastTick.current = t;
      if (slept && !runningRef.current) setBackAt(t); // woke from sleep while paused: back at the PC
      if (slept && runningRef.current) void beat();
      else if (!busy.current) setNow(t);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // While running, keep the session's end time fresh so a crash loses at most 30s.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [running]);

  /**
   * Write to the DB first, then update the screen, so the display never shows unsaved time.
   * Once the write succeeds the screen follows it, even if the total refresh after it fails:
   * showing "running" for a closed session would log nothing from then on.
   */
  const write = async (what: (t: number) => Promise<void>) => {
    if (busy.current || !ready) return;
    busy.current = true;
    const t = Date.now();
    try {
      await what(t);
      setSaveFailed(false);
    } catch (e) {
      console.error("could not save", e);
      setSaveFailed(true);
    } finally {
      busy.current = false;
      setNow(t);
    }
  };

  const pause = async (t: number) => {
    // The pause runs from the last session's end, read back after the write: usually t, but the
    // last heartbeat if the session went stale (slept), and the session before it if this one was
    // a misclick (under 5s) and got dropped. So tapping play and pause can't reset the nagging.
    const fresh = await pauseSession(t);
    const end = (await lastSessionEnd()) ?? t;
    setBaseMs((b) => b + Math.max(0, end - Math.max(openStart!, today.from)));
    setOpenStart(null);
    setPausedSince(end);
    // Re-read from the DB to correct any drift; the local sum above stands if this fails.
    finishedTotal(today.from, today.to)
      .then(setBaseMs)
      .catch((e) => console.error("could not refresh today's total", e));
    return fresh;
  };

  const stopBreak = async (t: number) => {
    await endBreak(t);
    setBrk((b) => b && { ...b, end: t });
  };

  /** Play / pause. Starting work ends a running break. */
  const toggle = () =>
    write(async (t) => {
      say(null); // pressing play or pause answers the bubble: a pending "count it?" is a No
      if (running) {
        await pause(t);
        return;
      }
      if (onBreak) await stopBreak(t);
      await startSession(t);
      setOpenStart(t);
    });

  /** A planned break of `ms`. Pauses first if running; the break starts only once that is saved. */
  const takeBreak = (ms: number) =>
    write(async (t) => {
      say(null);
      if (running) await pause(t);
      await startBreak(t, ms);
      setBrk({ start: t, end: t + ms });
    });

  /** Push today's target by "Stretch by": the bubble's "+30 min", or the right-click menu. Today only. */
  const stretch = () =>
    write(async () => {
      if (bubbleRef.current?.kind === "stretch") say(null);
      await addExtra(today.from, settings.stretchMs);
      setExtraMs((x) => x + settings.stretchMs);
    });

  /** Back from a break early without starting work: the nagging picks up at nudge. */
  const endBreakNow = () => write(async (t) => (onBreak ? stopBreak(t) : undefined));

  /**
   * Away from the PC while running, in two stages (lib/time.ts awayAction):
   * - "Check in after" with no input: the bubble asks "still there?" and the timer keeps running.
   *   Yes: carry on (the click is input, so the idle count starts over). No: pause at the last input.
   *   Input comes back without an answer: the bubble fades away and the time counts.
   * - "Pause after": pause at the last input, so the idle time isn't counted. Back at the PC, the
   *   bubble says "Welcome back": Count it reopens the session (the away time was work), Start now
   *   starts a new one (it wasn't). A click elsewhere, typing, or a minute's wait dismisses it: the
   *   timer stays paused and the away time stays out.
   * Locking pauses at the last input and asks nothing. A sleep is the heartbeat's job, nothing asked.
   */
  const closeAt = async (end: number): Promise<AwaySession | null> => {
    if (!(await heartbeat())) {
      // Slept: the stale session was just closed at its last heartbeat.
      setOpenStart(null);
      setPausedSince(await lastSessionEnd());
      setSynced((n) => n + 1);
      return null;
    }
    if (!(await pause(end))) return null;
    const s = await lastClosedSession();
    return s && s.end_ms === end ? { id: s.id, start: s.start_ms, end } : null; // otherwise dropped as a misclick
  };

  const say = (b: Bubble | null, how: "drop" | "quiet" = "drop") => {
    const was = bubbleRef.current;
    bubbleRef.current = b;
    setBubbleKind(b?.kind ?? null);
    const fail = (e: unknown) => console.error("could not update the away bubble", e);
    if (!b) {
      if (was) hideBubble(how).catch(fail);
      return;
    }
    const theme = settings.pillTheme;
    if (b.kind === "check") showBubble({ kind: "check", title: "Hey, you still there?", sub: `No keyboard or mouse since ${fmtTime(b.from)}.`, theme }).catch(fail);
    if (b.kind === "paused") showBubble({ kind: "paused", title: "Paused.", sub: `Away since ${fmtTime(b.away.end)}.`, theme }).catch(fail);
    if (b.kind === "count") {
      const mins = Math.max(1, Math.round((Date.now() - b.away.end) / 60_000));
      showBubble({ kind: "count", title: "Welcome back.", sub: `Away ${mins} min, since ${fmtTime(b.away.end)}.`, primary: "no", labels: COUNT_LABELS, theme }).catch(fail);
    }
    if (b.kind === "stretch") {
      const mins = Math.round(settings.stretchMs / 60_000);
      const title = extraMs ? "Stretch done." : "Goal met.";
      showBubble({ kind: "stretch", title, sub: `Push another ${mins} min today?`, labels: stretchLabels(settings.stretchMs), theme }).catch(fail);
    }
  };

  /** One look at the PC, every 2s. */
  const look = async (c: AwayCheck) => {
    const b = bubbleRef.current;
    // Paused: is anyone here? Away means locked or idle as long as an auto-pause takes. A short idle
    // isn't away: reading or watching a video while paused is exactly what the nagging is for.
    const gone = !runningRef.current && (c.locked || (settings.pauseAfterMs > 0 && c.idle_ms >= settings.pauseAfterMs));
    if (awayRef.current && !gone && !runningRef.current) setBackAt(Date.now());
    awayRef.current = gone;
    setAway(gone);
    if (b?.kind === "stretch" && Date.now() - b.shownAt > COUNT_WAIT_MS) say(null, "quiet"); // no answer: not today
    if (runningRef.current) {
      const action = awayAction({ idleMs: c.idle_ms, locked: c.locked }, settings);
      const end = Date.now() - c.idle_ms;
      if (action === "lock" || action === "pause") {
        await write(async () => {
          if (!runningRef.current) return;
          const away = await closeAt(end);
          say(away && action === "pause" ? { kind: "paused", away } : null);
        });
      } else if (action === "check" && !b) say({ kind: "check", from: end });
      else if (!action && b?.kind === "check") say(null, "quiet"); // back without answering: it counts
      return;
    }
    if (b?.kind === "paused" && !c.locked && c.idle_ms < BACK_MS) say({ kind: "count", away: b.away, shownAt: Date.now() });
    if (b?.kind === "count" && Date.now() - b.shownAt > COUNT_WAIT_MS) say(null); // no answer: No
  };

  const onAnswer = (a: BubbleAnswer) => {
    const b = bubbleRef.current;
    if (!b || b.kind !== a.kind) return;
    bubbleRef.current = null; // the bubble drops itself
    if (b.kind === "check" && !a.yes) {
      void write(async () => {
        if (runningRef.current) await closeAt(b.from); // "No": it wasn't work since the last input
      });
    }
    if (b.kind === "stretch" && a.yes) void stretch();
    if (b.kind === "count") {
      void write(async (t) => {
        if (runningRef.current) return; // they already pressed play
        if (a.yes) {
          // "Count it": the session carries on as if never paused.
          if (!(await reopenSession(b.away.id, b.away.end, t))) return;
          setOpenStart(b.away.start);
          setSynced((n) => n + 1); // the reopened session leaves today's finished total
        } else {
          // "Start now": the away time stays out, and work starts from here.
          await startSession(t);
          setOpenStart(t);
        }
      });
    }
    setBubbleKind(null);
  };

  // "Welcome back" is up: a click anywhere but the bubble, or typing, means they've moved on. It
  // fades after a beat, the timer stays paused and the away time stays out. The bubble can't take
  // focus, so the clicks and keys are read from Windows (away.rs input_now).
  useEffect(() => {
    if (bubbleKind !== "count" || !isTauri()) return;
    let stop = false;
    (async () => {
      const win = await Window.getByLabel("bubble");
      if (!win) return;
      const [pos, size] = await Promise.all([win.outerPosition(), win.outerSize()]);
      const inside = (x: number, y: number) => x >= pos.x && x < pos.x + size.width && y >= pos.y && y < pos.y + size.height;
      await invoke("input_now"); // clear "pressed since the last call": the key that brought them back doesn't count
      while (!stop) {
        await new Promise((r) => setTimeout(r, 60));
        const i = await invoke<{ x: number; y: number; mouse: boolean; key: boolean }>("input_now").catch(() => null);
        if (stop || bubbleRef.current?.kind !== "count") return;
        if (i && (i.key || (i.mouse && !inside(i.x, i.y)))) return say(null, "quiet");
      }
    })().catch((e) => console.error("could not watch for a dismiss", e));
    return () => {
      stop = true;
    };
  }, [bubbleKind]);

  const latest = useRef({ look, onAnswer, say });
  latest.current = { look, onAnswer, say };

  // Today's target met while working (the confetti moment, pill/useCelebrate.ts): once the confetti
  // has played, offer a stretch. Never when the app opens on a day already met. Saying yes moves the
  // target, so meeting that asks again: each extra is its own choice.
  // Only time crossing the same target counts: a target moved by settings or a stretch isn't a moment.
  const wasReached = useRef<{ reached: boolean; target: number } | null>(null);
  useEffect(() => {
    if (!known) return;
    const before = wasReached.current;
    wasReached.current = { reached, target };
    if (before?.reached !== false || before.target !== target || !reached || !running || !settings.stretchMs || !isTauri()) return;
    const id = setTimeout(() => {
      if (runningRef.current && !bubbleRef.current) latest.current.say({ kind: "stretch", shownAt: Date.now() });
    }, STRETCH_ASK_DELAY_MS);
    return () => clearTimeout(id);
  }, [known, reached, target, running, settings.stretchMs]);

  // The goal changed in settings: today starts over against the new goal. Today's stretch is
  // dropped, and meeting the new goal while working celebrates and asks again.
  const goalSeen = useRef<number | null>(null);
  useEffect(() => {
    if (!known) return;
    const before = goalSeen.current;
    goalSeen.current = settings.dailyGoalMs;
    if (before === null || before === settings.dailyGoalMs) return;
    if (bubbleRef.current?.kind === "stretch") say(null, "quiet");
    setExtraMs(0);
    clearExtra(today.from).catch((e) => console.error("could not drop today's stretch", e));
  }, [known, settings.dailyGoalMs]);

  // Look all the time: while running for the away bubbles, while paused for whether anyone's here.
  // ponytail: a restart while the bubble is up drops it and paused time stays out; persist it if that bites.
  useEffect(() => {
    if (!ready || !isTauri()) return;
    const id = setInterval(() => void checkAway().then((c) => c && latest.current.look(c)), AWAY_POLL_MS);
    return () => clearInterval(id);
  }, [ready]);

  // The bubble's answers, and keeping it by the pill when the pill moves or grows.
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const follow = () => bubbleRef.current && void placeBubble().catch(() => { });
    const offs = [win.listen<BubbleAnswer>(ANSWER, (e) => latest.current.onAnswer(e.payload)), win.onMoved(follow), win.onResized(follow)];
    return () => offs.forEach((off) => off.then((f) => f()));
  }, []);

  // Screenshot harness (scripts/shots): fixed state, nothing to toggle.
  if (fixture) {
    const left = "breakLeftMs" in fixture ? fixture.breakLeftMs : 0;
    const idle = async () => { };
    return {
      elapsed: fixture.elapsedMs, running: fixture.running, done: fixture.elapsedMs >= settings.dailyGoalMs, pausedMs: fixture.pausedMs,
      target: settings.dailyGoalMs + ("extraMs" in fixture ? fixture.extraMs : 0), known: true, nag: fixture.pausedMs, away: false, quiet: false, restDay: false, dayEnd: 0,
      onBreak: left > 0, breakLeftMs: left, sinceBreakMs: null, ready: true, saveFailed: false, toggle: idle, takeBreak: idle, endBreakNow: idle, stretch: idle,
    };
  }

  return { elapsed, running, done, target, known, pausedMs, nag, away, quiet, restDay, dayEnd: today.to, onBreak, breakLeftMs, sinceBreakMs, ready, saveFailed, toggle, takeBreak, endBreakNow, stretch };
}
