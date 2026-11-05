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
  const old=cache.get(key);
  let value=old && old.expires>Date.now() ? old.value : undefined;
  if (!value) {
    if (!pending.has(key)) pending.set(key,(async()=>{
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL, secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !secret || isSupabaseRecoveryMode()) return unavailableSubjectStats(paper);
      const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try {
        return await loadSimulationSubjectCohort(paper,{
          readScores:async(paperKey,limit)=>{
            const {data,error}=await db.from("simulation_paper_scores").select("session_id,completed_at").eq("paper_key",paperKey).order("completed_at",{ascending:false}).order("session_id",{ascending:false}).limit(limit).abortSignal(controller.signal);
            if(error)throw error; return data ?? [];
          },
          readSessions:async(ids)=>{
            const {data,error}=await db.from("quiz_sessions").select("id,user_id,mode,completed_at,updated_at").in("id",ids).limit(101).abortSignal(controller.signal);
            if(error)throw error; return data ?? [];
          },
          readAnswers:async(ids,limit)=>{
            const {data,error}=await db.from("quiz_session_attempts").select("session_id,question_id,selected_answer").in("session_id",ids).limit(limit).abortSignal(controller.signal);
            if(error)throw error; return data ?? [];
          }
        });
      } catch { return unavailableSubjectStats(paper); }
      finally { clearTimeout(timer); }
    })().then(result=>{
      if(cache.size>=128)cache.delete(cache.keys().next().value!);
      cache.set(key,{expires:Date.now()+(result.reason==="unavailable"?30000:900000),value:result});
      return result;
    }).finally(()=>pending.delete(key)));
    value=await pending.get(key)!;
  }
  // Only aggregate counts/means. Never return session IDs, account IDs, answers,
  // completion times of people, or exact counts for groups smaller than five.
  return NextResponse.json(value,{headers:{"Cache-Control":value.reason==="unavailable"?"no-store":"public, s-maxage=900, stale-while-revalidate=900"}});
}
