export function buildNeeds(text:string,hints:unknown):any;
export function approveConcepts(needs:any,choices:any):any;
export function runOne(args:any):Promise<any>;
export function createStore(db:any,options?:any):any;
export const CATALOG:Record<string,{query:string;revision:string}>;
export const IMAGE_PROMPT:string;

export function approveKnownConcepts(needs:any,question:any):any;
export function processSavedImages(args:any):Promise<any>;

export function buildNeedsWithFallback(text:string,hints:unknown,question:any):any;

export function imageWindowOpen(env:Record<string,string|undefined>,now?:number):boolean;

export function boundedImageTarget(env:Record<string,string|undefined>,questionId?:string):{questionId:string;textHash:string}|null;

export function boundedImageTargets(env:Record<string,string|undefined>):Array<{questionId:string;textHash:string}>;
