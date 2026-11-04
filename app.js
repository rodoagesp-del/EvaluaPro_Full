// NUEVO LINK ASIGNADO
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwZc3mIbD6Q83gohbWp-uTE3jjZVGLSAPqBErfFNn-sMWLi4EwsFg43Kki5WfXfJpFuEw/exec';

let currentStudentName = '', currentRoomCode = '', currentExamData = [];
let timeRemaining = 0, timerInterval;
let myLastPuntaje = 0, myLastRespuestas = {};

// ===== ESTADO DEL JUEGO (PARA PENALIZACIONES) =====
let gameState = {
  penalidadTrampa: 0
};

// ===== SISTEMA DE TEMÁTICAS ESTACIONALES =====
function applySeasonalTheme() {
  const month = new Date().getMonth() + 1;
  const body = document.body;
  const title = document.getElementById('app-title');
  
  body.className = '';
  if (month === 10) {
    body.classList.add('theme-halloween');
    title.innerText = "🎃 EvaluaPro Halloween 🦇";
  } else if (month === 12) {
    body.classList.add('theme-christmas');
    title.innerText = "🎄 EvaluaPro Navideño ❄️";
  } else if (month >= 9 && month <= 11) {
    body.classList.add('theme-spring');
    title.innerText = "🌻 EvaluaPro Primavera 🦋";
  } else {
    body.classList.add('theme-default');
    title.innerText = "Plataforma de Evaluación";
  }
}

// ===== UTILIDADES =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');
}
function showLoader(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; }

async function postData(payload) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (error) {
    alert("Error de conexión con el servidor.");
    showLoader(false);
  }
}

// ===== MÓDULO DE RESILIENCIA (AUTOGUARDADO Y RECUPERACIÓN) =====
function saveExamProgress() {
  if (!isExamActive) return;
  const state = {
    room: currentRoomCode, name: currentStudentName, exam: currentExamData,
    index: currentQuestionIndex, resp: temporalRespuestas, time: timeRemaining,
    cheatW: cheatWarnings, penality: gameState.penalidadTrampa
  };
  localStorage.setItem('evalua_progress', JSON.stringify(state));
}

function checkSavedProgress() {
  const saved = localStorage.getItem('evalua_progress');
  if (saved) {
    if (confirm("Se detectó un examen inconcluso. ¿Deseas recuperarlo?")) {
       const s = JSON.parse(saved);
       currentRoomCode = s.room; currentStudentName = s.name; currentExamData = s.exam;
       currentQuestionIndex = s.index; temporalRespuestas = s.resp; timeRemaining = s.time;
       cheatWarnings = s.cheatW; gameState.penalidadTrampa = s.penality;
       isExamActive = true; totalQuestions = currentExamData.length;
       document.getElementById('display-student').innerText = currentStudentName;
       showView('view-exam');
       renderCurrentQuestion(true);
    } else {
       localStorage.removeItem('evalua_progress');
    }
  }
}

// ===== DOCENTE =====
function loginTeacher() {
  const pass = document.getElementById('teacher-pass').value;
  if (pass === 'T47P16I') {
    document.getElementById('teacher-pass').value = '';
    renderQuestionsForm();
    showView('view-teacher-dashboard');
  } else alert('Contraseña incorrecta');
}

// ===== MÓDULO DOCENTE: CREACIÓN DINÁMICA =====
let totalQuestionsCreated = 0;

function renderQuestionsForm() {
  const container = document.getElementById('questions-container');
  container.innerHTML = `<div id="q-list"></div><button onclick="addQuestionBlock()" class="btn secondary" style="background:#27ae60; color:white; margin-top:10px;">+ Añadir Pregunta</button>`;
  totalQuestionsCreated = 0;
  addQuestionBlock();
}

