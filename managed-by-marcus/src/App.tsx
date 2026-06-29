import { useEffect, useMemo, useState } from 'react';

type MeetingChoice = {
  id: string;
  text: string;
  isMeeting: boolean;
};

type Problem = {
  id: string;
  prompt: string;
  choices: MeetingChoice[];
};

type GameStatus = 'playing' | 'won' | 'lost';

const problems: Problem[] = [
  {
    id: 'schedule',
    prompt: 'The schedule is slipping. What should we do?',
    choices: [
      { id: 'meeting', text: 'Let’s table that for a meeting later.', isMeeting: true },
      { id: 'plan', text: 'Move task owners and update the timeline.', isMeeting: false },
      { id: 'outreach', text: 'Call the subcontractor and escalate the date.', isMeeting: false },
      { id: 'reassign', text: 'Shift resources to catch the delay.', isMeeting: false },
    ],
  },
  {
    id: 'vendor',
    prompt: 'The vendor is late. How should we handle it?',
    choices: [
      { id: 'meeting', text: 'Let’s circle back after alignment.', isMeeting: true },
      { id: 'engage', text: 'Talk to the vendor and confirm delivery.', isMeeting: false },
      { id: 'buffer', text: 'Raise a contingency plan and reorder.', isMeeting: false },
      { id: 'notify', text: 'Tell the team to prepare alternate sourcing.', isMeeting: false },
    ],
  },
  {
    id: 'budget',
    prompt: 'The budget is over forecast. What is the next step?',
    choices: [
      { id: 'meeting', text: 'Let’s schedule a follow-up to discuss ownership.', isMeeting: true },
      { id: 'audit', text: 'Review the line items and cut extras.', isMeeting: false },
      { id: 'forecast', text: 'Update the forecast and rebaseline spend.', isMeeting: false },
      { id: 'approve', text: 'Push for a revised approval from finance.', isMeeting: false },
    ],
  },
  {
    id: 'rfi',
    prompt: 'The RFI is still unanswered. Who owns this?',
    choices: [
      { id: 'meeting', text: 'Let’s take this offline and regroup.', isMeeting: true },
      { id: 'assign', text: 'Assign a responder and set a deadline.', isMeeting: false },
      { id: 'prioritize', text: 'Escalate to the design lead immediately.', isMeeting: false },
      { id: 'clarify', text: 'Clarify the missing detail and follow up.', isMeeting: false },
    ],
  },
  {
    id: 'drawings',
    prompt: 'The crew has no updated drawings. What should happen?',
    choices: [
      { id: 'meeting', text: 'Let’s table that for a meeting later.', isMeeting: true },
      { id: 'print', text: 'Distribute the latest drawings now.', isMeeting: false },
      { id: 'upload', text: 'Send the team an updated file package.', isMeeting: false },
      { id: 'confirm', text: 'Verify the right revision before work.', isMeeting: false },
    ],
  },
  {
    id: 'owner',
    prompt: 'The owner wants a status update. What do we tell them?',
    choices: [
      { id: 'meeting', text: 'Let’s circle back after alignment.', isMeeting: true },
      { id: 'status', text: 'Share a concise progress summary.', isMeeting: false },
      { id: 'confidence', text: 'Present the latest risk and schedule.', isMeeting: false },
      { id: 'review', text: 'Review deliverables and commit to next steps.', isMeeting: false },
    ],
  },
  {
    id: 'material',
    prompt: 'Material is missing on site. How do we recover?',
    choices: [
      { id: 'meeting', text: 'Let’s schedule a follow-up to discuss ownership.', isMeeting: true },
      { id: 'order', text: 'Trace the missing shipment and reorder fast.', isMeeting: false },
      { id: 'shift', text: 'Shift tasks while we wait on material.', isMeeting: false },
      { id: 'notify', text: 'Notify procurement and confirm delivery.', isMeeting: false },
    ],
  },
  {
    id: 'inspection',
    prompt: 'The inspection failed. What is the plan?',
    choices: [
      { id: 'meeting', text: 'Let’s take this offline and regroup.', isMeeting: true },
      { id: 'fix', text: 'Fix the issue and request a reinspection.', isMeeting: false },
      { id: 'document', text: 'Document the defects and assign repairs.', isMeeting: false },
      { id: 'coach', text: 'Coach the crew on compliance immediately.', isMeeting: false },
    ],
  },
];

const milestoneTitles = new Map([
  [5, 'Weekly Alignment'],
  [10, 'Pre-Meeting'],
  [15, 'Meeting About Previous Meetings'],
  [20, 'Executive Alignment'],
  [25, 'Strategic Leadership Summit'],
]);

