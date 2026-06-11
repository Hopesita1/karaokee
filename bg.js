// ── Fondo animado compartido (partículas + orbes + constelación) ──
export function initBg(canvasId){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#4a7c3f','#d4a843','#97C459','#c4501a','#6aaa5f'];
  const particles = Array.from({length:55}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.6 + 0.3,
    vy: -(Math.random() * 0.35 + 0.05),
    vx: (Math.random() - 0.5) * 0.15,
    opacity: Math.random() * 0.4 + 0.05,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.03 + 0.01
  }));

  const orbs = [
    {x:0.15, y:0.3,  r:180, color:'#1a3a12', speed:0.0004},
    {x:0.85, y:0.6,  r:220, color:'#2a2008', speed:0.0003},
    {x:0.5,  y:0.85, r:160, color:'#1a2a10', speed:0.0005}
  ];
  let orbT = 0;

  function draw(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    orbT += 0.01;

    orbs.forEach((o, i) => {
      const px = (o.x + Math.sin(orbT * o.speed * 1000 + i) * 0.06) * canvas.width;
      const py = (o.y + Math.cos(orbT * o.speed * 1000 + i) * 0.04) * canvas.height;
      const g  = ctx.createRadialGradient(px, py, 0, px, py, o.r);
      g.addColorStop(0, o.color + 'cc');
      g.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(px, py, o.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    });

    particles.forEach(p => {
      p.twinkle += p.twinkleSpeed;
      const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.twinkle));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
      p.y += p.vy; p.x += p.vx;
      if(p.y < -5){ p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
      if(p.x < -5 || p.x > canvas.width + 5){ p.x = Math.random() * canvas.width; }
    });

    for(let i = 0; i < particles.length; i++){
      for(let j = i + 1; j < particles.length; j++){
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < 90){
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = '#4a7c3f';
          ctx.globalAlpha = (1 - dist / 90) * 0.08;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}
