export type ExamRuntimeClock = {durationSeconds:number; accumulatedSeconds:number; runningSince:number|null; paused:boolean; updatedAt:number};
// Same elapsed/presentation policy as QuizClient: timer is advisory, never submits.
export function examElapsed(clock:ExamRuntimeClock,now=Date.now()) {
 const base=Math.max(0,Math.floor(clock.accumulatedSeconds));
 return clock.paused || clock.runningSince===null ? base : Math.max(base,base+Math.floor((now-clock.runningSince)/1000));
}
export function checkpointClock(clock:ExamRuntimeClock,paused:boolean,now=Date.now()):ExamRuntimeClock {
 return {...clock,accumulatedSeconds:examElapsed(clock,now),paused,runningSince:paused?null:now,updatedAt:now};
}
export function formatExamClock(total:number) { const s=Math.max(0,Math.floor(total));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,'0')).join(':'); }