function addQuestionBlock() {
  totalQuestionsCreated++;
  const i = totalQuestionsCreated;
  const qList = document.getElementById('q-list');
  
  const blockDiv = document.createElement('div');
  blockDiv.className = 'q-block';
  blockDiv.id = `block-q${i}`;
  blockDiv.innerHTML = `
    <h4 style="display: flex; justify-content: space-between; align-items: center;">
      Pregunta ${i}
      <button onclick="removeQuestionBlock(${i})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">✕ Eliminar</button>
    </h4>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <input type="number" id="q${i}-pts" placeholder="Puntaje (ej: 4)" required step="0.1" min="0">
      <input type="number" id="q${i}-time" placeholder="Tiempo (Segundos)" required min="10" value="60">
    </div>
    <select id="q${i}-type" onchange="toggleQuestionType(${i})" class="mb-2 w-full p-2 border rounded font-bold text-indigo-700 bg-indigo-50">
      <option value="multiple">Opción Múltiple</option>
      <option value="match">Entrelazar Conceptos (Relacionar)</option>
      <option value="text">Respuesta Abierta (Texto)</option>
    </select>
    <textarea id="q${i}-text" rows="2" class="w-full p-2 border rounded mb-2" placeholder="Enunciado de la Pregunta" required></textarea>
    
    <!-- Opciones para Opción Múltiple -->
    <div id="q${i}-multiple-options">
       <div id="q${i}-opt-list">
          <input type="text" class="q${i}-opt-input w-full p-2 border rounded mb-1" placeholder="Opción 1" required>
          <input type="text" class="q${i}-opt-input w-full p-2 border rounded mb-1" placeholder="Opción 2" required>
       </div>
       <button onclick="addOptionToQ(${i})" class="btn secondary mb-2 text-sm" style="background:#3498db; color:white; padding: 5px 10px;">+ Añadir Opción</button>
       <input type="text" id="q${i}-correct" class="w-full p-2 border rounded" placeholder="Texto exacto de la opción correcta" required>
    </div>
    
    <!-- Contenedor dinámico Match -->
    <div id="q${i}-match-options" class="hidden bg-indigo-50 p-3 rounded border border-indigo-200 mb-2">
       <p class="text-sm font-bold text-indigo-800 mb-2">Agrega pares (Concepto - Definición):</p>
       <div id="q${i}-match-list">
          <div class="flex gap-2 mb-1">
            <input type="text" class="q${i}-m-c w-1/2 p-1 border rounded" placeholder="Concepto 1">
            <input type="text" class="q${i}-m-d w-1/2 p-1 border rounded" placeholder="Definición a">
          </div>
          <div class="flex gap-2 mb-1">
            <input type="text" class="q${i}-m-c w-1/2 p-1 border rounded" placeholder="Concepto 2">
            <input type="text" class="q${i}-m-d w-1/2 p-1 border rounded" placeholder="Definición b">
          </div>
       </div>
       <button onclick="addMatchToQ(${i})" class="btn secondary text-sm mt-2" style="background:#3498db; color:white; padding: 5px 10px;">+ Añadir Par</button>
       <p class="text-xs text-gray-600 mt-2 italic">La evaluación será proporcional según los aciertos.</p>
    </div>

    <!-- Mensaje para Respuesta Abierta -->
    <div id="q${i}-text-options" class="hidden">
      <p class="text-sm text-gray-600 italic mb-2">El alumno responderá con un cuadro de texto. Esta pregunta debe ser revisada manualmente por el docente en el PDF.</p>
    </div>
  `;
  
  qList.appendChild(blockDiv);
}

function removeQuestionBlock(index) {
  const block = document.getElementById(`block-q${index}`);
  if (block) {
    block.remove();
  }
}

function addOptionToQ(index) {
  const optList = document.getElementById(`q${index}-opt-list`);
  const count = optList.querySelectorAll('input').length + 1;
  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = `q${index}-opt-input w-full p-2 border rounded mb-1`;
  newInput.placeholder = `Opción ${count}`;
  newInput.required = true;
  optList.appendChild(newInput);
}

function addMatchToQ(index) {
  const matchList = document.getElementById(`q${index}-match-list`);
  const count = matchList.querySelectorAll('.flex').length + 1;
  const letras = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const letra = letras[count - 1] || count;
  
  const newDiv = document.createElement('div');
  newDiv.className = 'flex gap-2 mb-1';
  newDiv.innerHTML = `
    <input type="text" class="q${index}-m-c w-1/2 p-1 border rounded" placeholder="Concepto ${count}">
    <input type="text" class="q${index}-m-d w-1/2 p-1 border rounded" placeholder="Definición ${letra}">
  `;
  matchList.appendChild(newDiv);
}

