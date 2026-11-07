// UI-only website identity. Never accepts the decorative exam-login input or an email.
export type ExamIdentityUser={id?:unknown;user_metadata?:{display_name?:unknown}}|null|undefined;
export function resolveExamCandidateName(user:ExamIdentityUser,loading=false):string {
 if(loading)return '讀取網站 ID…';
 const raw=user?.user_metadata?.display_name;
 if(typeof raw==='string'){
  const name=raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
  if(name&&!name.includes('@'))return Array.from(name).slice(0,24).join('');
 }
 const id=user?.id;
 if(typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id))return `使用者 ${id.slice(0,8)}`;
 return '訪客考生';
}
