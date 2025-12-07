// --- CONFIGURACIÓN ---
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un proyecto, añade una web app y copia los datos aquí:
const firebaseConfig = {
  apiKey: "AIzaSyCRPL6GMK3v31ovbw8JQP1MdnhkEREs7hQ",
  authDomain: "sede-nacional-dnis.firebaseapp.com",
  projectId: "sede-nacional-dnis",
  storageBucket: "sede-nacional-dnis.firebasestorage.app",
  messagingSenderId: "615396622610",
  appId: "1:615396622610:web:f48197f61c41ce7df9f3cb"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 3. Pega aquí tu URL de Webhook de Discord (No el ID del canal, sino la URL completa)
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1446993873975906344/lmlMulhCxZyQ5qxKZt5mkZhcX957jcx0XJoiLF_dNY4IzRz1FTxxF7ZpHrmMIe9GGepX"; 

// --- GESTIÓN DE ESTADO ---
let currentUserBadge = null;
let currentRole = null; // 'admin', 'viewer'

// Placas autorizadas
const BADGES = {
    'CNP-Peninsula001': { role: 'viewer', org: 'CNP' },
    'GC-Peninsula001':  { role: 'viewer', org: 'GC' },
    'CupulaFundadoraPeninsula0124': { role: 'admin', org: 'STAFF' }
};

// --- NAVEGACIÓN ---
function showLogin() {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('request-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
}

function showRequestForm() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('request-view').classList.remove('hidden');
}

function handleLogin() {
    const input = document.getElementById('badge-input').value;
    
    if (BADGES[input]) {
        currentUserBadge = input;
        currentRole = BADGES[input].role;
        
        document.getElementById('user-badge-display').innerText = `${BADGES[input].org} - PANEL DE CONTROL`;
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        
        // Si es Admin, mostrar solicitudes por defecto, si no, ciudadanos
        if(currentRole === 'admin') {
            loadRequests();
        } else {
            loadCitizens();
            document.getElementById('btn-solicitudes').style.display = 'none'; // Ocultar btn solicitudes a rangos bajos
        }
    } else {
        alert("PLACA NO RECONOCIDA O ACCESO DENEGADO");
    }
}

function logout() {
    location.reload();
}

// --- LÓGICA DE SOLICITUDES (PÚBLICO) ---

function submitRequest() {
    const name = document.getElementById('req-name').value;
    const dob = document.getElementById('req-dob').value;
    const photo = document.getElementById('req-photo').value;

    if (!name || !dob) return alert("Rellena todos los campos");

    const requestData = {
        name: name,
        dob: dob,
        photo: photo || "https://i.imgur.com/TuFotoDefault.png",
        status: "pending",
        timestamp: new Date()
    };

    db.collection("solicitudes").add(requestData)
        .then(() => {
            sendDiscordWebhook(requestData);
            alert("Solicitud enviada correctamente. Espera a que un administrador la apruebe.");
            showLogin();
            // Limpiar campos
            document.getElementById('req-name').value = "";
            document.getElementById('req-dob').value = "";
        })
        .catch((error) => {
            console.error("Error: ", error);
            alert("Error al enviar solicitud");
        });
}

// Generador de DNI Automático (Formato: 8 digitos + Letra)
function generateDNI() {
    let number = Math.floor(10000000 + Math.random() * 90000000);
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    let letter = letters.charAt(number % 23);
    return `${number}${letter}`;
}

// --- DISCORD WEBHOOK ---
function sendDiscordWebhook(data) {
    // Como no podemos recibir interacción de botones sin un Bot real,
    // enviamos un enlace al panel para que el admin entre a aceptar.
    const payload = {
        username: "Sistema DNI - Peninsula",
        embeds: [{
            title: "📋 Nueva Solicitud de DNI",
            color: 3447003, // Azul
            fields: [
                { name: "Nombre", value: data.name, inline: true },
                { name: "Nacimiento", value: data.dob, inline: true },
                { name: "Estado", value: "Pendiente de Aprobación" }
            ],
            thumbnail: { url: data.photo },
            footer: { text: "Entra al panel con la placa Cúpula para aceptar." }
        }]
    };

    fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

// --- PANEL DE ADMINISTRACIÓN ---

let currentList = [];

// Cargar Ciudadanos (DNI Activos)
function loadCitizens() {
    const listContainer = document.getElementById('list-render');
    listContainer.innerHTML = '<p style="padding:10px; color:#888">Cargando base de datos...</p>';
    
    db.collection("citizens").orderBy("name").get().then((querySnapshot) => {
        listContainer.innerHTML = '';
        currentList = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            currentList.push(data);
            renderListItem(data, 'citizen');
        });
    });
}