function toggleQuestionType(index) {
  const type = document.getElementById(`q${index}-type`).value;
  const multipleDiv = document.getElementById(`q${index}-multiple-options`);
  const textDiv = document.getElementById(`q${index}-text-options`);
  const matchDiv = document.getElementById(`q${index}-match-options`);
  
  multipleDiv.classList.add('hidden');
  textDiv.classList.add('hidden');
  matchDiv.classList.add('hidden');
  
  document.getElementById(`q${index}-correct`)?.removeAttribute('required');

  if (type === 'multiple') {
    multipleDiv.classList.remove('hidden');
    document.getElementById(`q${index}-correct`)?.setAttribute('required', 'true');
  } else if (type === 'text') {
    textDiv.classList.remove('hidden');
  } else if (type === 'match') {
    matchDiv.classList.remove('hidden');
  }
}

// ===== ENVÍO DEL EXAMEN (DOCENTE) =====
async function submitExamCreation() {
  const code = document.getElementById('exam-code').value.trim();
  if (!code) return alert("Ingresa un código de sala.");
  
  let preguntas = [];

  for (let i = 1; i <= totalQuestionsCreated; i++) {
    const block = document.getElementById(`block-q${i}`);
    if (!block) continue; // Si fue eliminada, saltar
    
    const tipo = document.getElementById(`q${i}-type`).value;
    const texto = document.getElementById(`q${i}-text`).value;
    const puntaje = parseFloat(document.getElementById(`q${i}-pts`).value) || 0;
    const tiempo = parseInt(document.getElementById(`q${i}-time`).value) || 60;
    
    if (!texto) continue; // Si no hay texto, saltar
    
    let obj = { id: preguntas.length + 1, tipo, texto, puntaje, tiempo, opciones: {} };

    if (tipo === 'multiple') {
      const inputs = document.querySelectorAll(`.q${i}-opt-input`);
      let optDict = {};
      inputs.forEach((inp, idx) => { 
        if (inp.value.trim()) optDict[`Opcion_${idx+1}`] = inp.value.trim(); 
      });
      obj.opciones = optDict;
      obj.correcta = document.getElementById(`q${i}-correct`).value.trim();
    } else if (tipo === 'match') {
      const conceptos = Array.from(document.querySelectorAll(`.q${i}-m-c`)).map(e => e.value.trim()).filter(Boolean);
      const definiciones = Array.from(document.querySelectorAll(`.q${i}-m-d`)).map(e => e.value.trim()).filter(Boolean);
      obj.opciones = { conceptos, definiciones };
      // La clave correcta es la correspondencia: concepto 1 -> definición a, etc.
      // Guardamos los índices para evaluar proporcionalmente
      obj.correcta = "MATCH_PROPORCIONAL";
    } else {
      obj.opciones = null;
      obj.correcta = "MANUAL";
    }
    preguntas.push(obj);
  }

  if (preguntas.length === 0) {
    return alert("Debes crear al menos una pregunta válida.");
  }

  showLoader(true);
  const res = await postData({ action: 'crear_examen', codigoSala: code, minutos: 0, preguntas });
  showLoader(false);
  if (res && res.status === 'success') { 
    alert(`Sala ${code} lista con ${preguntas.length} preguntas.`); 
  }
}

async function downloadTeacherReport() {
  const code = document.getElementById('report-code').value.trim();
  if(!code) return alert("Ingresa un código de sala.");

  showLoader(true);
  const res = await postData({ action: 'obtener_resultados', codigoSala: code });
  showLoader(false);

  if (res && res.status === 'success' && res.resultados.length > 0) {
    generarPDFDocente(code, res.resultados, res.examen);
  } else {
    alert("No hay resultados o la sala no existe.");
  }
}

