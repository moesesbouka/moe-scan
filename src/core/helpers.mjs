import { $, esc, S, B } from './context.mjs';

export const FB_COND={'New':'New','Used – Like New':'Used - Like New','Used – Good':'Used - Good','Used – Fair':'Used - Fair','For Parts / Not Working':'For Parts or Not Working'};

export function setStatus(id,msg,k=''){const el=$(id);if(!el)return;el.className='status'+(k?' '+k:'');el.textContent=msg||'';}

export function isUPC(v){return /^\d{8,14}$/.test(String(v||'').trim());}

export function applyDisc(p){const n=parseFloat(p);if(!isFinite(n)||n<=0)return '';const d=parseFloat(S.settings.discount);return(isFinite(d)&&d>0)?(n*(1-d/100)).toFixed(2):n.toFixed(2);}

export function checkDigitOK(code){
  const c=String(code||'').trim();
  if(!/^\d{8,14}$/.test(c))return false;
  let sum=0,odd=true;
  for(let i=c.length-2;i>=0;i--){
    const d=Number(c[i]);
    sum+=odd?d*3:d; odd=!odd;
  }
  return((10-(sum%10))%10)===Number(c[c.length-1]);
}

export function isValidProductCode(code){
  if(!code||typeof code!=='string')return false;
  const c=code.trim();
  // Pure digit UPC/EAN — run check-digit math for standard lengths
  if(/^\d{8,14}$/.test(c)){
    if([8,12,13,14].includes(c.length))return checkDigitOK(c);
    return true;
  }
  // Model numbers: 7+ chars, 3+ digits minimum
  if(/^[A-Z0-9][A-Z0-9\-\/]{5,24}$/i.test(c)){
    if((c.match(/\d/g)||[]).length>=3)return true;
  }
  return false;
}

export function cleanOcrText(raw){
  return String(raw||'').replace(/[\u2010-\u2015]/g,'-').replace(/[^A-Za-z0-9\-\s]/g,' ').replace(/\s+/g,' ').trim();
}

export function extractBestIdentifier(raw){
  const txt=cleanOcrText(raw);

  // ── Strategy 0: collapse space-separated digit groups into one run ─────────
  // OCR often reads "600 603 253 713" or "6006 0325 3713" — join them first
  const collapsed=txt.replace(/(\d[\d\s]{6,16}\d)/g,m=>m.replace(/\s/g,''));
  const collapsedDigits=[...collapsed.matchAll(/\d{8,14}/g)].map(m=>m[0]);
  if(collapsedDigits.length){ collapsedDigits.sort((a,b)=>b.length-a.length); return collapsedDigits[0]; }

  // ── Strategy 1: contiguous 8-14 digit run ──────────────────────────────────
  const digits=[...txt.matchAll(/\b\d{8,14}\b/g)].map(m=>m[0]);
  if(digits.length){ digits.sort((a,b)=>b.length-a.length); return digits[0]; }

  // ── Strategy 2: partial UPC 6-7 digits ────────────────────────────────────
  const partialDigits=[...txt.matchAll(/\b\d{6,7}\b/g)].map(m=>m[0]);
  if(partialDigits.length){ partialDigits.sort((a,b)=>b.length-a.length); return partialDigits[0]; }

  // ── Strategy 3: model numbers with hyphens e.g. WH-1000XM5 ────────────────
  const models=[...txt.matchAll(/\b[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+\b/gi)].map(m=>m[0]);
  if(models.length) return models[0];

  // ── Strategy 4: compact alphanumeric tokens ≥5 chars ──────────────────────
  const compact=txt.split(' ').filter(w=>/[A-Z]/i.test(w)&&/\d/.test(w)&&w.length>=5);
  if(compact.length) return compact[0];

  // ── Strategy 5: any digit run ≥4 ──────────────────────────────────────────
  const anyDigits=[...collapsed.matchAll(/\d{4,}/g)].map(m=>m[0]);
  if(anyDigits.length){ anyDigits.sort((a,b)=>b.length-a.length); return anyDigits[0]; }
  return '';
}

export function getFBMode(){
  const m=S.settings.fbMode||'auto';
  if(m!=='auto')return m;
  // Auto-detect: mobile UA or narrow screen → mobile handoff, otherwise desktop extension
  const isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||window.innerWidth<900;
  return isMobile?'mobile':'extension';
}

export function buildListingText(s){
  const city=S.settings.city||'Buffalo, NY';const store=S.settings.storeName||'CrazyMoe';
  const cond=FB_COND[s?.condition]||s?.condition||'Used – Good';
  const lines=[s?.title||''];
  if(s?.brand)lines.push(`Brand: ${s.brand}`);if(s?.model)lines.push(`Model: ${s.model}`);
  if(s?.upc)lines.push(`UPC: ${s.upc}`);
  lines.push(`Condition: ${cond}`);lines.push(`Price: $${s?.price||'0'}`);
  if(s?.description)lines.push('',s.description);
  lines.push('',`📦 More warehouse deals — search ${store} on Facebook Marketplace`);
  lines.push(`🚚 Local pickup · ${city}`);
  return lines.join('\n').trim();
}

export function buildFBPayload(sel,photos){return{title:sel?.title||'',price:sel?.price||'',condition:FB_COND[sel?.condition]||sel?.condition||'Used - Good',description:buildListingText(sel),upc:sel?.upc||'',brand:sel?.brand||'',model:sel?.model||'',photos:(photos||[]).slice(0,6),timestamp:Date.now()};}

export function parseBulkInput(raw){return raw.split(/[\n,;|\t]+/).map(s=>s.trim()).filter(s=>s.length>=3).slice(0,50);}

export function filterDashItems(items){
  const q=(S.dashSearch||'').toLowerCase().trim();
  if(!q)return items;
  return items.filter(d=>[d.title,d.upc,d.condition,d.brand,d.product_brand,d.source].some(v=>(v||'').toLowerCase().includes(q)));
}

export function statusLabel(s){return{queued:'⏳ Queued',processing:'🔄 Looking up',found:'⚡ Found',
  'no-match':'❌ No match',manual:'📝 Manual needed',ready:'✅ Ready',
  saved:'💾 Saved',launched:'📤 Launched to FB',posted:'📘 Posted'}[s]||s;}
