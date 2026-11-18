import { expect,test } from "bun:test";
import {clearPenFavorites,penFavoritesKey,readPenFavorites,writePenFavorite,type PenPreset} from "../src/features/notebook/pen-favorites";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const pen:PenPreset={color:"#293648",width:4,brush:"solid",smooth:true,stabilization:.55,pressureEnabled:true,sensitivity:.6};
function storage(){const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};}
test("favorites are device/account scoped and only contain three validated pen configurations",()=>{
  const s=storage();expect(readPenFavorites(s,a).pens).toEqual([null,null,null]);
  writePenFavorite(s,a,0,pen);expect(readPenFavorites(s,b).pens).toEqual([null,null,null]);
  expect(readPenFavorites(s,a).pens[0]).toEqual(pen);
  expect(JSON.parse(s.data.get(penFavoritesKey(a))!)).toEqual({version:1,pens:[pen,null,null]});
  expect(()=>penFavoritesKey("../notes")).toThrow();
});
test("an explicit slot update rereads newer other slots and removal preserves them",()=>{
  const s=storage();writePenFavorite(s,a,0,pen);
  const other={...pen,color:"#445566",brush:"pencil" as const};writePenFavorite(s,a,2,other);
  writePenFavorite(s,a,0,{...pen,width:8});expect(readPenFavorites(s,a).pens[2]).toEqual(other);
  writePenFavorite(s,a,0,null);expect(readPenFavorites(s,a).pens).toEqual([null,null,other]);
});
test("corrupt, oversized and unsupported preferences never get overwritten by a save",()=>{
  const s=storage();
  for(const raw of ["{", "x".repeat(4097),JSON.stringify({version:2,pens:[pen,null,null]}),JSON.stringify({version:1,pens:[{...pen,content:"secret"},null,null]})]){
    s.data.set(penFavoritesKey(a),raw);
    expect(()=>readPenFavorites(s,a)).toThrow();expect(()=>writePenFavorite(s,a,1,pen)).toThrow();expect(s.data.get(penFavoritesKey(a))).toBe(raw);
  }
});
test("invalid preset fields and slots reject before storage mutation",()=>{
  const s=storage();
  for(const value of [{...pen,width:0},{...pen,width:1.5},{...pen,stabilization:NaN},{...pen,sensitivity:2},{...pen,color:"url(x)"},{...pen,brush:"oil"}])
    expect(()=>writePenFavorite(s,a,0,value as PenPreset)).toThrow();
  for(const slot of [-1,3,.5])expect(()=>writePenFavorite(s,a,slot,pen)).toThrow();expect(s.data.size).toBe(0);
});
test("storage errors propagate and reset touches only this account's favorites",()=>{
  const s=storage();writePenFavorite(s,a,0,pen);writePenFavorite(s,b,1,pen);s.data.set("note-draft-fixture","kept");
  const old=s.data.get(penFavoritesKey(a));
  expect(()=>writePenFavorite({...s,setItem:()=>{throw Error("quota");}},a,1,pen)).toThrow();expect(s.data.get(penFavoritesKey(a))).toBe(old);
  expect(()=>writePenFavorite({...s,getItem:()=>{throw Error("blocked");}},a,1,pen)).toThrow();
  clearPenFavorites(s,a);expect(readPenFavorites(s,a).pens).toEqual([null,null,null]);
  expect(readPenFavorites(s,b).pens[1]).toEqual(pen);expect(s.data.get("note-draft-fixture")).toBe("kept");
});
