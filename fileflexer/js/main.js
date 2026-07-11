document.addEventListener('DOMContentLoaded', ()=>{
  const items = document.querySelectorAll('.tool-card, [data-animate]');
  if(!items.length) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        en.target.classList.add('in-view');
        io.unobserve(en.target);
      }
    });
  }, { threshold:.15, rootMargin:'0px 0px -40px 0px' });
  items.forEach((el,i)=>{ el.style.transitionDelay = (i%6)*45+'ms'; io.observe(el); });
});
