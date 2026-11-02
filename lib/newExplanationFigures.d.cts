export function buildNeeds(text:string,hints:unknown):any;
export function approveConcepts(needs:any,choices:any):any;
export function runOne(args:any):Promise<any>;
export function createStore(db:any):any;
export const CATALOG:Record<string,{query:string;revision:string}>;
export const IMAGE_PROMPT:string;

export function approveKnownConcepts(needs:any,question:any):any;
export function processSavedImages(args:any):Promise<any>;