const initialState = {
  meetings: 0,
  credibility: 100,
  completion: 100,
  chaos: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function App() {
  const [meetings, setMeetings] = useState(initialState.meetings);
  const [credibility, setCredibility] = useState(initialState.credibility);
  const [completion, setCompletion] = useState(initialState.completion);
  const [chaos, setChaos] = useState(initialState.chaos);
  const [problemIndex, setProblemIndex] = useState(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [milestone, setMilestone] = useState('Director of Momentum');
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [npcMood, setNpcMood] = useState(0);
  const [marcusConfidence, setMarcusConfidence] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [realSolutions, setRealSolutions] = useState(0);
  const [position, setPosition] = useState({ x: 42, y: 38 });
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');

  useEffect(() => {
    if (meetings >= 25) {
      setStatus('won');
    }
  }, [meetings]);

  useEffect(() => {
    if (realSolutions >= 3) {
      setStatus('lost');
    }
  }, [realSolutions]);

  useEffect(() => {
    if (credibility <= 0) {
      setStatus('lost');
    }
  }, [credibility]);

  useEffect(() => {
    const newTitle = milestoneTitles.get(meetings) ?? 'Director of Momentum';
    setMilestone(newTitle);
    if (milestoneTitles.has(meetings)) {
      setMilestoneToast(`Milestone reached: ${newTitle}`);
      window.setTimeout(() => setMilestoneToast(null), 2000);
    }
  }, [meetings]);

  useEffect(() => {
    setNpcMood(clamp(meetings * 4 - credibility * 0.3, 0, 100));
    setMarcusConfidence(clamp(meetings * 3.2 - chaos * 1.5, 0, 100));
  }, [meetings, credibility, chaos]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (status !== 'playing') return;

      const step = 6;
      const bounds = { minX: 0, maxX: 84, minY: 0, maxY: 72 };
      let nextX = position.x;
      let nextY = position.y;

      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        nextY = Math.max(bounds.minY, position.y - step);
        setDirection('up');
      }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        nextY = Math.min(bounds.maxY, position.y + step);
        setDirection('down');
      }
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        nextX = Math.max(bounds.minX, position.x - step);
        setDirection('left');
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        nextX = Math.min(bounds.maxX, position.x + step);
        setDirection('right');
      }

      if (nextX !== position.x || nextY !== position.y) {
        setPosition({ x: nextX, y: nextY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position, status]);

  const calendarFull = useMemo(() => clamp((meetings / 25) * 100, 0, 100), [meetings]);

  const currentProblem = problems[problemIndex % problems.length];

  const progress = useMemo(() => ({
    meetings,
    calendarFull,
    credibility,
    completion,
    chaos,
  }), [meetings, calendarFull, credibility, completion, chaos]);

  const updateFromMeeting = () => {
    setMeetings((value) => Math.min(value + 1, 25));
    setChaos((value) => clamp(value + 6, 0, 100));
    setCompletion((value) => clamp(value - 5, 0, 100));
    setCredibility((value) => clamp(value - 2, 0, 100));
  };

  const updateFromRealSolution = () => {
    setCredibility((value) => clamp(value - 35, 0, 100));
    setChaos((value) => clamp(value - 7, 0, 100));
    setCompletion((value) => clamp(value + 4, 0, 100));
  };

  const handleChoice = (choice: MeetingChoice) => {
    if (status !== 'playing') return;
    if (choice.isMeeting) {
      updateFromMeeting();
    } else {
      updateFromRealSolution();
      setRealSolutions((value) => value + 1);
    }
    setProblemIndex((index) => index + 1);
    setShowHint(true);
    window.setTimeout(() => setShowHint(false), 1000);
  };

  const restartGame = () => {
    setMeetings(initialState.meetings);
    setCredibility(initialState.credibility);
    setCompletion(initialState.completion);
    setChaos(initialState.chaos);
    setProblemIndex(0);
    setRealSolutions(0);
    setPosition({ x: 42, y: 38 });
    setDirection('down');
    setStatus('playing');
    setShowHint(false);
    setMilestoneToast(null);
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-marcus backdrop-blur-xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Managed by Marcus</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Corporate Strategy Simulator</h1>
            <p className="mt-2 max-w-2xl text-slate-400">Help Marcus fill his calendar with meetings and keep the illusion of leadership alive.</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 px-5 py-4 text-right shadow-inner shadow-slate-950/20 sm:px-6">
            <div className="text-sm text-slate-500">Milestone Title</div>
            <div className="mt-2 text-xl font-semibold text-white">{milestone}</div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800 p-6 shadow-lg shadow-slate-950/30">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-amber-400 opacity-90" />
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/20">
                      📅
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Marcus’s Calendar</p>
                      <p className="text-3xl font-semibold text-white">{meetings.toString().padStart(2, '0')} / 25</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 rounded-3xl bg-slate-950/80 p-4 ring-1 ring-white/5">
                      <div className="flex items-center justify-between text-sm text-slate-400">Calendar Full</div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-3 rounded-full bg-cyan-400 transition-all duration-300" style={{ width: `${calendarFull}%` }} />
                      </div>
                      <div className="text-sm text-slate-300">{Math.round(calendarFull)}%</div>
                    </div>
                    <div className="space-y-2 rounded-3xl bg-slate-950/80 p-4 ring-1 ring-white/5">
                      <div className="flex items-center justify-between text-sm text-slate-400">Project Completion</div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-3 rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${completion}%` }} />
                      </div>
                      <div className="text-sm text-slate-300">{completion}%</div>
                    </div>
                    <div className="space-y-2 rounded-3xl bg-slate-950/80 p-4 ring-1 ring-white/5">
                      <div className="flex items-center justify-between text-sm text-slate-400">Management Credibility</div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-3 rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${credibility}%` }} />
                      </div>
                      <div className="text-sm text-slate-300">{credibility}%</div>
                    </div>
                    <div className="space-y-2 rounded-3xl bg-slate-950/80 p-4 ring-1 ring-white/5">
                      <div className="flex items-center justify-between text-sm text-slate-400">Office Chaos</div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-3 rounded-full bg-rose-400 transition-all duration-300" style={{ width: `${chaos}%` }} />
                      </div>
                      <div className="text-sm text-slate-300">{chaos}%</div>
                    </div>
                  </div>
                </div>
                <div className="relative w-full max-w-sm rounded-3xl bg-slate-950/90 p-6 text-center ring-1 ring-white/5 shadow-xl shadow-slate-950/40">
                  <div className="absolute right-0 top-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Confidence +{Math.round(marcusConfidence)}</div>
                  <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-3xl bg-slate-900">
                    <div className="space-y-2 text-left">
                      <div className="rounded-full bg-[#8f4f56] p-4 text-4xl">👨‍💼</div>
                      <div className="text-sm text-slate-400">Marcus</div>
                    </div>
                  </div>
                  <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Office mood</div>
                  <p className="mt-3 text-lg font-semibold text-white">{npcMood > 60 ? 'Stressed' : npcMood > 30 ? 'Uneasy' : 'Mildly Patient'}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">As the calendar fills, the crew looks more frazzled and Marcus looks more sure of himself.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-lg shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Meeting Status</p>
                    <h2 className="text-2xl font-semibold text-white">Office Walkthrough</h2>
                  </div>
                  <div className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">{meetings === 25 ? 'Meeting Master' : 'Meeting Mode'}</div>
                </div>
                <p className="text-slate-400">Use WASD or arrow keys to move Marcus around the site, then choose the right answer to keep the illusion alive.</p>
                <div className="mt-6 grid gap-3 rounded-3xl bg-slate-900/80 p-5 ring-1 ring-white/5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-slate-950/70 p-4 text-slate-300">Location: Construction office hub</div>
                    <div className="rounded-3xl bg-slate-950/70 p-4 text-slate-300">NPC Mood: {npcMood}% stressed</div>
                  </div>
                  <div className="rounded-3xl bg-slate-950/70 p-4 text-slate-300">Marcus Confidence: {Math.round(marcusConfidence)}%</div>
                  <div className="rounded-3xl bg-slate-950/70 p-4 text-slate-300">Active real solutions: {realSolutions} / 3</div>
                  <div className="rounded-3xl bg-slate-950/70 p-4 text-slate-300">Project Status: {completion > 60 ? 'Mostly on track' : completion > 30 ? 'Under pressure' : 'In crisis'}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-lg shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Office Activity</p>
                    <h2 className="text-2xl font-semibold text-white">NPC Interaction</h2>
                  </div>
                  <div className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">Problems encountered: {problemIndex}</div>
                </div>
                <div className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-white/5">
                  <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Problem prompt</div>
                  <p className="mt-4 text-xl font-semibold text-white">{currentProblem.prompt}</p>
                  <div className="mt-6 grid gap-3">
                    {currentProblem.choices.map((choice) => (
                      <button
                        key={choice.id}
                        className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-4 text-left text-slate-100 transition hover:border-cyan-500 hover:bg-slate-900"
                        onClick={() => handleChoice(choice)}
                      >
                        <span className="block text-sm text-slate-400">{choice.isMeeting ? 'Meeting option' : 'Actual fix'}</span>
                        <span className="mt-2 block text-base font-medium">{choice.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Simulated Site</p>
                  <h2 className="text-2xl font-semibold text-white">Marcus on the job</h2>
                </div>
                <div className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">WASD / Arrows</div>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800 p-5">
                <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_45%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
                  <div className="absolute left-6 top-6 h-16 w-16 rounded-3xl bg-slate-800/90 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" />
                  <div className="absolute right-10 top-20 h-14 w-20 rounded-3xl bg-slate-800/90 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" />
                  <div className="absolute left-10 bottom-20 h-12 w-28 rounded-3xl bg-slate-800/90 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" />
                  <div className="absolute right-8 bottom-10 h-20 w-20 rounded-3xl bg-slate-800/80 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[260px] w-[340px] overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/80 shadow-[0_0_0_1px_rgba(148,163,184,0.06)]">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_1px,transparent_1px,transparent_24px)]" />
                    <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2 text-sm text-slate-300">
                      <div className="rounded-2xl bg-slate-900/85 px-3 py-2">Office site</div>
                      <div className="rounded-2xl bg-slate-900/85 px-3 py-2">Project zone</div>
                    </div>
                    <div
                      className="absolute flex h-14 w-14 items-center justify-center rounded-full border border-slate-500 bg-cyan-500/20 text-3xl shadow-lg shadow-cyan-500/10"
                      style={{ top: `${position.y}%`, left: `${position.x}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <span className="text-[1.2rem]">🗂</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950 via-transparent" />
                  </div>
                </div>
                <div className="absolute right-5 top-6 inline-flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-300 ring-1 ring-white/10">
                  <span>Use WASD / Arrows</span>
                </div>
                <div className="absolute left-5 top-6 inline-flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-300 ring-1 ring-white/10">
                  <span>Heading {direction}</span>
                </div>
                <div className="absolute left-5 bottom-6 grid gap-3 text-sm text-slate-300">
                  <div className="rounded-3xl bg-slate-950/80 px-3 py-2">NPC: {currentProblem.prompt.slice(0, 44)}…</div>
                  <div className="rounded-3xl bg-slate-950/80 px-3 py-2">Problem count: {problemIndex}</div>
                </div>
                <div className="absolute right-5 bottom-6 grid gap-2 text-right text-sm text-slate-300">
                  <div className="rounded-3xl bg-slate-950/80 px-3 py-2">Stress level: {npcMood}%</div>
                  <div className="rounded-3xl bg-slate-950/80 px-3 py-2">Office tension: {chaos}%</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-lg shadow-slate-950/30">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Progress meter</p>
              <div className="mt-5 grid gap-4">
                <div className="rounded-3xl bg-slate-900/80 p-4 text-slate-300 ring-1 ring-white/5">
                  <div className="flex items-center justify-between text-sm text-slate-400">Meeting Calendar</div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-3 rounded-full bg-cyan-400" style={{ width: `${calendarFull}%` }} />
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-900/80 p-4 text-slate-300 ring-1 ring-white/5">
                  <div className="flex items-center justify-between text-sm text-slate-400">Real problem count</div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-3 rounded-full bg-rose-400" style={{ width: `${100 - credibility}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 text-center shadow-lg shadow-slate-950/30">
              <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Need a reset?</div>
              <button onClick={restartGame} className="mt-4 inline-flex items-center justify-center rounded-3xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
                Restart Game
              </button>
            </div>
          </aside>
        </section>

        {status !== 'playing' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-md">
            <div className="max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-900/95 p-10 text-center shadow-2xl shadow-slate-950/50">
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-950 text-4xl">
                {status === 'won' ? '🏆' : '🔥'}
              </div>
              <h2 className="text-4xl font-semibold text-white">{status === 'won' ? 'Corporate Success!' : 'Effective Leader Syndrome'}</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                {status === 'won'
                  ? 'You solved absolutely nothing, but everyone has a meeting.'
                  : 'You accidentally became an effective leader.'}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button onClick={restartGame} className="rounded-3xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                  Play Again
                </button>
                <button onClick={restartGame} className="rounded-3xl border border-slate-700 bg-slate-950 px-6 py-3 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-white">
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        )}

        {showHint && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-cyan-500/20 bg-slate-950/95 px-5 py-4 text-center text-sm text-cyan-100 shadow-2xl shadow-slate-950/40">
            <span>Meeting selected. The calendar loves you.</span>
          </div>
        )}

        {milestoneToast && (
          <div className="pointer-events-none fixed top-6 left-1/2 z-40 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-center text-sm text-amber-100 shadow-2xl shadow-amber-500/20 backdrop-blur-sm">
            <span>{milestoneToast}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
