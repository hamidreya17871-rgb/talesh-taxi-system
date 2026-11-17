export type MunicipalSealKind = 'official' | 'leave-permit';

const OFFICIAL_MANAGER_SEAL = 'data:image/png;base64,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';

const INK = '#173bd1';

function star(cx: number, cy: number, outer = 11, inner = 4.8): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

function branch(x: number, flip = false): string {
  const transform = flip ? 'translate(300,0) scale(-1,1)' : '';
  return `<g transform="${transform}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${x},178 C${x-3},151 ${x-2},124 ${x+3},96 C${x+6},78 ${x+9},62 ${x+14},49"/>
    <path d="M${x+1},151 q-18,-2 -20,-17 q16,-1 20,17 M${x+3},128 q17,-4 20,-18 q-16,0 -20,18 M${x+5},104 q-17,-4 -18,-17 q15,1 18,17 M${x+9},81 q15,-5 17,-17 q-14,1 -17,17 M${x+12},61 q-12,-5 -10,-17 q12,3 10,17"/>
  </g>`;
}

export function municipalSealSvg(kind: MunicipalSealKind = 'official'): string {
  if (kind === 'official') return `<img src="${OFFICIAL_MANAGER_SEAL}" alt="مهر رسمی سازمان حمل و نقل شهرداری تالش" style="display:block;width:100%;height:auto;object-fit:contain" />`;
  const title = 'مرخصی و مجوز تردد';
  const sub = 'سازمان حمل و نقل همگانی شهر تالش';
  const center = `<g fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M99 126h102l-9-29h-82z M111 97l8-17h62l8 17 M110 127v14m80-14v14 M124 141h-12m76 0h-12"/><circle cx="120" cy="130" r="7"/><circle cx="180" cy="130" r="7"/><path d="M145 105h22"/></g><path d="${star(150,70,11,4.5)}"/> `;
  const ribbon = `<rect x="49" y="194" width="202" height="28" rx="8" fill="none" stroke="${INK}" stroke-width="3"/><text x="150" y="213" text-anchor="middle" font-size="14" font-weight="bold" fill="${INK}">مهر مجوز</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 235" role="img" aria-label="${title}" style="display:block;width:100%;height:auto">
    <g fill="none" stroke="${INK}">
      <circle cx="150" cy="111" r="91" stroke-width="4.5"/>
      <circle cx="150" cy="111" r="62" stroke-width="3"/>
      <path d="M94 27 Q150 2 206 27" stroke-width="3"/>
    </g>
    ${branch(42)}${branch(42,true)}
    <g fill="${INK}">${center}</g>
    <text x="150" y="34" text-anchor="middle" direction="rtl" font-size="13" font-weight="bold" fill="${INK}">${title}</text>
    <text x="150" y="181" text-anchor="middle" direction="rtl" font-size="13" font-weight="bold" fill="${INK}">${sub}</text>
    ${ribbon}
  </svg>`;
}