// ===== GENERACIÓN DE PDF CALIFICADO =====
function generarPDFDocente(codigoSala, resultados, examen) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  if (!resultados || resultados.length === 0) {
      alert("No hay resultados de alumnos para esta sala.");
      return;
  }

  resultados.forEach((res, index) => {
    if (index > 0) doc.addPage(); 

    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.setFont("helvetica", "bold");
    doc.text("Evaluación Escrita Calificada", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(`Alumno: ${res.alumno || 'Desconocido'}`, 20, 35);
    doc.text(`Código de Sala: ${codigoSala}`, 20, 42);
    
    doc.setFontSize(16);
    doc.setTextColor(192, 57, 43); 
    doc.setFont("helvetica", "bold");
    doc.text(`NOTA FINAL: ${res.puntaje || 0} / 20`, 130, 38);
    
    doc.setDrawColor(200);
    doc.line(20, 48, 190, 48);

    let y = 60; 
    
    examen.forEach((q, qIndex) => {
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      
      const preguntaTexto = q.texto ? q.texto : "Pregunta no encontrada";
      const splitQuestion = doc.splitTextToSize(`${qIndex + 1}. ${preguntaTexto}`, 170);
      doc.text(splitQuestion, 20, y);
      y += (splitQuestion.length * 6);
      
      doc.setFont("helvetica", "normal");
      const respAlumno = res.respuestas ? res.respuestas[q.id] : "Sin responder";
      
      if (q.tipo === 'multiple' || !q.tipo) {
          const esCorrecto = (respAlumno === q.correcta);
          
          if (respAlumno && respAlumno.startsWith("ANULADA")) {
              doc.setTextColor(192, 57, 43);
              const splitAnulada = doc.splitTextToSize(`Respuesta: ${respAlumno}`, 165);
              doc.text(splitAnulada, 25, y);
              y += (splitAnulada.length * 6) + 4;
          } else if (esCorrecto) {
            doc.setTextColor(39, 174, 96);
            doc.text(`Respuesta del alumno: ${respAlumno}   ( ✓ Correcto )`, 25, y);
            y += 8;
          } else {
            doc.setTextColor(192, 57, 43);
            doc.text(`Respuesta del alumno: ${respAlumno || 'Sin responder'}   ( X Incorrecto )`, 25, y);
            y += 6;
            doc.setTextColor(0, 0, 0);
            doc.text(`Clave correcta: ${q.correcta}`, 25, y);
            y += 8;
          }
      } else if (q.tipo === 'match') {
          // Mostrar respuesta del alumno para match
          doc.setTextColor(41, 128, 185);
          const splitMatch = doc.splitTextToSize(`Respuesta: ${respAlumno || 'Sin responder'}`, 165);
          doc.text(splitMatch, 25, y);
          y += (splitMatch.length * 6) + 2;
          doc.setTextColor(142, 68, 173);
          doc.text(`[   ] Verificar manualmente (evaluación proporcional)`, 25, y);
          y += 8;
      } else {
          doc.setTextColor(41, 128, 185);
          doc.text(`Respuesta libre del alumno:`, 25, y);
          y += 6;
          doc.setTextColor(0, 0, 0);
          const splitLibre = doc.splitTextToSize(`"${respAlumno}"`, 160);
          doc.text(splitLibre, 25, y);
          y += (splitLibre.length * 6) + 4;
          doc.setTextColor(142, 68, 173);
          doc.text(`[   ] Evaluación Manual Docente`, 25, y);
          y += 8;
      }
      
      if (y > 270) { doc.addPage(); y = 20; }
    });
  });

  doc.save(`Examenes_Calificados_Sala_${codigoSala}.pdf`);
}

// Variables para control de paginación y tiempo individual
let currentQuestionIndex = 0;
let totalQuestions = 0;
let temporalRespuestas = {};

// ===== VARIABLES ANTI-TRAMPA =====
let cheatWarnings = 0;
let isExamActive = false;

// ===== ALUMNO =====
async function loginStudent() {
  const name = document.getElementById('student-name').value.trim();
  const code = document.getElementById('student-code').value.trim();
  if (!name || !code) return alert("Completa tus datos.");

  showLoader(true);
  const res = await postData({ action: 'ingresar_sala', codigoSala: code });
  showLoader(false);

  if (res && res.status === 'success') {
    currentStudentName = name; currentRoomCode = code; currentExamData = res.examen;
    startExam();
  } else alert("Sala inactiva.");
}

function startExam() {
  document.getElementById('display-student').innerText = currentStudentName;
  
  totalQuestions = currentExamData.length;
  currentQuestionIndex = 0;
  temporalRespuestas = {};
  
  cheatWarnings = 0;
  isExamActive = true;
  gameState.penalidadTrampa = 0;
  
  showView('view-exam');
  renderCurrentQuestion();
}

