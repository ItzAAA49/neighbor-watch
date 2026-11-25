(function(){
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function portrait(person, opts={}) {
    const t=new Set(person.tags||[]), night=!!opts.night||t.has('night');
    const skin=night?'#786d79':'#d8bda0', shade=night?'#514a58':'#b58e6e', hair=night?'#302b34':'#46372d', ink='#28241f', shirt=night?'#48434f':'#5e6060';
    const round=t.has('roundFace'), square=t.has('squareFace'), long=t.has('longFace'), slim=t.has('slimFace'), oval=t.has('ovalFace'), smallHead=t.has('smallHead');
    const x1=smallHead?96:(round?65:((slim||oval)?88:(long?84:78))), x2=260-x1, y1=48, y2=236-(t.has('longNeck')?12:0);
    const headPath=square?`M${x1+8} 63 Q130 32 ${x2-8} 63 L${x2} 174 Q${x2-4} 228 130 ${y2} Q${x1+4} 228 ${x1} 174 Z`:round?`M${x1} 104 Q${x1+2} 40 130 43 Q${x2-2} 40 ${x2} 104 Q${x2+4} 207 130 ${y2} Q${x1-4} 207 ${x1} 104 Z`:long?`M${x1} 88 Q${x1+4} 30 130 35 Q${x2-4} 30 ${x2} 88 L${x2-2} 190 Q${x2-10} 239 130 ${y2} Q${x1+10} 239 ${x1+2} 190 Z`:`M${x1} 91 Q${x1+4} 37 130 42 Q${x2-4} 37 ${x2} 91 L${x2-4} 177 Q${x2-12} 225 130 ${y2} Q${x1+12} 225 ${x1+4} 177 Z`;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 290" role="img" aria-label="${esc(person.name)}の似顔絵"><defs><linearGradient id="coat" x2="0" y2="1"><stop stop-color="${night?'#77707a':'#8a8170'}"/><stop offset="1" stop-color="${shirt}"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation=".45"/></filter></defs>`;
    // shoulders, neck
    const neckPath=t.has('longNeck')?'M105 216 L105 276 Q130 292 155 276 L155 216Z':'M105 218 L105 252 Q130 266 155 252 L155 218Z';
    svg+=`<path d="M32 290 Q40 238 89 229 L105 219 L155 219 L173 230 Q224 240 230 290Z" fill="url(#coat)" stroke="${ink}" stroke-width="5"/><path d="${neckPath}" fill="${skin}" stroke="${ink}" stroke-width="3"/><path d="M94 236 L130 266 L166 236 L183 290 H77Z" fill="${night?'#a9a0a9':'#e1d5bf'}" stroke="${ink}" stroke-width="3"/>`;
    // ears & face
    svg+=`<path d="M${x1+4} 123 Q${x1-20} 107 ${x1-16} 151 Q${x1-12} 177 ${x1+8} 169Z M${x2-4} 123 Q${x2+20} 107 ${x2+16} 151 Q${x2+12} 177 ${x2-8} 169Z" fill="${skin}" stroke="${ink}" stroke-width="4"/>`;
    svg+=`<path d="${headPath}" fill="${skin}" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
    // hair cap
    const shortHair=t.has('shortHair');
    let hairPath=t.has('longHair')||t.has('straightHair')?`M${x1-7} 116 Q${x1-14} 31 130 27 Q${x2+14} 29 ${x2+7} 116 L${x2+2} 245 Q${x2-20} 259 ${x2-18} 145 Q130 83 ${x1+18} 148 L${x1+11} 242 Q${x1-7} 237 ${x1-7} 116Z`:shortHair?`M${x1-4} 107 Q${x1-3} 23 130 25 Q${x2+3} 22 ${x2+4} 107 Q157 64 130 69 Q105 61 ${x1+4} 108Z`:`M${x1-4} 107 Q${x1-3} 23 130 25 Q${x2+3} 22 ${x2+4} 107 Q157 64 130 69 Q105 61 ${x1+4} 108Z`;
    svg+=`<path d="${hairPath}" fill="${hair}" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
    if(t.has('curlyHair')) svg+=`<path d="M78 83 Q63 44 89 48 Q92 24 116 40 Q132 16 150 39 Q178 27 182 62 Q201 77 183 104 Q163 71 153 68 Q124 83 105 64 Q90 83 78 83Z" fill="${hair}" stroke="${ink}" stroke-width="4"/>`;
    if(t.has('curlLeft')||t.has('curlRight')) { const sx=t.has('curlLeft')?100:158; svg+=`<path d="M${sx} 38 q-20 -19 -6 -27 q13 -4 13 8 q-9 -7 -10 1 q-2 7 8 10" fill="none" stroke="${night?'#28242b':'#31271f'}" stroke-width="6" stroke-linecap="round"/>`; }
    if(t.has('twinTails')) svg+=`<path d="M82 73 Q44 69 49 160 Q70 173 91 126 M178 73 Q216 69 211 160 Q190 173 169 126" fill="${hair}" stroke="${ink}" stroke-width="5"/>`;
    if(t.has('hat')) svg+=`<path d="M62 69 Q130 22 198 68 L210 82 Q130 68 50 84Z" fill="#514537" stroke="${ink}" stroke-width="5"/><path d="M94 48 Q130 18 166 48 L169 67 L90 67Z" fill="#67543d" stroke="${ink}" stroke-width="4"/>`;
    if(t.has('headband')) svg+=`<path d="M72 89 Q130 59 188 89" fill="none" stroke="#9b7653" stroke-width="8"/>`;
    if(t.has('horns')) svg+=`<path d="M91 58 Q53 21 53 2 Q86 9 104 42 M169 58 Q207 21 207 2 Q174 9 156 42" fill="#9c8b89" stroke="${ink}" stroke-width="5"/>`;
    if(t.has('spikes15')) { for(let i=0;i<15;i++){let x=67+i*8.7;svg+=`<path d="M${x} 51 l-3 -13 l9 9" fill="#897b82" stroke="${ink}" stroke-width="2"/>`;} }
    // brows, eyes
    const brow=t.has('noBrows')?'':t.has('singleBrow')?`<path d="M83 118 Q130 95 177 118" fill="none" stroke="${hair}" stroke-width="10" stroke-linecap="round"/>`:t.has('bigBrow')?`<path d="M78 119 Q101 99 119 118 M141 118 Q164 99 184 119" fill="none" stroke="${hair}" stroke-width="11" stroke-linecap="round"/>`:t.has('thinBrow')?`<path d="M82 120 Q101 112 118 120 M142 120 Q159 112 178 120" fill="none" stroke="${hair}" stroke-width="2.5" stroke-linecap="round"/>`:`<path d="M82 120 Q101 111 118 120 M142 120 Q159 111 178 120" fill="none" stroke="${hair}" stroke-width="5" stroke-linecap="round"/>`;
    svg+=brow;
    const eyeY=t.has('tiredEyes')?139:136, eyeW=t.has('smallEyes')?11:16;
    const eye=(x,dx=0,iris='#3b342a')=>`<g><path d="M${x-eyeW} ${eyeY} Q${x} ${eyeY-12} ${x+eyeW} ${eyeY} Q${x} ${eyeY+12} ${x-eyeW} ${eyeY}Z" fill="#eee6d7" stroke="${ink}" stroke-width="3"/><ellipse cx="${x+dx}" cy="${eyeY}" rx="5.5" ry="8" fill="${iris}"/><circle cx="${x+dx}" cy="${eyeY}" r="2.8" fill="#171614"/></g>`;
    let leftIris=t.has('oddEyes')?'#4c8fb2':(t.has('redEyes')?'#aa312d':'#47392d'),rightIris=t.has('oddEyes')?'#678d49':leftIris;
    svg+=eye(103,t.has('crossEyeLeft')?6:0,leftIris)+eye(157,0,rightIris);
    if(t.has('tiredEyes')) svg+=`<path d="M85 151 Q103 160 121 151 M139 151 Q158 160 175 151" fill="none" stroke="#79615b" stroke-width="3"/>`;
    if(t.has('glasses')) svg+=`<g fill="none" stroke="#29251f" stroke-width="4"><circle cx="103" cy="137" r="23"/><circle cx="157" cy="137" r="23"/><path d="M126 137 H134 M80 133 L67 128 M180 133 L193 128"/></g>`;
    if(t.has('monocle')) svg+=`<circle cx="157" cy="137" r="26" fill="none" stroke="#6a5132" stroke-width="5"/><path d="M177 155 Q198 192 191 224" fill="none" stroke="#6a5132" stroke-width="2"/>`;
    if(t.has('extraEyes')) svg+=`<g>${eye(130,0,night?'#b7a3b3':'#4b382b').replaceAll(String(eyeY),String(90))}</g>`;
    if(t.has('eyes6')){[[83,85],[130,76],[177,85],[91,174]].forEach(([x,y])=>{const e=eye(x,0,night?'#b7a3b3':'#4b382b').replaceAll(String(eyeY),String(y));svg+=e;});}
    if(t.has('eyes9')){[[75,92],[103,78],[130,72],[157,78],[185,92],[88,169],[112,178]].forEach(([x,y])=>{svg+=eye(x,0,night?'#b7a3b3':'#4b382b').replaceAll(String(eyeY),String(y));});}
    if(t.has('foreheadEye')) svg+=`<path d="M110 86 Q130 69 150 86 Q130 105 110 86Z" fill="#eee3d0" stroke="${ink}" stroke-width="3"/><circle cx="130" cy="86" r="7" fill="#a83c35"/>`;
    if(t.has('insectEyes')) svg+=`<g fill="#8b3330" stroke="${ink}" stroke-width="3"><ellipse cx="85" cy="130" rx="16" ry="21"/><ellipse cx="175" cy="130" rx="16" ry="21"/></g>`;
    if(t.has('antennae')) svg+=`<path d="M105 48 Q81 10 72 7 M155 48 Q179 10 188 7" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="72" cy="7" r="5" fill="#9b443d"/><circle cx="188" cy="7" r="5" fill="#9b443d"/>`;
    // nose and mouth
    let nose=t.has('elephantNose')?`M119 132 Q88 158 103 192 Q118 220 139 196 Q153 171 130 135Z`:t.has('longNose')?`M130 132 Q120 178 121 211 Q130 221 139 211 Q140 178 130 132Z`:t.has('bigNose')?`M130 132 Q113 178 101 181 Q130 198 159 181 Q145 165 130 132Z`:t.has('pointNose')?`M130 134 L115 184 L134 187 Q142 176 130 134Z`:`M130 138 Q127 174 119 178 Q130 185 142 178`;
    svg+=`<path d="${nose}" fill="${t.has('elephantNose')?shade:'none'}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
    if(t.has('bigSmile')) svg+=`<path d="M88 190 Q130 228 172 190 Q160 244 130 239 Q99 236 88 190Z" fill="#713b35" stroke="${ink}" stroke-width="4"/><path d="M98 197 Q130 214 162 197 L157 207 Q130 220 103 207Z" fill="#eee5d0"/>`;
    else if(t.has('fullLips')) svg+=`<path d="M91 202 Q111 185 130 198 Q150 185 169 202 Q151 230 130 216 Q108 230 91 202Z" fill="#a35e59" stroke="${ink}" stroke-width="3"/>`;
    else svg+=`<path d="M107 207 Q130 ${t.has('tiredEyes')?211:222} 153 207" fill="none" stroke="#563b32" stroke-width="4" stroke-linecap="round"/>`;
    if(t.has('mustache')) svg+=`<path d="M96 196 Q105 183 128 198 Q151 183 164 196 Q151 212 130 207 Q108 213 96 196Z" fill="${hair}" stroke="${ink}" stroke-width="3"/>`;
    if(t.has('goatee')) svg+=`<path d="M112 222 Q130 246 148 222 L143 253 Q130 266 117 253Z" fill="${hair}" stroke="${ink}" stroke-width="3"/>`;
    if(t.has('smoking')) svg+=`<path d="M157 214 L191 210" stroke="#e2d8c5" stroke-width="5" stroke-linecap="round"/><path d="M186 210 L193 210" stroke="#a84c39" stroke-width="5"/><path d="M191 205 Q205 191 196 181 Q190 173 202 164" fill="none" stroke="#bdb4a3" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    if(t.has('bigTeeth')||t.has('fangs')) svg+=`<path d="M106 206 Q130 217 154 206 L150 226 L142 219 L135 230 L127 218 L119 229 L112 219Z" fill="#f1e8d2" stroke="${ink}" stroke-width="2"/>`;
    if(t.has('stitchedMouth')) svg+=`<path d="M102 211 Q130 220 158 211" fill="none" stroke="#242026" stroke-width="7"/><path d="M107 204 L113 218 M121 206 L127 222 M137 207 L143 221 M151 204 L155 216" stroke="#c5aab0" stroke-width="3"/>`;
    // details
    if(t.has('moleLeft')) svg+=`<circle cx="91" cy="178" r="5" fill="#4a342d"/>`;
    if(t.has('moleRight')) svg+=`<circle cx="169" cy="178" r="5" fill="#4a342d"/>`;
    if(t.has('freckles')){for(let i=0;i<9;i++){let x=104+(i%5)*13,y=171+Math.floor(i/5)*9;svg+=`<circle cx="${x}" cy="${y}" r="1.8" fill="#8e6048"/>`;}}
    if(t.has('scar')) svg+=`<path d="M149 206 l13 -8 M150 211 l14 -8" stroke="#875f53" stroke-width="3"/>`;
    if(t.has('tattoo')||t.has('tattoo2')) svg+=`<path d="M93 91 q9 -9 18 0 q-9 12 -18 0 M151 86 q9 -9 18 0 q-9 12 -18 0" fill="none" stroke="#3c2d3a" stroke-width="3"/>`;
    if(t.has('stripes'))svg+=`<path d="M72 108 l28 8 M160 116 l29 -8 M75 165 l27 -7 M158 158 l28 9" stroke="#27252c" stroke-width="5" opacity=".85"/>`;
    if(t.has('earrings'))svg+=`<g fill="none" stroke="#c5a866" stroke-width="4"><circle cx="63" cy="170" r="7"/><circle cx="197" cy="170" r="7"/></g>`;
    if(t.has('fingers24')){for(let i=0;i<12;i++){const x=30+i*17;svg+=`<path d="M${x} 270 l-3 -34 q3 -8 7 0 l2 34 M${260-x} 270 l-3 -34 q3 -8 7 0 l2 34" fill="none" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>`;}}
    if(t.has('headHand'))svg+=`<path d="M107 52 Q100 35 106 28 Q112 22 116 35 L118 16 Q124 10 127 18 L129 35 L135 14 Q142 10 144 19 L140 41 L151 31 Q159 33 153 44 L142 61Z" fill="${skin}" stroke="${ink}" stroke-width="3"/>`;
    if(t.has('strongJaw'))svg+=`<path d="M94 202 Q130 252 166 202" fill="none" stroke="${shade}" stroke-width="5"/>`;
    if(t.has('tattooEyes5')||t.has('tattooEyes')){for(let i=0;i<(t.has('tattooEyes5')?5:3);i++){let x=78+i*22;svg+=`<ellipse cx="${x}" cy="72" rx="6" ry="3.5" fill="#ddd1c1" stroke="${ink}" stroke-width="1.5"/><circle cx="${x}" cy="72" r="1.5" fill="#342b31"/>`}}
    if(t.has('snakes7')){for(let i=0;i<7;i++){let x=67+i*21;svg+=`<path d="M${x} 66 q-7 -22 5 -28 q8 -3 5 8" fill="none" stroke="#66734b" stroke-width="5" stroke-linecap="round"/>`}}
    if(t.has('pointEars'))svg+=`<path d="M77 145 Q34 69 35 52 Q78 85 83 146 M183 145 Q226 69 225 52 Q182 85 177 146" fill="${skin}" stroke="${ink}" stroke-width="4"/>`;
    else if(t.has('largeEars'))svg+=`<path d="M70 143 Q23 72 38 77 Q80 91 81 146 M190 143 Q237 72 222 77 Q180 91 179 146" fill="${skin}" stroke="${ink}" stroke-width="4"/>`;
    if(t.has('42Face'))svg+=`<text x="130" y="183" text-anchor="middle" font-family="monospace" font-weight="900" font-size="114" fill="#a72f28" stroke="#4a201e" stroke-width="2">42</text>`;
    if(t.has('roundNose')||t.has('smallNose'))svg+=`<circle cx="119" cy="182" r="3" fill="${shade}"/><circle cx="141" cy="182" r="3" fill="${shade}"/>`;
    if(t.has('longNeck'))svg+=`<path d="M100 246 Q130 275 160 246" fill="none" stroke="${shade}" stroke-width="4"/>`;
    if(t.has('narrowJaw'))svg+=`<path d="M104 216 Q130 246 156 216" fill="none" stroke="${shade}" stroke-width="3"/>`;
    if(t.has('extraEyes')) svg+=`<circle cx="130" cy="94" r="4" fill="#9b3835"/>`;
    if(t.has('boneHead'))svg+=`<path d="M85 78 Q130 49 175 78 M95 173 Q130 193 165 173 M112 112 v16 M148 112 v16" fill="none" stroke="#e0d7c9" stroke-width="5"/>`;
    if(t.has('crown'))svg+=`<path d="M75 42 L83 6 L108 30 L130 0 L152 30 L177 6 L185 42Z" fill="#a18a55" stroke="${ink}" stroke-width="4"/>`;
    if(t.has('twinTails'))svg+=`<path d="M56 150 q-14 12 -2 29 M204 150 q14 12 2 29" fill="none" stroke="#8b765a" stroke-width="6"/>`;
    svg+=`<path d="M84 260 Q130 274 176 260" fill="none" stroke="${night?'#a79da9':'#aa9a7f'}" stroke-width="2" opacity=".7"/><text x="130" y="284" text-anchor="middle" font-family="monospace" font-size="7" fill="${night?'#d3c8d4':'#594d3d'}">D.D.D. PERSONNEL / FILE</text></svg>`;
    return svg;
  }
  window.NW_FACE={portrait,esc};
})();
