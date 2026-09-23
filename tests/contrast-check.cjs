module.exports = () => {
    const rgb=s=>s.match(/[\d.]+/g)?.map(Number);
    const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
    const failures=[];
    for(const e of document.querySelectorAll('body *')){
     if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) || !e.checkVisibility() || e.matches(':disabled'))continue;
     const cs=getComputedStyle(e); if(Number(cs.opacity)<1)continue;
     let background=[255,255,255],layers=[],skip=false;
     for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a);if(s.backgroundImage!=='none'||Number(s.opacity)<1){skip=true;break;}layers.push(rgb(s.backgroundColor));}
     if(skip)continue;
     for(const color of layers.reverse()){if(!color)continue;const alpha=color[3]??1;background=background.map((v,i)=>color[i]*alpha+v*(1-alpha));}
     const fg=rgb(cs.color);if(!fg)continue;const alpha=fg[3]??1;
     const actual=fg.slice(0,3).map((v,i)=>v*alpha+background[i]*(1-alpha));
     const a=luminance(actual),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     const large=parseFloat(cs.fontSize)>=24 || (parseFloat(cs.fontSize)>=18.66 && parseInt(cs.fontWeight)>=700);
     if(ratio<(large?3:4.5)-.02)failures.push({selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'),text:e.textContent.trim().slice(0,55),ratio:+ratio.toFixed(2),fg:cs.color,bg:background,font:cs.fontSize});
    }
    return failures;
};