function renderCurrentQuestion(isRecovery = false) {
  const container = document.getElementById('student-questions-container');
  container.innerHTML = '';
  
  clearInterval(timerInterval);
  
  // Usar tiempo específico de la pregunta o 60s por defecto
  if (!isRecovery) {
    timeRemaining = currentExamData[currentQuestionIndex].tiempo || 60;
  }
  updateTimerDisplay();

  const q = currentExamData[currentQuestionIndex];
  
  const progressPercent = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  document.getElementById('exam-progress').style.width = `${progressPercent}%`;

  let interactableHTML = '';
  
  if (q.tipo === 'multiple' || !q.tipo) {
    const opciones = q.opciones || {};
    const opcionesHTML = Object.keys(opciones).map((key, idx) => {
      const letra = String.fromCharCode(65 + idx); // A, B, C, D...
      return `<label class="option-label" onclick="selectOption(this)"><input type="radio" name="resp_${q.id}" value="${opciones[key]}" style="display:none;"> ${letra}) ${opciones[key]}</label>`;
    }).join('');
    interactableHTML = opcionesHTML;
  } else if (q.tipo === 'match') {
    const conceptos = q.opciones?.conceptos || [];
    const definiciones = q.opciones?.definiciones || [];
    const letrasDef = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    const conceptosHTML = conceptos.map((c, idx) => `<p class="text-sm mb-1"><strong>${idx + 1}.</strong> ${c}</p>`).join('');
    const definicionesHTML = definiciones.map((d, idx) => `<p class="text-sm mb-1"><strong>${letrasDef[idx]})</strong> ${d}</p>`).join('');

    // Generar inputs dinámicos según cantidad de conceptos
    let inputsHTML = '';
    for (let i = 1; i <= conceptos.length; i++) {
      inputsHTML += `<div class="text-center"><span class="font-bold text-lg block mb-1">${i}</span><input type="text" id="resp_m${i}_${q.id}" class="w-12 h-10 border-2 border-indigo-300 rounded text-center font-bold uppercase text-lg" maxlength="1"></div>`;
    }

    interactableHTML = `
      <div class="bg-white border border-gray-300 rounded-lg p-3 mb-4 flex flex-col md:flex-row gap-4">
          <div class="flex-1">
              <h5 class="font-bold text-indigo-700 mb-2 border-b">Conceptos</h5>
              ${conceptosHTML}
          </div>
          <div class="flex-1">
              <h5 class="font-bold text-indigo-700 mb-2 border-b">Definiciones</h5>
              ${definicionesHTML}
          </div>
      </div>
      <div class="bg-gray-50 p-4 rounded-lg border border-indigo-200 shadow-sm">
        <p class="font-bold text-sm text-gray-700 mb-4 text-center">Escribe la letra correspondiente a cada número:</p>
        <div class="flex justify-around items-center flex-wrap gap-2">
          ${inputsHTML}
        </div>
      </div>
    `;
  } else {
    interactableHTML = `
      <textarea id="resp_text_${q.id}" rows="6" class="w-full border-2 border-indigo-300 rounded-lg p-3 text-gray-700" placeholder="Escribe tu respuesta aquí..."></textarea>
    `;
  }

  const textoPreguntaFormat = q.texto.replace(/\n/g, '<br>');

  container.innerHTML = `
    <div class="question-container active">
      <h4 style="color: var(--accent); margin-bottom: 15px;">Pregunta ${currentQuestionIndex + 1} de ${totalQuestions}</h4>
      <p style="font-size: 16px; margin-bottom: 20px;"><strong>${textoPreguntaFormat}</strong></p>
      ${interactableHTML}
    </div>`;

  // Restaurar respuestas previas si existen
  if (temporalRespuestas[q.id] && temporalRespuestas[q.id] !== "Sin responder") {
    if (q.tipo === 'multiple' || !q.tipo) {
      const radios = document.querySelectorAll(`input[name="resp_${q.id}"]`);
      radios.forEach(r => {
        if (r.value === temporalRespuestas[q.id]) {
          r.checked = true;
          r.closest('.option-label')?.classList.add('selected');
          r.closest('.option-label').style.backgroundColor = '#e8f5e9';
          r.closest('.option-label').style.borderColor = '#27ae60';
        }
      });
    } else if (q.tipo === 'match') {
      const respStr = temporalRespuestas[q.id];
      const pares = respStr.split(', ');
      pares.forEach(par => {
        const [num, letra] = par.split('-');
        const input = document.getElementById(`resp_m${num}_${q.id}`);
        if (input) input.value = letra;
      });
    } else {
      const textArea = document.getElementById(`resp_text_${q.id}`);
      if (textArea) textArea.value = temporalRespuestas[q.id];
    }
  }

  if (currentQuestionIndex < totalQuestions - 1) {
    document.getElementById('btn-next-question').style.display = 'block';
    document.getElementById('btn-finish-exam').style.display = 'none';
  } else {
    document.getElementById('btn-next-question').style.display = 'none';
    document.getElementById('btn-finish-exam').style.display = 'block';
  }

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    saveExamProgress(); // Autoguardado cada segundo
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      if (currentQuestionIndex < totalQuestions - 1) nextQuestion(); 
      else finishExam(); 
    }
  }, 1000);
}

