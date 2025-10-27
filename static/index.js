// Handle drag/drop and file selection for two images, preview, and POST to /compare
const el = id => document.getElementById(id)
let fileA = null, fileB = null

function setupDrop(dropId, inputId, thumbId, assignTo){
  const drop = el(dropId)
  const input = drop.querySelector('input')
  const thumb = el(thumbId)

  drop.addEventListener('click',()=> input.click())
  input.addEventListener('change',(e)=> handleFiles(e.target.files, assignTo, thumb))

  ;['dragenter','dragover'].forEach(ev=>{
    drop.addEventListener(ev,(e)=>{e.preventDefault();drop.classList.add('dragover')})
  })
  ;['dragleave','drop'].forEach(ev=>{
    drop.addEventListener(ev,(e)=>{e.preventDefault();drop.classList.remove('dragover')})
  })
  drop.addEventListener('drop',(e)=>{
    const dt = e.dataTransfer
    if(dt && dt.files && dt.files.length) handleFiles(dt.files, assignTo, thumb)
  })
}

function handleFiles(files, assignTo, thumb){
  const f = files[0]
  if(!f) return
  if(!f.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    thumb.innerHTML = `<img src="${reader.result}" />`
    if(assignTo==='A') fileA = f
    else fileB = f
    updateButton()
  }
  reader.readAsDataURL(f)
}

function updateButton(){
  const btn = el('compareBtn')
  btn.disabled = !(fileA && fileB)
}

setupDrop('dropA','fileA','thumbA','A')
setupDrop('dropB','fileB','thumbB','B')

el('fileA').addEventListener('change',(e)=>{})

el('compareBtn').addEventListener('click',async ()=>{
  const spinner = el('spinner')
  spinner.classList.remove('hidden')
  const fd = new FormData()
  fd.append('imageA', fileA)
  fd.append('imageB', fileB)

  try{
    const resp = await fetch('/compare',{method:'POST',body:fd})
    const data = await resp.json()
    // expect backend to respond with an id to view results
    if(data && data.id){
      window.location.href = `/results?id=${encodeURIComponent(data.id)}`
    } else {
      alert('Unexpected response from server')
    }
  }catch(err){
    console.error(err);alert('Upload failed')
  }finally{spinner.classList.add('hidden')}
})
