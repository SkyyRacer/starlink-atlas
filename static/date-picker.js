'use strict';
(function(){
 const $=id=>document.getElementById(id),source=$('date'),entry=$('date-entry'),toggle=$('date-open');
 const locale=navigator.languages?.[0]||navigator.language, pad=n=>String(n).padStart(2,'0');
 const order=new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(2000,10,22)).filter(p=>['year','month','day'].includes(p.type)).map(p=>p.type);
 const display=d=>new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes());
 entry.placeholder=order.map(k=>({year:'AAAA',month:'MM',day:'JJ'})[k]).join('/')+' HH:mm';
 entry.title='Date et heure locales · '+AtlasTime.environment().timeZone;
 const panel=document.createElement('section');panel.id='date-popover';panel.className='date-popover';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Choisir la date et l’heure');toggle.setAttribute('aria-controls',panel.id);
 panel.innerHTML='<header><button type="button" data-prev aria-label="Mois précédent">‹</button><select class="month-select" aria-label="Mois"></select><select class="year-select" aria-label="Année"></select><button type="button" data-next aria-label="Mois suivant">›</button><button type="button" data-close aria-label="Fermer le calendrier">×</button></header><div class="date-week"></div><div class="date-days"></div><div class="date-bottom"><label for="picker-hour">Heure locale</label><input id="picker-hour" type="text" inputmode="numeric" maxlength="5" placeholder="HH:mm" aria-label="Heure et minutes"></div><p class="date-error" role="alert"></p><button type="button" class="date-apply">Appliquer</button><p class="date-zone"></p>';
 document.body.append(panel);
 const month=panel.querySelector('.month-select'),year=panel.querySelector('.year-select'),hour=$('picker-hour'),error=panel.querySelector('.date-error');
 let chosen=new Date(),view=new Date();
 for(let m=0;m<12;m++){const option=new Option(new Intl.DateTimeFormat(locale,{month:'long'}).format(new Date(2020,m,1)),m);month.add(option);}
 for(let y=new Date().getFullYear();y>=1957;y--)year.add(new Option(y,y));
 for(let i=0;i<7;i++){const el=document.createElement('span');el.textContent=new Intl.DateTimeFormat(locale,{weekday:'narrow'}).format(new Date(2024,0,1+i));panel.querySelector('.date-week').append(el);}
 function sync(){if(document.activeElement!==entry&&panel.hidden){const d=new Date(source.value);if(Number.isFinite(+d))entry.value=display(d);}}
 function position(){if(panel.hidden)return;const r=toggle.closest('.date-field').getBoundingClientRect(),w=document.documentElement.clientWidth,h=window.innerHeight;panel.style.left=Math.max(12,Math.min(r.left,w-panel.offsetWidth-12))+'px';const above=r.top-panel.offsetHeight-10;panel.style.top=Math.max(12,above>=12?above:Math.min(r.bottom+10,h-panel.offsetHeight-12))+'px';}
 function render(){month.value=view.getMonth();year.value=view.getFullYear();const grid=panel.querySelector('.date-days');grid.replaceChildren();const start=new Date(view.getFullYear(),view.getMonth(),1);start.setDate(1-(start.getDay()+6)%7);const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 for(let i=0;i<42;i++){const day=new Date(start);day.setDate(start.getDate()+i);const b=document.createElement('button');b.type='button';b.textContent=day.getDate();b.className=(day.getMonth()!==view.getMonth()?'outside ':'')+(+day===+today?'today':'');b.disabled=day>today;b.setAttribute('aria-label',new Intl.DateTimeFormat(locale,{dateStyle:'full'}).format(day));b.setAttribute('aria-pressed',day.toDateString()===chosen.toDateString());b.onclick=()=>{chosen=day;view=new Date(day.getFullYear(),day.getMonth(),1);render();[...grid.children].find(e=>e.getAttribute('aria-pressed')==='true')?.focus();};grid.append(b);}
 panel.querySelector('[data-next]').disabled=view.getFullYear()===now.getFullYear()&&view.getMonth()===now.getMonth();panel.querySelector('[data-prev]').disabled=view.getFullYear()<=1957&&view.getMonth()===0;
 panel.querySelector('.date-zone').textContent=AtlasTime.environment().timeZone+' · '+AtlasTime.zoneLabel(chosen);position();}
 function close(focus=false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();sync();}
 function commit(value){const parsed=AtlasTime.parseInput(value);if(!Number.isFinite(parsed.time)||parsed.time>Date.now()){return false;}source.value=value;source.onchange();return true;}
 function commitEntry(){const nums=entry.value.match(/\d+/g)||[];const parts={};order.forEach((key,i)=>parts[key]=nums[i]);if(nums.length!==5)return false;const value=`${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(nums[3])}:${pad(nums[4])}`;return commit(value);}
 entry.addEventListener('change',()=>{entry.setCustomValidity(commitEntry()?'':'Saisissez une date et une heure valides, jusqu’au présent.');entry.reportValidity();});
 entry.addEventListener('input',()=>entry.setCustomValidity(''));
 entry.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(commitEntry()){entry.setCustomValidity('');entry.blur();sync();}else{entry.setCustomValidity('Saisissez une date et une heure valides, jusqu’au présent.');entry.reportValidity();}}if(e.key==='Escape'){entry.setCustomValidity('');entry.blur();sync();}});
 toggle.onclick=()=>{if(!panel.hidden){close();return;}chosen=new Date(source.value);if(!Number.isFinite(+chosen))chosen=new Date();view=new Date(chosen.getFullYear(),chosen.getMonth(),1);hour.value=pad(chosen.getHours())+':'+pad(chosen.getMinutes());error.textContent='';panel.hidden=false;toggle.setAttribute('aria-expanded','true');render();month.focus();};
 panel.querySelector('[data-close]').onclick=()=>close(true);
 panel.querySelector('[data-prev]').onclick=()=>{view.setMonth(view.getMonth()-1);render();};panel.querySelector('[data-next]').onclick=()=>{view.setMonth(view.getMonth()+1);render();};
 function selectMonth(){view=new Date(Number(year.value),Number(month.value),1);const now=new Date();if(view>now)view=new Date(now.getFullYear(),now.getMonth(),1);render();}month.onchange=year.onchange=selectMonth;
 function apply(){const value=AtlasTime.input(chosen).slice(0,10)+'T'+hour.value;if(!commit(value)){error.textContent='Choisissez une date et une heure valides, jusqu’au présent.';position();return;}entry.setCustomValidity('');close(true);}
 panel.querySelector('.date-apply').onclick=apply;
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(true);}if(e.key==='Enter'&&e.target===hour){e.preventDefault();apply();}if(e.key==='Tab'){const items=[...panel.querySelectorAll('button:not(:disabled),select,input')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))close();});
 window.addEventListener('resize',position);window.addEventListener('scroll',position,true);window.visualViewport?.addEventListener('resize',position);setInterval(sync,250);sync();
})();