function updateTimerDisplay() {
  let m = Math.floor(timeRemaining / 60);
  let s = timeRemaining % 60;
  document.getElementById('timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
}

function selectOption(labelElement) {
  const container = document.getElementById('student-questions-container');
  const labels = container.querySelectorAll('.option-label');
  labels.forEach(l => {
    l.classList.remove('selected');
    l.style.backgroundColor = '#fff';
    l.style.borderColor = '#ccc';
  });
  
  labelElement.classList.add('selected');
  labelElement.style.backgroundColor = '#e8f5e9';
  labelElement.style.borderColor = '#27ae60';
  labelElement.querySelector('input').checked = true;
}

function nextQuestion() {
  const q = currentExamData[currentQuestionIndex];
  if (q.tipo === 'multiple' || !q.tipo) {
    const seleccion = document.querySelector(`input[name="resp_${q.id}"]:checked`);
    temporalRespuestas[q.id] = seleccion ? seleccion.value : "Sin responder";
  } else if (q.tipo === 'match') {
    const conceptos = q.opciones?.conceptos || [];
    let respArr = [];
    for (let i = 1; i <= conceptos.length; i++) {
      const input = document.getElementById(`resp_m${i}_${q.id}`);
      if (input && input.value.trim()) {
        respArr.push(`${i}-${input.value.trim().toUpperCase()}`);
      }
    }
    temporalRespuestas[q.id] = respArr.length > 0 ? respArr.join(', ') : "Sin responder";
  } else {
    const textoArea = document.getElementById(`resp_text_${q.id}`);
    temporalRespuestas[q.id] = textoArea ? textoArea.value.trim() : "Sin responder";
  }

  saveExamProgress(); // Autoguardado al avanzar
  currentQuestionIndex++;
  renderCurrentQuestion();
}

async function finishExam() {
  const btnFinish = document.getElementById('btn-finish-exam');
  if (btnFinish.disabled) return; 
  
  btnFinish.disabled = true; 
  const originalText = btnFinish.innerHTML;
  btnFinish.innerHTML = '⏳ Enviando Evaluación...';
  
  clearInterval(timerInterval);
  isExamActive = false;
  
  // Guardar la respuesta de la última pregunta en pantalla
  const q = currentExamData[currentQuestionIndex];
  if (q.tipo === 'multiple' || !q.tipo) {
    const seleccion = document.querySelector(`input[name="resp_${q.id}"]:checked`);
    temporalRespuestas[q.id] = seleccion ? seleccion.value : "Sin responder";
  } else if (q.tipo === 'match') {
    const conceptos = q.opciones?.conceptos || [];
    let respArr = [];
    for (let i = 1; i <= conceptos.length; i++) {
      const input = document.getElementById(`resp_m${i}_${q.id}`);
      if (input && input.value.trim()) {
        respArr.push(`${i}-${input.value.trim().toUpperCase()}`);
      }
    }
    temporalRespuestas[q.id] = respArr.length > 0 ? respArr.join(', ') : "Sin responder";
  } else {
    const textoArea = document.getElementById(`resp_text_${q.id}`);
    temporalRespuestas[q.id] = textoArea ? textoArea.value.trim() : "Sin responder";
  }

  let puntaje = 0;

  // Evaluar respuestas con puntaje individual
  currentExamData.forEach(pregunta => {
    const valorAlumno = temporalRespuestas[pregunta.id];
    const claveCorrecta = pregunta.correcta;
    const ptsPregunta = pregunta.puntaje || 0;

    if (pregunta.tipo === 'multiple' || !pregunta.tipo) {
      if (valorAlumno === claveCorrecta) {
        puntaje += ptsPregunta; 
      }
    } else if (pregunta.tipo === 'match') {
      // Evaluación proporcional para match
      if (valorAlumno && valorAlumno !== "Sin responder" && !valorAlumno.startsWith("ANULADA")) {
        const conceptos = pregunta.opciones?.conceptos || [];
        const definiciones = pregunta.opciones?.definiciones || [];
        const totalPares = Math.min(conceptos.length, definiciones.length);
        
        if (totalPares > 0) {
          const letrasDef = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          const valorPorAcierto = ptsPregunta / totalPares;
          let aciertos = 0;

          // La clave correcta implícita: concepto i -> letra i (A, B, C...)
          const paresAlumno = valorAlumno.split(', ');
          paresAlumno.forEach(par => {
            const [num, letra] = par.split('-');
            const idxConcepto = parseInt(num) - 1;
            if (idxConcepto >= 0 && idxConcepto < totalPares) {
              if (letra === letrasDef[idxConcepto]) {
                aciertos++;
              }
            }
          });

          puntaje += (aciertos * valorPorAcierto);
        }
      }
    }
    // Preguntas 'text' no suman automáticamente
  });

  puntaje = Math.round(puntaje * 10) / 10;

  // Aplicar penalizaciones por trampa
  if (gameState.penalidadTrampa) {
      puntaje += gameState.penalidadTrampa;
  }

  if (puntaje < 0) puntaje = 0;
  puntaje = Math.round(puntaje * 10) / 10;

  showLoader(true);
  
  try {
      const res = await postData({
        action: 'enviar_examen', codigoSala: currentRoomCode,
        nombreAlumno: currentStudentName, respuestas: temporalRespuestas, puntaje: puntaje
      });
      showLoader(false);

      if (res && res.status === 'success') {
        myLastPuntaje = puntaje;
        myLastRespuestas = temporalRespuestas;
        
        localStorage.removeItem('evalua_progress'); // Limpiar caché de progreso
        
        document.getElementById('final-score-number').innerText = puntaje;
        showView('view-result');
      } else {
        throw new Error("El servidor devolvió un error al guardar el examen.");
      }
  } catch (error) {
      showLoader(false);
      btnFinish.disabled = false;
      btnFinish.innerHTML = originalText;
      alert("Error de conexión al enviar su evaluación. Su internet podría estar fallando. Por favor, intente enviarlo nuevamente.");
  }
}

// ===== DESCARGA DE EXAMEN EN BLANCO =====
async function downloadBlankExam() {
  const code = document.getElementById('report-code').value.trim();
  if(!code) return alert("Ingresa un código de sala para descargar el examen en blanco.");

  showLoader(true);
  const res = await postData({ action: 'obtener_resultados', codigoSala: code });
  showLoader(false);

  if (res && res.status === 'success' && res.examen) {
    generarPDFExamenBlanco(code, res.examen);
  } else {
    alert("La sala no existe o no tiene un examen registrado.");
  }
}

// ===== GENERACIÓN DE PDF EXAMEN EN BLANCO =====
function generarPDFExamenBlanco(codigoSala, examen) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  if (!examen || examen.length === 0) {
      alert("El examen no tiene preguntas registradas.");
      return;
  }

  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Examen de Evaluación", 105, 20, null, null, "center");
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Nombre del Alumno: __________________________________________________", 20, 35);
  doc.text(`Código de Sala: ${codigoSala}`, 20, 45);
  doc.text("Fecha: _____________________", 130, 45);
  
  doc.setDrawColor(0);
  doc.line(20, 52, 190, 52);

  let y = 65;
  
  examen.forEach((q, qIndex) => {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    
    const preguntaTexto = q.texto ? q.texto : "Pregunta no encontrada";
    const splitQuestion = doc.splitTextToSize(`${qIndex + 1}. ${preguntaTexto}`, 170);
    doc.text(splitQuestion, 20, y);
    y += (splitQuestion.length * 6) + 2;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    
    if (q.tipo === 'multiple' || !q.tipo) {
      const opciones = q.opciones || {};
      Object.keys(opciones).forEach((key, idx) => {
        const letra = String.fromCharCode(65 + idx);
        const textoOpcion = `${letra}) ${opciones[key]}`;
        const splitOpcion = doc.splitTextToSize(textoOpcion, 160);
        doc.text(splitOpcion, 25, y);
        y += (splitOpcion.length * 6) + 2;
      });
    } else if (q.tipo === 'match') {
      doc.setTextColor(41, 128, 185);
      doc.text("Relaciona los conceptos colocando la letra correspondiente:", 25, y);
      y += 8;
      doc.setTextColor(0, 0, 0);
      
      const conceptos = q.opciones?.conceptos || [];
      const definiciones = q.opciones?.definiciones || [];
      const letrasDef = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      
      // Columna de conceptos
      conceptos.forEach((c, idx) => {
        doc.text(`${idx + 1}. ${c}`, 25, y);
        y += 6;
      });
      
      y += 4;
      doc.setFont("helvetica", "italic");
      doc.text("Definiciones:", 25, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      
      definiciones.forEach((d, idx) => {
        doc.text(`${letrasDef[idx]}) ${d}`, 30, y);
        y += 6;
      });
      
      y += 6;
      doc.text("Respuestas: [ 1 ] - _____   [ 2 ] - _____   [ 3 ] - _____   [ 4 ] - _____", 25, y);
      y += 10;
    } else {
      doc.text("Respuesta:", 25, y);
      y += 8;
      for (let l = 0; l < 4; l++) {
        doc.line(25, y, 185, y);
        y += 8;
      }
    }
    
    y += 8;
    
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save(`Examen_Blanco_Sala_${codigoSala}.pdf`);
}

// ===== MOTOR ANTI-TRAMPAS =====
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isExamActive) {
    handleCheatWarning("El navegador fue minimizado o se cambió a una pestaña oculta.");
  }
});

