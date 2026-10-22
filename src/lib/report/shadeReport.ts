import { labToHex, type Lab } from '@/lib/color/convert';
import { findGingiva, GINGIVA_SYSTEM } from '@/lib/color/gingiva';
import { tabProfile, type ThirdsProfile } from '@/lib/color/match';
import { findShade, getSystem } from '@/lib/color/shades';
import { cropToBase64, expandRect, fileToDataUrl } from '@/lib/image/crop';
import type { Rect } from '@/lib/image/stats';
import type { ShadeCase } from '@/lib/storage/cases';
import type { Settings } from '@/lib/storage/settings';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (l: Lab) => `${l.L.toFixed(1)} / ${l.a.toFixed(1)} / ${l.b.toFixed(1)}`;

/**
 * Recorte da foto em volta de um quadro, com o quadro e (opcionalmente) as linhas dos terços por cima.
 * Devolve um <svg> com a imagem embutida, para o PDF.
 */
async function framedCrop(c: ShadeCase, rect: Rect, color: string, thirds: boolean, lower: boolean, widthPx: number): Promise<string> {
  const region = expandRect(rect, 3.2, 2.4, c.photoWidth, c.photoHeight);
  const crop = await cropToBase64(c.photoUri, region, c.photoWidth, c.photoHeight, 900);
  const k = crop.width / region.width; // px do recorte por px da foto
  const x = (rect.x - region.x) * k;
  const y = (rect.y - region.y) * k;
  const w = rect.width * k;
  const h = rect.height * k;
  const sw = Math.max(2, crop.width / 300);
  const labels = lower ? ['Incisal', 'Médio', 'Cervical'] : ['Cervical', 'Médio', 'Incisal'];
  const fs = Math.max(10, crop.width / 40);
  const third = thirds
    ? [1, 2]
        .map((i) => `<line x1="${x}" y1="${y + (h * i) / 3}" x2="${x + w}" y2="${y + (h * i) / 3}" stroke="${color}" stroke-width="${sw * 0.7}" stroke-dasharray="${sw * 3} ${sw * 2}"/>`)
        .join('') +
      labels.map((t, i) => `<text x="${x + w + fs * 0.5}" y="${y + (h * (i + 0.5)) / 3 + fs * 0.35}" font-size="${fs}" font-family="Helvetica,Arial" fill="#fff" stroke="#000" stroke-width="${fs / 8}" paint-order="stroke">${t}</text>`).join('')
    : '';
  return `<svg width="${widthPx}" viewBox="0 0 ${crop.width} ${crop.height}" xmlns="http://www.w3.org/2000/svg" style="border-radius:8px">
<image href="data:image/jpeg;base64,${crop.base64}" width="${crop.width}" height="${crop.height}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${sw}" rx="${sw}"/>${third}</svg>`;
}

/** Tab da escala desenhado a partir dos valores (colo → incisal), quando não há foto do tab real. */
function syntheticTab(profile: ThirdsProfile, label: string, widthPx: number): string {
  const c0 = labToHex(profile.cervical);
  const c1 = labToHex(profile.middle);
  const c2 = labToHex(profile.incisal);
  return `<svg width="${widthPx}" viewBox="0 0 100 190" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="0.5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect x="30" y="2" width="40" height="34" rx="6" fill="#D9DDE5" stroke="#B9C0CC"/>
<path d="M20 40 Q20 30 32 30 L68 30 Q80 30 80 40 L84 120 Q86 170 50 186 Q14 170 16 120 Z" fill="url(#g)" stroke="#9AA3B2" stroke-width="1.5"/>
<text x="50" y="22" font-size="13" font-family="Helvetica,Arial" font-weight="700" text-anchor="middle" fill="#13203A">${esc(label)}</text>
</svg>`;
}

