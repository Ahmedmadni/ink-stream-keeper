import { z } from "zod";

export const penPresetSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().finite().int().min(1).max(10),
  brush: z.enum(["solid", "pencil"]),
  smooth: z.boolean(), stabilization: z.number().finite().min(0).max(1),
  pressureEnabled: z.boolean(), sensitivity: z.number().finite().min(.5).max(1.5),
}).strict();
export type PenPreset = z.infer<typeof penPresetSchema>;
const schema = z.object({version:z.literal(1),pens:z.tuple([
  penPresetSchema.nullable(),penPresetSchema.nullable(),penPresetSchema.nullable(),
])}).strict();
export type PenFavorites = z.infer<typeof schema>;
type Storage = Pick<globalThis.Storage,"getItem"|"setItem"|"removeItem">;
export const emptyPenFavorites = ():PenFavorites => ({version:1,pens:[null,null,null]});
export function penFavoritesKey(scope:string) {
  if(!z.string().uuid().safeParse(scope).success)throw new Error("تعذر تحديد حساب إعدادات الأقلام.");
  return "memoflow:pen-favorites:v1:"+scope;
}
export function readPenFavorites(storage:Storage,scope:string):PenFavorites {
  const raw=storage.getItem(penFavoritesKey(scope));
  if(raw===null)return emptyPenFavorites();
  if(raw.length>4096)throw new Error("إعدادات الأقلام غير صالحة.");
  return schema.parse(JSON.parse(raw));
}
/** Merge only the explicitly chosen slot with a fresh storage read. Never
 * replace failed/corrupt reads with blank defaults or persist notebook content. */
export function writePenFavorite(storage:Storage,scope:string,slot:number,value:PenPreset|null):PenFavorites {
  if(!Number.isInteger(slot)||slot<0||slot>2)throw new Error("موضع القلم غير صالح.");
  const valid=value===null?null:penPresetSchema.parse(value);
  const next=readPenFavorites(storage,scope);next.pens[slot]=valid;
  storage.setItem(penFavoritesKey(scope),JSON.stringify(next));return next;
}
export function clearPenFavorites(storage:Storage,scope:string) {storage.removeItem(penFavoritesKey(scope));}