window.addEventListener("blur", () => {
  if (isExamActive) {
    handleCheatWarning("El examen perdió el foco principal (posible apertura de otra aplicación, menú del celular o pantalla dividida).");
  }
});

document.addEventListener('contextmenu', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('copy', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('paste', event => { if(isExamActive) event.preventDefault(); });

function handleCheatWarning(motivo) {
  cheatWarnings++;
  
  if (cheatWarnings === 1) {
    alert(`¡ADVERTENCIA ANTI-TRAMPA (1/2)!\nDetalle: ${motivo}\n\nEstá prohibido salir de la ventana de la evaluación. A tu próxima infracción, la pregunta en la que estés será ANULADA y se restarán 2 puntos de tu calificación global.`);
    saveExamProgress();
    return;
  }

  const qActual = currentExamData[currentQuestionIndex];
  temporalRespuestas[qActual.id] = `ANULADA (${motivo})`;

  if (!gameState.penalidadTrampa) gameState.penalidadTrampa = 0;
  gameState.penalidadTrampa -= 2;

  if (cheatWarnings === 2) {
    alert(`¡ADVERTENCIA ANTI-TRAMPA (2/2)!\nDetalle: ${motivo}\n\nLa pregunta actual ha sido ANULADA y se han RESTADO 2 puntos de tu calificación global. A tu próxima infracción tu examen será cancelado por completo.`);
    
    saveExamProgress();
    
    if (currentQuestionIndex < totalQuestions - 1) {
      clearInterval(timerInterval);
      currentQuestionIndex++;
      renderCurrentQuestion();
    } else {
      finishExam(); 
    }
  } 
  else if (cheatWarnings >= 3) {
    alert(`¡INFRACCIÓN CRÍTICA!\nDetalle: ${motivo}\n\nHas superado el límite de advertencias permitidas. Tu evaluación ha sido cancelada.\nSe han descontado 2 puntos adicionales por esta infracción.`);
    finishExam(); 
  }
}

// ===== INICIALIZACIÓN =====
window.onload = () => { 
  applySeasonalTheme(); 
  checkSavedProgress(); 
};

// Registro PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}