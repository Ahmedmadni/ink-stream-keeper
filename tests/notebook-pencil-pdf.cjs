const assert=require("node:assert/strict");
const {inflateSync}=require("node:zlib");
const {writeFileSync}=require("node:fs");
async function checkPencilPdf(page,artifacts){
  const result=await page.evaluate(async()=>{
    const {createPage}=await import("/src/features/notebook/model.ts");
    const {createNotebookPdf,renderNotebookPage}=await import("/src/features/notebook/pdf-export.ts");
    const encode=bytes=>{let s="";for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);};
    const pages=["portrait","landscape"].map(orientation=>{
      const p=createPage({size:"a5",orientation,paper:"plain",tint:"white"});
      p.strokes=[{id:crypto.randomUUID(),tool:"pen",color:"#222222",width:24,brush:"pencil",smoothing:false,
        points:[[100,350],[900,350]],pressures:[.5,.5],pressureResponse:.6,cuts:[[.45,.55]]},
        {id:crypto.randomUUID(),tool:"pen",color:"#222222",width:24,brush:"pencil",smoothing:false,points:[[100,650],[900,650]]}];
      return p;
    });
    const pdf=await createNotebookPdf({version:1,pages});
    const solid=[];
    for(const p of pages){const ref=await renderNotebookPage({...p,strokes:p.strokes.map(s=>({...s,brush:undefined}))});solid.push(encode(ref.bytes));}
    return {pdf:encode(new Uint8Array(await pdf.arrayBuffer())),solid};
  });
  const pdf=Buffer.from(result.pdf,"base64");writeFileSync(artifacts+"/notebook-pencil.pdf",pdf);
  const images=[...pdf.toString("latin1").matchAll(/\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)];
  assert.equal(images.length,2);
  images.forEach((im,i)=>{
    const start=im.index+im[0].length,w=+im[1],h=+im[2];
    const pixels=inflateSync(pdf.subarray(start,start+(+im[3]))),solid=inflateSync(Buffer.from(result.solid[i],"base64"));
    assert.equal(pixels.length,solid.length);
    for(const band of [.35,.65]){
      let light=0,dark=0,solidDark=0;
      for(let y=Math.floor(h*band)-2;y<=Math.ceil(h*band)+2;y++)for(let x=Math.ceil(w*.15);x<Math.floor(w*.4);x++){
        const o=(y*w+x)*3;
        if(pixels[o]>170&&pixels[o]<230)light++;if(pixels[o]<160)dark++;if(solid[o]<50)solidDark++;
      }
      assert.ok(light>100&&dark>100&&solidDark>100,"pencil grain must survive PDF in both pressure-fill and fixed-width paths, distinct from solid ink");
    }
    for(let y=Math.floor(h*.35)-2;y<=Math.ceil(h*.35)+2;y++)for(let x=Math.ceil(w*.49);x<Math.floor(w*.51);x++){
      assert.ok(pixels[(y*w+x)*3]>245,"PDF must preserve the erased gap through the texture");
    }
  });
}
module.exports={checkPencilPdf};