// Cargar Solicitudes Pendientes
function loadRequests() {
    const listContainer = document.getElementById('list-render');
    listContainer.innerHTML = '<p style="padding:10px; color:#888">Buscando solicitudes...</p>';

    db.collection("solicitudes").where("status", "==", "pending").get().then((querySnapshot) => {
        listContainer.innerHTML = '';
        if (querySnapshot.empty) listContainer.innerHTML = '<p style="padding:10px">No hay solicitudes pendientes.</p>';
        
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            renderListItem(data, 'request');
        });
    });
}

function renderListItem(data, type) {
    const listContainer = document.getElementById('list-render');
    const item = document.createElement('div');
    item.className = `article-item ${type === 'request' ? 'status-pending' : ''}`;
    
    let title = type === 'citizen' ? `${data.dni} | ${data.name}` : `SOLICITUD: ${data.name}`;
    let sub = type === 'citizen' ? 'Ciudadano Activo' : 'Esperando aprobación';

    item.innerHTML = `
        <div>
            <div class="info-main">${title}</div>
            <div class="info-sub">${sub}</div>
        </div>
        <div><i class="fas fa-chevron-right"></i></div>
    `;
    
    item.onclick = () => showDetails(data, type);
    listContainer.appendChild(item);
}

function showDetails(data, type) {
    const panel = document.getElementById('details-panel');
    let buttonsHtml = '';

    // Si es solicitud y soy ADMIN (Cúpula)
    if (type === 'request' && currentRole === 'admin') {
        buttonsHtml = `
            <div class="action-buttons">
                <button class="btn btn-green" onclick="approveRequest('${data.id}')">ACEPTAR Y GENERAR DNI</button>
                <button class="btn btn-red" onclick="rejectRequest('${data.id}')">RECHAZAR</button>
            </div>
        `;
    } 
    // Si es ciudadano y soy ADMIN
    else if (type === 'citizen' && currentRole === 'admin') {
        buttonsHtml = `
            <div class="action-buttons">
                <button class="btn btn-red" onclick="deleteCitizen('${data.id}')">ELIMINAR REGISTRO</button>
                <button class="btn btn-orange" onclick="editCitizen('${data.id}')">EDITAR DATOS</button>
            </div>
        `;
    }

    panel.innerHTML = `
        <img src="${data.photo}" class="profile-img" onerror="this.src='https://via.placeholder.com/300?text=Sin+Foto'">
        
        <div class="detail-row">
            <div class="detail-label">Nombre Completo</div>
            <div class="detail-value" id="val-name" contenteditable="${currentRole === 'admin'}">${data.name}</div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Fecha de Nacimiento</div>
            <div class="detail-value" id="val-dob" contenteditable="${currentRole === 'admin'}">${data.dob}</div>
        </div>

        ${data.dni ? `
        <div class="detail-row">
            <div class="detail-label">DNI ASIGNADO</div>
            <div class="detail-value" style="color:var(--accent); font-family:monospace; font-size:18px;">${data.dni}</div>
        </div>
        ` : ''}

        ${buttonsHtml}
    `;
}

// --- ACCIONES ADMINISTRATIVAS ---

function approveRequest(docId) {
    // 1. Obtener datos de solicitud
    db.collection("solicitudes").doc(docId).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const newDNI = generateDNI();
            
            // 2. Crear nuevo ciudadano
            db.collection("citizens").add({
                name: data.name,
                dob: data.dob,
                photo: data.photo,
                dni: newDNI,
                createdAt: new Date()
            }).then(() => {
                // 3. Borrar solicitud
                db.collection("solicitudes").doc(docId).delete();
                alert(`DNI Generado: ${newDNI}. Ciudadano registrado.`);
                loadRequests(); // Recargar lista
                document.getElementById('details-panel').innerHTML = '';
            });
        }
    });
}

function rejectRequest(docId) {
    if(confirm("¿Seguro que quieres rechazar esta solicitud?")) {
        db.collection("solicitudes").doc(docId).delete().then(() => {
            loadRequests();
            document.getElementById('details-panel').innerHTML = '';
        });
    }
}

function deleteCitizen(docId) {
    if(confirm("¿ESTÁS SEGURO? Esta acción es irreversible (Cúpula).")) {
        db.collection("citizens").doc(docId).delete().then(() => {
            alert("Ciudadano eliminado.");
            loadCitizens();
            document.getElementById('details-panel').innerHTML = '';
        });
    }
}

function editCitizen(docId) {
    // Capturamos los datos editados en los div contenteditable
    const newName = document.getElementById('val-name').innerText;
    const newDob = document.getElementById('val-dob').innerText;

    db.collection("citizens").doc(docId).update({
        name: newName,
        dob: newDob
    }).then(() => {
        alert("Datos actualizados correctamente.");
        loadCitizens();
    });
}

// Filtro de búsqueda
function filterList() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const items = document.querySelectorAll('.article-item');
    
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        if(text.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}
