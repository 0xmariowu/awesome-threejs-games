export class InkWipe {
  constructor(host: HTMLElement, opts?: { isFrozen?: () => boolean })
  running: boolean
  run(opts?: {a?:string;b?:string;mode?:string;onMid?:()=>void;onDone?:()=>void}):void
  dispose():void
}
export function inkBurst(parent:HTMLElement, opts?:Record<string, unknown>):HTMLElement|null
