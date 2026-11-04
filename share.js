// 検査ごとの共有リンク（グループLINEなどに貼り、業者がその検査へ直接入れる）
// 依存：画面側の sget / esc / toast / $ （common.js または admin.html のもの）
const MERGE_T = "社内検査まとめ";   // partner.html 側と同じ名前（同じ物件の社内検査を1画面にまとめる）
function shareUrl(prop, type, area){
  const q = new URLSearchParams({p: prop, t: type});
  if(area) q.set("a", area);   // 初めて開く端末でも、エリアの選択なしで入れる
  return new URL("partner.html", location.href).href.split("#")[0] + "#" + q.toString();
}
async function shareCopy(text){
  try{ await navigator.clipboard.writeText(text); return true; }catch(e){}
  try{
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  }catch(e){ return false; }
}
async function openShare(prop, type){
  document.getElementById("shsheet")?.remove();
  const ov = document.createElement("div"); ov.id = "shsheet";
  ov.innerHTML = `<div class="shbox"><div class="info">共有の準備中…</div></div>`;
  document.body.appendChild(ov);
  ov.onclick = e => { if(e.target === ov) ov.remove(); };
  try{
    const [ins, props] = await Promise.all([
      sget("inspections", "select=*&is_deleted=eq.false"),
      sget("properties", "select=*&is_deleted=eq.false")]);
    const mine = ins.filter(i => i.property_name === prop && i.inspection_type === type);
    const pr = props.find(p => p.property_name === prop) || {};
    const ids = mine.map(i => i.inspection_id);
    let wait = 0;
    for(let k = 0; k < ids.length; k += 50){
      const rs = await sget("inspection_records", `inspection_id=in.(${ids.slice(k, k + 50).join(",")})&progress_status=eq.是正待ち&select=record_id`);
      wait += rs.length;
    }
    const insp = [...new Set(mine.map(i => i.inspector).filter(Boolean))].join("・");
    // 同じ物件の社内検査（設計・建設・マーケ・不動産）の「是正待ち」をまとめて共有するための情報
    let mergeText = "", mergeUrl = "";
    if(SHANAI.includes(type)){
      const sIns = ins.filter(i => i.property_name === prop && SHANAI.includes(i.inspection_type));
      const types = [...new Set(sIns.map(i => i.inspection_type))];
      if(types.length >= 2){
        let mw = 0; const sid = sIns.map(i => i.inspection_id);
        for(let k = 0; k < sid.length; k += 50){
          const rs = await sget("inspection_records", `inspection_id=in.(${sid.slice(k, k + 50).join(",")})&progress_status=eq.是正待ち&select=record_id`);
          mw += rs.length;
        }
        mergeUrl = shareUrl(prop, MERGE_T, pr.area);
        const ml = [`【是正依頼（まとめ）】${prop}／社内検査`, `是正待ち：${mw}件（部屋ごとに、全検査をまとめて是正できます）`];
        if(pr.handover_date) ml.push(`引渡し日：${pr.handover_date}`);
        ml.push(mergeUrl);
        mergeText = ml.join("\n");
      }
    }
    const url = shareUrl(prop, type, pr.area);
    const lines = [`【是正依頼】${prop}／${type}`, `是正待ち：${wait}件`];
    if(pr.handover_date) lines.push(`引渡し日：${pr.handover_date}`);
    if(insp) lines.push(`検査員：${insp}`);
    lines.push(url);
    const text = lines.join("\n");
    ov.innerHTML = `<div class="shbox"><h3 style="margin:0 0 8px">この検査を共有</h3>
      <pre class="shtext">${esc(text)}</pre>
      ${wait ? "" : `<div class="info warn">いま「是正待ち」の指摘は0件です。承認前の指摘は、業者の画面に出ません。</div>`}
      <button class="btn btn-primary" id="sh_share"><i class="i i-share"></i> LINEなどで共有する</button>
      ${mergeText ? `<button class="btn btn-amber row" id="sh_merge"><i class="i i-share"></i> 社内検査をまとめて共有（部屋ごとに一括是正）</button>` : ""}
      <div class="btns row"><button class="btn btn-sub" id="sh_url"><i class="i i-link"></i> URLだけコピー</button><button class="btn btn-sub" id="sh_txt"><i class="i i-copy"></i> 文面をコピー</button></div>
      <button class="btn btn-sub row" id="sh_close">閉じる</button></div>`;
    document.getElementById("sh_close").onclick = () => ov.remove();
    document.getElementById("sh_url").onclick = async () => toast(await shareCopy(url) ? "URLをコピーしました" : "コピーできませんでした", true);
    document.getElementById("sh_txt").onclick = async () => toast(await shareCopy(text) ? "文面をコピーしました" : "コピーできませんでした", true);
    document.getElementById("sh_merge")?.addEventListener("click", async () => {
      if(navigator.share){ try{ await navigator.share({text: mergeText}); }catch(e){} }
      else toast(await shareCopy(mergeText) ? "まとめ用の文面をコピーしました。LINEに貼り付けてください" : "コピーできませんでした", true);
    });
    document.getElementById("sh_share").onclick = async () => {
      if(navigator.share){
        try{ await navigator.share({text}); }catch(e){ /* 共有画面を閉じただけ */ }
      }else{
        toast(await shareCopy(text) ? "文面をコピーしました。LINEに貼り付けてください" : "コピーできませんでした", true);
      }
    };
  }catch(e){
    ov.innerHTML = `<div class="shbox"><div class="err">共有の準備に失敗しました。もう一度お試しください。</div><button class="btn btn-sub" id="sh_close">閉じる</button></div>`;
    document.getElementById("sh_close").onclick = () => ov.remove();
  }
}
