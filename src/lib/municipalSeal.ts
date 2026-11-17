export type MunicipalSealKind = 'official' | 'leave-permit';

const INK = '#173bd1';

function star(cx: number, cy: number, outer = 11, inner = 4.8): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(\`\${(cx + r * Math.cos(a)).toFixed(1)},\${(cy + r * Math.sin(a)).toFixed(1)}\`);
  }
  return \`M\${pts.join(' L')} Z\`;
}

function branch(x: number, flip = false): string {
  const transform = flip ? \`translate(\${2 * x},0) scale(-1,1)\` : '';
  return \`<g transform="\${transform}" fill="none" stroke="\${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M\${x},178 C\${x-3},151 \${x-2},124 \${x+3},96 C\${x+6},78 \${x+9},62 \${x+14},49"/>
    <path d="M\${x+1},151 q-18,-2 -20,-17 q16,-1 20,17 M\${x+3},128 q17,-4 20,-18 q-16,0 -20,18 M\${x+5},104 q-17,-4 -18,-17 q15,1 18,17 M\${x+9},81 q15,-5 17,-17 q-14,1 -17,17 M\${x+12},61 q-12,-5 -10,-17 q12,3 10,17"/>
  </g>\`;
}

export function municipalSealSvg(kind: MunicipalSealKind = 'official'): string {
  const title = kind === 'official' ? 'شهرداری تالش' : 'مرخصی و مجوز تردد';
  const sub = kind === 'official' ? 'سازمان حمل و نقل همگانی' : 'سازمان حمل و نقل همگانی شهر تالش';
  const center = kind === 'official'
    ? [star(150, 83, 13, 5.5), star(119, 111, 13, 5.5), star(181, 111, 13, 5.5), star(130, 145, 13, 5.5), star(170, 145, 13, 5.5)].join('')
    : \`<g fill="none" stroke="\${INK}" stroke-width="4" stroke-linejoin="round"><path d="M99 126h102l-9-29h-82z M111 97l8-17h62l8 17 M110 127v14m80-14v14 M124 141h-12m76 0h-12"/><circle cx="120" cy="130" r="7"/><circle cx="180" cy="130" r="7"/><path d="M145 105h22"/></g><path d="\${star(150,70,11,4.5)}"/>\`;
  const ribbon = kind === 'leave-permit'
    ? \`<rect x="49" y="194" width="202" height="28" rx="8" fill="none" stroke="\${INK}" stroke-width="3"/><text x="150" y="213" text-anchor="middle" font-size="14" font-weight="bold" fill="\${INK}">مهر مجوز</text>\`
    : '<text x="150" y="211" text-anchor="middle" font-size="12" font-weight="bold" fill="'+INK+'">شهر تالش و حومه</text>';
  return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 235" role="img" aria-label="\${title}" style="display:block;width:100%;height:auto">
    <g fill="none" stroke="\${INK}">
      <circle cx="150" cy="111" r="91" stroke-width="4.5"/>
      <circle cx="150" cy="111" r="62" stroke-width="3"/>
      <path d="M94 27 Q150 2 206 27" stroke-width="3"/>
    </g>
    \${branch(42)}\${branch(42,true)}
    <g fill="\${INK}">\${center}</g>
    <text x="150" y="34" text-anchor="middle" direction="rtl" font-size="13" font-weight="bold" fill="\${INK}">\${title}</text>
    <text x="150" y="181" text-anchor="middle" direction="rtl" font-size="13" font-weight="bold" fill="\${INK}">\${sub}</text>
    \${ribbon}
  </svg>\`;
}
