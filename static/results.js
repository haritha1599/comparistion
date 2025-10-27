// Fetch results JSON from server and render
const qs = (k)=> new URLSearchParams(location.search).get(k)
const id = qs('id')
const el = id => document.getElementById(id)

async function loadResults(){
  if(!id) return
  try{
    const res = await fetch(`/results?id=${encodeURIComponent(id)}`)
    const data = await res.json()
    render(data)
  }catch(e){
    console.error(e)
  }
}

function render(data){
  el('resA').src = `data:image/png;base64,${data.imageA}`
  el('resB').src = `data:image/png;base64,${data.imageB}`
  el('scoreText').textContent = data.score.toFixed(2)
  const labelText = el('labelText')
  const card = el('resultCard')
  if(data.label===1){
    labelText.textContent = 'Images are similar'
    card.classList.add('glow-green')
    runConfetti()
  } else {
    labelText.textContent = 'Images are dissimilar'
    card.classList.add('glow-red')
    card.classList.add('shake')
  }

  const features = el('features')
  features.innerHTML = ''
  for(const side of ['A','B']){
    const f = data['features'+side]
    const container = document.createElement('div')
    container.className = 'feature'
    container.innerHTML = `<h3>Image ${side}</h3>
      <p><strong>Mean RGB:</strong> ${f.mean_rgb.map(v=>v.toFixed(1)).join(', ')}</p>
      <p><strong>Colorfulness:</strong> ${f.colorfulness.toFixed(2)}</p>
      <p><strong>ORB keypoints:</strong> ${f.orb_count}</p>
      <p><strong>pHash:</strong> ${f.phash}</p>
      <p><strong>Grayscale histogram:</strong> ${f.hist.join(', ')}</p>`
    features.appendChild(container)
  }

  // animate features in
  Array.from(features.children).forEach((c,i)=> setTimeout(()=> c.classList.add('show'), i*180))
}

// Tiny confetti: simple colored rectangles
function runConfetti(){
  const canvas = el('confetti-canvas')
  if(!canvas) return
  canvas.width = innerWidth; canvas.height = innerHeight
  const ctx = canvas.getContext('2d')
  const pieces = []
  for(let i=0;i<120;i++) pieces.push({x:Math.random()*canvas.width,y:-Math.random()*canvas.height,w:6+Math.random()*8,h:8+Math.random()*12,vy:2+Math.random()*6,rot:Math.random()*360,color:`hsl(${Math.random()*60+120},80%,60%)`})
  let t=0
  function frame(){
    t++
    ctx.clearRect(0,0,canvas.width,canvas.height)
    for(const p of pieces){
      p.y += p.vy; p.x += Math.sin((p.y+p.x)/20)
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore()
      if(p.y>canvas.height+50) p.y = -20
    }
    if(t<260) requestAnimationFrame(frame)
    else ctx.clearRect(0,0,canvas.width,canvas.height)
  }
  frame()
}

loadResults()
