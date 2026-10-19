/* The same sidebar becomes a dismissible panel on small screens. No saved state. */
(()=>{
  const small=matchMedia('(max-width: 900px)'),panel=document.getElementById('satellite-panel'),
    toggle=document.getElementById('mobile-menu'),close=document.getElementById('mobile-close'),
    backdrop=document.getElementById('mobile-backdrop'),view=document.querySelector('.view');
  function setOpen(open,restoreFocus=true){
    open=small.matches&&open;
    document.body.classList.toggle('filters-open',open);
    toggle.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;
    panel.inert=small.matches&&!open;view.inert=open;
    if(open){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');close.focus();}
    else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(restoreFocus&&small.matches)toggle.focus({preventScroll:true});}
  }
  toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
  document.getElementById('collection-select').addEventListener('change',()=>{if(small.matches)setOpen(false);});
  close.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));
  document.getElementById('results').addEventListener('click',e=>{if(e.target.closest('.satellite-result')&&small.matches)setOpen(false);});
  document.getElementById('search').addEventListener('keydown',e=>{
    // Run after the existing Enter handler has selected a matching result.
    if(e.key==='Enter'&&small.matches)queueMicrotask(()=>{if(document.querySelector('#results .satellite-result')&&!document.getElementById('detail').hidden&&document.getElementById('search-alternative').hidden)setOpen(false);});
  });
  document.addEventListener('keydown',e=>{
    if(document.getElementById('iss-mission-dialog')?.open)return;
    if(!document.body.classList.contains('filters-open'))return;
    if(e.key==='Escape'){e.preventDefault();setOpen(false);}
    if(e.key==='Tab'){
      const items=[...panel.querySelectorAll('button:not(:disabled),input,select,summary,a[href]')].filter(el=>el.getClientRects().length);
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  const compactCard=matchMedia('(max-width: 1400px), (max-height: 850px)');
  compactCard.addEventListener('change',e=>{
    if(!e.matches)return;
    const card=document.getElementById('detail'),button=document.getElementById('detail-toggle');
    card.dataset.expanded='false';
    if(button){button.setAttribute('aria-expanded','false');button.textContent='Afficher les informations';}
  });
  small.addEventListener('change',()=>setOpen(false,false));setOpen(false,false);
})();
