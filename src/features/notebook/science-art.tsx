import { useId, type ComponentType } from "react";
import art0 from "./assets/scisvg/animal-cell.svg?raw";
import art1 from "./assets/scisvg/cell-membrane.svg?raw";
import art2 from "./assets/scisvg/neuron.svg?raw";
import art3 from "./assets/scisvg/chromosome.svg?raw";
import art4 from "./assets/scisvg/dna-double-helix.svg?raw";
import art5 from "./assets/scisvg/plasmid.svg?raw";
import art6 from "./assets/scisvg/mitochondrion.svg?raw";
import art7 from "./assets/scisvg/ribosome.svg?raw";
import art8 from "./assets/scisvg/erlenmeyer-flask.svg?raw";
import art9 from "./assets/scisvg/benzene-ring.svg?raw";
import art10 from "./assets/scisvg/peptide-bond.svg?raw";
import art11 from "./assets/scisvg/protein-ligand-binding.svg?raw";
import art12 from "./assets/scisvg/petri-dish.svg?raw";
import art13 from "./assets/scisvg/micropipette.svg?raw";
import art14 from "./assets/scisvg/microscope.svg?raw";
import art15 from "./assets/scisvg/test-tube-rack.svg?raw";
import art16 from "./assets/scisvg/96-well-plate.svg?raw";
import art17 from "./assets/scisvg/neural-network.svg?raw";
import art18 from "./assets/scisvg/phylogenetic-tree.svg?raw";
import art19 from "./assets/scisvg/heatmap.svg?raw";
type Props = { size?: number | string; strokeWidth?: number; color?: string; className?: string };
// Only audited, locally bundled CC BY 4.0 SVGs enter this renderer. Never use
// this function with user HTML/SVG. Original artwork and provenance are retained.
function artwork(raw: string): ComponentType<Props> {
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1] || "0 0 512 512";
  const body = raw.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  return function ScienceGlyph({ size = 24, className }: Props) {
    const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    let scoped = body;
    for (const id of ids) {
      scoped = scoped.split('id="' + id + '"').join('id="' + prefix + '-' + id + '"')
        .split('url(#' + id + ')').join('url(#' + prefix + '-' + id + ')');
    }
    return <svg width={size} height={size} viewBox={viewBox} className={className} aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg" dangerouslySetInnerHTML={{ __html: scoped }}/>;
  };
}
export const SCIENCE_ART = {
  "sci-animal-cell": artwork(art0),
  "sci-cell-membrane": artwork(art1),
  "sci-neuron": artwork(art2),
  "sci-chromosome": artwork(art3),
  "sci-dna-double-helix": artwork(art4),
  "sci-plasmid": artwork(art5),
  "sci-mitochondrion": artwork(art6),
  "sci-ribosome": artwork(art7),
  "sci-erlenmeyer-flask": artwork(art8),
  "sci-benzene-ring": artwork(art9),
  "sci-peptide-bond": artwork(art10),
  "sci-protein-ligand-binding": artwork(art11),
  "sci-petri-dish": artwork(art12),
  "sci-micropipette": artwork(art13),
  "sci-microscope": artwork(art14),
  "sci-test-tube-rack": artwork(art15),
  "sci-96-well-plate": artwork(art16),
  "sci-neural-network": artwork(art17),
  "sci-phylogenetic-tree": artwork(art18),
  "sci-heatmap": artwork(art19),
} as const;
export const SCIENCE_ITEMS = [
  ["sci-animal-cell", "خلية حيوانية"],
  ["sci-cell-membrane", "غشاء الخلية"],
  ["sci-neuron", "خلية عصبية"],
  ["sci-chromosome", "كروموسوم"],
  ["sci-dna-double-helix", "لولب الحمض النووي"],
  ["sci-plasmid", "بلازميد"],
  ["sci-mitochondrion", "ميتوكوندريا"],
  ["sci-ribosome", "ريبوسوم"],
  ["sci-erlenmeyer-flask", "دورق مخروطي"],
  ["sci-benzene-ring", "حلقة البنزين"],
  ["sci-peptide-bond", "رابطة ببتيدية"],
  ["sci-protein-ligand-binding", "ارتباط بروتين"],
  ["sci-petri-dish", "طبق بتري"],
  ["sci-micropipette", "ماصة دقيقة"],
  ["sci-microscope", "مجهر علمي"],
  ["sci-test-tube-rack", "حامل أنابيب"],
  ["sci-96-well-plate", "صفيحة مختبر"],
  ["sci-neural-network", "شبكة عصبية"],
  ["sci-phylogenetic-tree", "شجرة تطورية"],
  ["sci-heatmap", "خريطة حرارية"],
] as const;
