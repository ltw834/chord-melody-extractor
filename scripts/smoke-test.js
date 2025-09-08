// Smoke test: synthesize a sine wave frame and run fallback chroma + simple chord matching

function processFrameSync(audioData, sampleRate, frameSize, hopSize, timestamp) {
  const chroma = new Array(12).fill(0);
  let totalEnergy = 0;
  for (let i = 0; i < audioData.length; i++) {
    totalEnergy += audioData[i] * audioData[i];
  }
  if (totalEnergy > 0.001) {
    const dominantBin = Math.floor((totalEnergy * 1000) % 12);
    chroma[dominantBin] = 0.8;
    chroma[(dominantBin + 4) % 12] = 0.6;
    chroma[(dominantBin + 7) % 12] = 0.4;
  }
  const sum = chroma.reduce((a,b)=>a+b,0);
  const normalized = sum>0 ? chroma.map(v=>v/sum) : chroma;
  return { chroma: normalized, timestamp, confidence: totalEnergy>0.001?0.6:0.1 };
}

function intervalsToChromaTemplate(intervals) {
  const template = new Array(12).fill(0);
  intervals.forEach((interval, index) => {
    const weight = index === 0 ? 1.0 : index === 1 ? 0.8 : index === 2 ? 0.7 : 0.5;
    template[interval % 12] = weight;
  });
  return template;
}

function cosineSimilarity(a,b){
  let dot=0, na=0, nb=0;
  for(let i=0;i<12;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if(na===0||nb===0) return 0; return dot/Math.sqrt(na*nb);
}

function generateChordTemplates(){
  const chords = [
    { name: 'A', intervals: [0,4,7], quality: 'maj' },
    { name: 'C', intervals: [0,4,7], quality: 'maj' },
    { name: 'G', intervals: [0,4,7], quality: 'maj' },
    { name: 'Am', intervals: [0,3,7], quality: 'min' }
  ];
  return chords.map(c=>({ name: c.name, template: intervalsToChromaTemplate(c.intervals) }));
}

function matchChordToChroma(chroma){
  const templates = generateChordTemplates();
  let best = { name: 'N/C', confidence: 0 };
  for(const t of templates){
    let sim = cosineSimilarity(chroma, t.template);
    sim *= 1.0; // no extra emphasis
    if(sim > best.confidence) best = { name: t.name, confidence: Math.min(1, sim) };
  }
  return best;
}

function makeSineFrame(freq, sampleRate, frameSize){
  const arr = new Float32Array(frameSize);
  for(let i=0;i<frameSize;i++){
    arr[i] = Math.sin(2*Math.PI*freq*(i/sampleRate));
  }
  return arr;
}

(async function(){
  const sampleRate = 44100;
  const frameSize = 4096;
  const hopSize = 1024;
  const freq = 440; // A4
  const frame = makeSineFrame(freq, sampleRate, frameSize);
  const result = processFrameSync(frame, sampleRate, frameSize, hopSize, 0);
  console.log('Chroma:', result.chroma.map(v=>v.toFixed(3)).join(' '));
  console.log('Confidence:', result.confidence);
  const match = matchChordToChroma(result.chroma);
  console.log('Matched chord:', match);
})();