async function tabImage(uri: string | undefined, fallbackSvg: string, widthPx: number): Promise<{ html: string; real: boolean }> {
  if (uri) {
    const data = await fileToDataUrl(uri);
    if (data) return { html: `<img src="${data}" style="width:${widthPx}px;border-radius:8px;border:1px solid #E3E7EF"/>`, real: true };
  }
  return { html: fallbackSvg, real: false };
}

const swatches = (p: ThirdsProfile) =>
  (['cervical', 'middle', 'incisal'] as const)
    .map((k) => `<div class="sw3"><div class="swb" style="background:${labToHex(p[k])}"></div><div class="swl">${k === 'cervical' ? 'Cervical' : k === 'middle' ? 'Médio' : 'Incisal'}</div><div class="swv">${fmt(p[k])}</div></div>`)
    .join('');

/** HTML do PDF "Prescrição de cor" com a boca do paciente (terços marcados) ao lado do tab real mais próximo. */
export async function buildShadeReportHtml(c: ShadeCase, s: Settings): Promise<string> {
  const system = getSystem(c.shadeSystem);
  const best = c.matches[0];
  const alt = c.matches[1];
  const bestRef = best ? findShade(c.shadeSystem, best.shadeId) : undefined;
  const calibLab = best ? s.calibrations[c.shadeSystem]?.[best.shadeId] : undefined;
  const bestProfile = bestRef ? tabProfile(calibLab ?? bestRef.lab, s.calibrationThirds[c.shadeSystem]?.[best!.shadeId]) : undefined;
  const toothProfile: ThirdsProfile = c.thirds ?? { cervical: c.toothLab, middle: c.toothLab, incisal: c.toothLab };

  let toothBlock = '';
  if (c.toothRect && best && bestProfile) {
    const [mouth, tab] = await Promise.all([
      framedCrop(c, c.toothRect, '#2F6BFF', true, !!c.lowerTooth, 330),
      tabImage(s.tabImages[c.shadeSystem]?.[best.shadeId], syntheticTab(bestProfile, best.shadeId, 150), 150),
    ]);
    toothBlock = `<div class="cols">
<div class="col"><div class="cap">Dente ${esc(c.tooth) || ''} do paciente · quadro lido em três terços</div>${mouth}<div class="row3">${swatches(toothProfile)}</div></div>
<div class="col tabcol"><div class="cap">Tab mais próximo</div>${tab.html}<div class="big">${esc(best.shadeId)}</div><div class="muted">${tab.real ? 'foto do seu tab, calibrado neste aparelho' : 'ilustração a partir dos valores da escala'}</div><div class="row3">${swatches(bestProfile)}</div></div>
</div>`;
  } else if (best) {
    toothBlock = `<div class="cols"><div class="col"><span class="sw" style="background:${c.toothHex}"></span><b>Dente medido</b> L*a*b* ${fmt(c.toothLab)}</div>
<div class="col"><span class="sw" style="background:${bestRef ? labToHex(calibLab ?? bestRef.lab) : '#ccc'}"></span><b>Tab ${esc(best.shadeId)}</b></div></div>`;
  }

  let gumBlock = '';
  if (c.gingivaLab) {
    const gBest = c.gingivaMatches?.[0];
    const gRef = gBest ? findGingiva(gBest.shadeId) : undefined;
    const gLab = gBest ? (s.gingivaCalibrations[gBest.shadeId] ?? gRef?.lab) : undefined;
    const gumSvg = gLab ? `<svg width="150" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="84" height="104" rx="12" fill="${labToHex(gLab)}" stroke="#9AA3B2" stroke-width="1.5"/><text x="50" y="66" font-size="16" font-family="Helvetica,Arial" font-weight="700" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="0.6" paint-order="stroke">${esc(gBest!.shadeId)}</text></svg>` : '';
    const [gum, tab] = await Promise.all([
      c.gingivaRect ? framedCrop(c, c.gingivaRect, '#E05C8A', false, false, 330) : Promise.resolve(`<span class="sw" style="background:${c.gingivaHex}"></span>`),
      gBest ? tabImage(s.gingivaTabImages[gBest.shadeId], gumSvg, 150) : Promise.resolve({ html: '', real: false }),
    ]);
    gumBlock = `<h2>Gengiva</h2><div class="cols">
<div class="col"><div class="cap">Gengiva do paciente</div>${gum}<div class="muted">L*a*b* ${fmt(c.gingivaLab)}</div></div>
<div class="col tabcol"><div class="cap">Tab de gengiva mais próximo · ${GINGIVA_SYSTEM.name}</div>${tab.html}${gBest ? `<div class="big">${esc(gBest.shadeId)}</div><div class="muted">${tab.real ? 'foto do seu tab' : 'cor aproximada da escala'}${c.gingivaMatches?.[1] ? ` · alternativa ${esc(c.gingivaMatches[1].shadeId)}` : ''}</div>` : '<div class="muted">sem escala de gengiva comparada</div>'}</div>
</div>`;
  }

  const rows = c.matches
    .map((m, i) => `<tr><td>${i === 0 ? 'Mais provável' : i === 1 ? 'Alternativa' : i + 1}</td><td><b>${esc(m.shadeId)}</b></td><td>${m.deltaE.toFixed(1)}</td></tr>`)
    .join('');

  return `<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial;padding:28px;color:#13203A}
h1{margin:0 0 4px;font-size:22px} h2{font-size:16px;margin:18px 0 6px} .muted{color:#6B7690;font-size:12px}
table{border-collapse:collapse;margin-top:10px;width:100%} td,th{border:1px solid #E3E7EF;padding:8px;text-align:left;font-size:14px}
.sw{display:inline-block;width:28px;height:28px;border-radius:6px;border:1px solid #ccc;vertical-align:middle;margin-right:8px}
.box{border:1px solid #E3E7EF;border-radius:10px;padding:14px;margin-top:14px}
.cols{display:flex;gap:18px;align-items:flex-start;margin-top:8px} .col{flex:1} .tabcol{flex:0 0 190px;text-align:center}
.cap{font-size:12px;color:#6B7690;margin-bottom:6px} .big{font-size:30px;font-weight:700;margin-top:6px}
.row3{display:flex;gap:6px;margin-top:8px} .sw3{flex:1;text-align:center} .swb{height:26px;border-radius:6px;border:1px solid #ccc} .swl{font-size:11px;font-weight:600;margin-top:3px} .swv{font-size:9px;color:#6B7690}
</style></head><body>
<h1>Prescrição de cor</h1>
<div class="muted">${esc(s.clinicName || 'Cypris Smile')}${s.dentistName ? ' · ' + esc(s.dentistName) : ''} · ${new Date(c.createdAt).toLocaleString('pt-BR')}</div>
<div class="box">
<b>Paciente:</b> ${esc(c.patientName)}<br/>
<b>Dente:</b> ${esc(c.tooth) || '—'}<br/>
<b>Escala:</b> ${system.name} ${c.calibrated ? '(calibrada no aparelho)' : '(valores padrão)'}<br/>
<b>Referência usada:</b> ${esc(c.referenceLabel)}
</div>
<div class="box">
<b>Cor sugerida: ${best ? esc(best.shadeId) : '—'}</b>${alt ? ` <span class="muted">· alternativa mais próxima: ${esc(alt.shadeId)}</span>` : ''}
${toothBlock}
<table><tr><th>Resultado</th><th>Tab</th><th>ΔE00</th></tr>${rows}</table>
${gumBlock}
</div>
${c.notes ? `<div class="box"><b>Observações</b><br/>${esc(c.notes).replace(/\n/g, '<br/>')}</div>` : ''}
<p class="muted">Medição por câmera corrigida por referência, dente lido do colo à borda incisal e comparado com o tab inteiro. Confirme visualmente com a escala antes da cimentação.</p>
</body></html>`;
}
