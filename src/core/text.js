/* ---------- Textwerkzeuge ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function lowerDe(s){ return s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/[̀-ͯ]/g,''); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const pickOne=a=>a[Math.floor(Math.random()*a.length)];

/* Eintrag aus den Muskeldaten zerlegen: "! Hinweis" bzw. "Anteil :: Text" */
function parseItem(s){
  const note=s.startsWith('!'); const body=note?s.slice(1).trim():s;
  const k=body.indexOf(' :: ');
  return {note, label:k>=0?body.slice(0,k):'', text:k>=0?body.slice(k+4):body};
}

/* Kennwörter eines Textes, um ähnliche Antworten zu erkennen.
   Ohne Füllwörter, Zahlen, Zahlwörter und Klammerzusätze. */
const STOPWORDS=new Set(('der die das des dem den ein eine einer eines einem und oder sowie sowohl auch als am an im in ins von vom zur zum zu bei mit bis ueber auf aus nach '
  +'dabei daher gleicher gleiche teilweise gelegentlich jeweils gesamter gesamte muskel alle aller saemtlicher teil entspringen inserieren verlaufen verlaeuft ausnahme '
  +'proc procc lig musculus musculi nervus nervi processus ligamentum ramus rami ihr ihrer seines seiner sich ist wird the').split(' '));
const NUMBER_WORDS=new Set('eins zwei drei vier fuenf sechs sieben acht neun zehn elf zwoelf iii vii viii'.split(' '));
const ORDINALS=/^(erst|zweit|dritt|viert|fuenft|sechst|siebent|siebt|acht|neunt|zehnt|elft|zwoelft)(e|en|er|es|em|n|r|s)?$/;
function keyWords(text){
  const plain=text.replace(/\([^()]*\)/g,' ');
  return new Set(lowerDe(plain).split(/[^a-z0-9]+/)
    .filter(t=>t.length>=3&&!/\d/.test(t)&&!STOPWORDS.has(t)&&!NUMBER_WORDS.has(t)&&!ORDINALS.test(t)));
}
