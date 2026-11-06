export function initializeGameRuntime(options?: {env?:Record<string,string|undefined>;clientFactory?:Function;schedule?:Function}): Promise<unknown>;
export function withGameRuntime(request:Request,handler:(request:Request)=>Response|Promise<Response>):Promise<Response>;
