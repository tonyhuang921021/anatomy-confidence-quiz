"use client";
import {useAuth} from './AuthProvider';
import {resolveExamCandidateName,type ExamIdentityUser} from '@/lib/examCandidateIdentity';
export function ExamCandidateIdentity({previewUser}:{previewUser?:ExamIdentityUser}) {
 const auth=useAuth();
 // Preview fixture is only used when no AuthProvider exists. Signed-out users never inherit it.
 return <span data-testid="exam-candidate-name">{resolveExamCandidateName(auth?auth.user:previewUser,auth?.loading??false)}</span>;
}
