'use client';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
export default function GuardQa() {
 const [status,setStatus]=useState('尚未測試');
 async function run() {
  setStatus('檢查登入中');
  const client=getSupabaseBrowserClient();
  const {data,error}=await client.auth.getUser();
  if(error || !data.user) { setStatus('請先使用既有帳號登入'); return; }
  const args={p_ticket:'00000000-0000-0000-0000-000000000000',p_request:'00000000-0000-0000-0000-000000000000',p_operator:data.user.id,p_evidence_sha256:'0'.repeat(64),p_worker_stopped_at:'2000-01-01T00:00:00Z'};
  const one=await client.rpc('ai_guard_reconcile',{...args,p_seq:1,p_resolution:'not_charged',p_cost:0,p_input:0,p_output:0});
  const two=await client.rpc('ai_guard_reconcile_unstarted',args);
  const denied=(e:{message?:string}|null)=>Boolean(e?.message?.includes('reconciliation unauthorized'));
  setStatus(`登入使用者：${denied(one.error)?'對帳已拒絕':'對帳未確認'}；${denied(two.error)?'未派發對帳已拒絕':'未派發對帳未確認'}`);
 }
 return <main><h1>預覽權限測試</h1><p>只測試拒絕，未呼叫模型。</p><button onClick={run}>測試現有登入權限</button><p role="status">{status}</p></main>;
}
