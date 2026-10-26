/* Shared by Earth, station, distant-mission and Moon documents. */
(()=>{
 const play=document.getElementById('play');if(!play)return;
 play.setAttribute('aria-keyshortcuts','Space');play.title='Lecture / pause · Espace';
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(event.code!=='Space'&&event.key!==' ')return;
  if(event.target?.closest?.('input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog[open]'))return;
  if(play.disabled||document.querySelector('dialog[open]'))return;
  event.preventDefault();play.click();
 });
})();
