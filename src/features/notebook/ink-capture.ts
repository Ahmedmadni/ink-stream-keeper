import type {InkStroke} from "./model";
import type {Point} from "./ink";

/** Distance filter plus real pen pressure changes. Pointer-up pressure is
 * commonly zero; don't append a fabricated taper to a stationary endpoint. */
export function shouldCaptureInkSample(stroke:InkStroke,next:Point,aspect:number,event:Pick<PointerEvent,"type"|"pointerType"|"pressure">):boolean{
  const prev=stroke.points[stroke.points.length-1];
  if(Math.hypot(next[0]-prev[0],(next[1]-prev[1])*aspect)>=.35)return true;
  return stroke.tool==="pen"&&!!stroke.pressures&&event.pointerType==="pen"&&event.type==="pointermove"&&
    Number.isFinite(event.pressure)&&event.pressure>=0&&event.pressure<=1&&
    Math.abs(event.pressure-stroke.pressures[stroke.pressures.length-1])>=.01;
}
