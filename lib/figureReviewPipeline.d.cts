export function afterCommitted(args: {outcome: unknown; questionId: string; db: any}): Promise<{status:string;count:number}>;
