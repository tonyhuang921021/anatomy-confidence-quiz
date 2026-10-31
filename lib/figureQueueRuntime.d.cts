export function captureEnabled(env: Record<string,string|undefined>,url: string): boolean;
export function scheduleFigureWorker(args: {env: Record<string,string|undefined>,db: any,waitUntil: (p: Promise<unknown>)=>void,report?: (message:string)=>void}): boolean;
