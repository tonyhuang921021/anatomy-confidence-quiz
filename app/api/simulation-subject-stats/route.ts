import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getComparisonPaper } from "@/lib/simulationComparisonCatalog";
import { loadSimulationSubjectCohort } from "@/lib/simulationSubjectCohort";
import { unavailableSubjectStats, type PaperSubjectStats } from "@/lib/simulationSubjectComparison";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

export const maxDuration=15;
const cache=new Map<string,{expires:number;value:PaperSubjectStats}>();
const pending=new Map<string,Promise<PaperSubjectStats>>();

export async function GET(request: NextRequest) {
  const key=request.nextUrl.searchParams.get("paperKey") ?? "";
  if (!/^[A-Z0-9-]{3,80}$/i.test(key) || [...request.nextUrl.searchParams.keys()].some(k=>k!=="paperKey")) return NextResponse.json({error:"invalid paper"},{status:400});
  const paper=getComparisonPaper(key);
  if (!paper) return NextResponse.json({error:"unsupported paper"},{status:404});
  const repairEnabled=process.env.QUIZ_STATS_REPAIR_ENABLED === "true";
  const cacheKey=`${repairEnabled?"repair-v1":"legacy"}:${key}`;
  const old=cache.get(cacheKey);
  let value=old && old.expires>Date.now() ? old.value : undefined;
  if (!value) {
    if (!pending.has(cacheKey)) pending.set(cacheKey,(async()=>{
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL, secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !secret || isSupabaseRecoveryMode()) return unavailableSubjectStats(paper);
      const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
      const started=Date.now();let stage="scores";
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try {
        return await loadSimulationSubjectCohort(paper,{
          readScores:async(paperKey,limit)=>{
            stage="scores";
            const {data,error}=await db.from("simulation_paper_scores").select("session_id,completed_at").eq("paper_key",paperKey).gt("score",3).order("completed_at",{ascending:false}).order("session_id",{ascending:false}).limit(limit).abortSignal(controller.signal);
            if(error)throw error; return data ?? [];
          },
          readSessions:async(ids)=>{
            stage="sessions";
            const {data,error}=await db.from("quiz_sessions").select("id,user_id,mode,completed_at,updated_at").in("id",ids).limit(101).abortSignal(controller.signal);
            if(error)throw error; return data ?? [];
          },
          readAnswers:async(ids,limit)=>{
            stage="answers";
            const {data,error}=await db.from("quiz_session_attempts").select("session_id,question_id,selected_answer").in("session_id",ids).limit(limit).abortSignal(controller.signal);
            if(error)throw error; return data ?? [];
          }
        });
      } catch {
        // Deliberately exclude raw database errors, IDs, answers and auth data.
        console.warn("simulation-subject-stats unavailable",{paperKey:key,stage,elapsedMs:Date.now()-started,reason:controller.signal.aborted?"timeout":"read_failed"});
        return unavailableSubjectStats(paper);
      }
      finally { clearTimeout(timer); }
    })().then(result=>{
      if(cache.size>=128)cache.delete(cache.keys().next().value!);
      cache.set(cacheKey,{expires:Date.now()+(result.reason==="unavailable"?30000:repairEnabled?60000:900000),value:result});
      return result;
    }).finally(()=>pending.delete(cacheKey)));
    value=await pending.get(cacheKey)!;
  }
  // Only aggregate counts/means. Never return session IDs, account IDs, answers,
  // completion times of people, or exact counts for groups smaller than five.
  return NextResponse.json(value,{headers:{"Cache-Control":repairEnabled||value.reason==="unavailable"?"no-store":"public, s-maxage=900, stale-while-revalidate=900"}});
}
