export function handleExplanation(request: unknown, deps: Record<string, (...args: any[]) => any>): Promise<{status:number;code:string;value?:any;recoverable?:boolean}>;
export function formatAcceptedAnswer(question: unknown): string;
