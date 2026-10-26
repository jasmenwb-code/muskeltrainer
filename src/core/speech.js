/* ---------- Vorlesen (Einstellung „Fragen vorlesen“) ---------- */
const synth=window.speechSynthesis||null;
let deVoice=null, autoRead=false;
function pickVoice(){ if(!synth) return; const v=synth.getVoices(); deVoice=v.find(x=>/^de(-|_)DE/i.test(x.lang))||v.find(x=>/^de/i.test(x.lang))||null; }
if(synth){ pickVoice(); synth.onvoiceschanged=pickVoice; }

/* Abkürzungen ausschreiben, damit die Sprachausgabe sie richtig ausspricht */
function ttsText(s){
  return s.replace(/^!\s*/,'').replace(/\bMm\./g,'Musculi').replace(/\bM\./g,'Musculus').replace(/\bNn\./g,'Nervi').replace(/\bN\./g,'Nervus')
   .replace(/\bProcc\./g,'Processus').replace(/\bProc\./g,'Processus').replace(/\bLig\./g,'Ligamentum').replace(/\bRr\./g,'Rami').replace(/\bR\./g,'Ramus')
   .replace(/\bn\. radialis/g,'nervi radialis').replace(/\bu\./g,'und').replace(/HWS/g,'Halswirbelsäule').replace(/BWS/g,'Brustwirbelsäule').replace(/LWS/g,'Lendenwirbelsäule')
   .replace(/\bTh(\d)/g,'T $1').replace(/\b([CLS])(\d)/g,'$1 $2').replace(/–/g,' bis ').replace(/ :: /g,': ').replace(/[„“]/g,'');
}
function speak(text){
  if(!synth) return;
  try{ synth.cancel(); const u=new SpeechSynthesisUtterance(ttsText(text)); u.lang='de-DE'; if(deVoice) u.voice=deVoice; u.rate=0.95; synth.speak(u); }catch(e){}
}
function stopSpeaking(){ if(synth) synth.cancel(); }
