// === SERVICE WORKER REGISTRATION ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.error('Error al registrar el Service Worker', err));
    });
}

// === LÓGICA MAESTRA UNIFICADA ===

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx27ehEycCOiHqyYOmPHNYQ7w_ZYluYA8wkdI2G_4PuzHqciyXYuftYqCUmuncpYaeRcQ/exec";

document.addEventListener("DOMContentLoaded", () => {
    const autoResizeTextareas = document.querySelectorAll('.textarea-auto');
    autoResizeTextareas.forEach(tx => {
        tx.addEventListener('input', function() {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";
        });
    });
});

const currentFolder = window.location.pathname.split('/').filter(Boolean)[0] || 'root';
const storageKey = 'tienda_guardada_' + currentFolder;

const _urlParams = new URLSearchParams(window.location.search);
let SHOP_ID = _urlParams.get('shop');
const MODO = _urlParams.get('modo');

if (MODO === 'master') {
    localStorage.setItem(storageKey + '_modo', 'master');
    localStorage.removeItem(storageKey); 
    SHOP_ID = null;
} else if (SHOP_ID) {
    localStorage.setItem(storageKey, SHOP_ID);
    localStorage.removeItem(storageKey + '_modo'); 
} else {
    SHOP_ID = localStorage.getItem(storageKey);
}

const IS_MASTER = (localStorage.getItem(storageKey + '_modo') === 'master' || MODO === 'master');

window.LINK_CLIENTES = window.location.href.split('?')[0] + (SHOP_ID && !IS_MASTER ? `?shop=${SHOP_ID}` : (IS_MASTER ? '?modo=master' : ''));

let WHATSAPP_EMPRENDEDOR = "";
let MONEDA = "$";
let SUBTITULO_TIENDA = "Mi Catálogo Digital"; 

let PROMO_ACTIVO = false;
let PROMO_CARD_TITULO = "";
let PROMO_CARD_SUBTITULO = "";
let PROMO_CARD_DESC = "";
let PROMO_MODAL_TITULO = "";
let PROMO_MODAL_SUBTITULO = "";
let PROMO_MODAL_DESC = "";
let PROMO_BOTON = "";
let PROMO_LINK = "";

let TEXTO_PLACEHOLDER = "Tu nombre y apellido...";
let TEXTO_MENSAJE = "Hola, mi nombre es *{nombre}*.\nMe interesa el siguiente pedido:\n\n";

let TIENDAS_DB = [];
let TODAS_LAS_TIENDAS = []; // Nueva base de datos que incluye a los suspendidos
let MASTER_STATS = {};

const IS_ADMIN = window.location.href.includes('admin=true');
if (IS_ADMIN) {
    document.body.classList.remove('modo-cliente');
    document.body.classList.add('modo-admin');
    document.getElementById('headerSubtitle').innerText = IS_MASTER ? "PANEL DE CONTROL MASTER" : "PANEL DE ADMINISTRACIÓN";

    const btnToggle = document.getElementById('btnToggleMode');
    if (btnToggle) btnToggle.style.display = "flex";
}

let products = [], categories = [];
let currentCategory = 'todas', currentDetailId = null, visibilityState = 0;

function formatPrice(num) { return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function hexToRgb(hex) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; }
        c = '0x' + c.join('');
        return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(', ');
    }
    return "31, 58, 90"; 
}

let deferredPrompt;
const installModal = document.getElementById('installModal');
const btnInstallConfirm = document.getElementById('btnInstallConfirm');

function showAlert(title, message) { document.getElementById('alertTitle').innerText = title; document.getElementById('alertMessage').innerText = message; document.getElementById('alertModal').classList.add('show'); }

function openWhatsApp(phone, message) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const encodedMsg = encodeURIComponent(message);
    const url = phone ?
        (isMobile ? `whatsapp://send?phone=${phone}&text=${encodedMsg}` : `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`) :
        (isMobile ? `whatsapp://send?text=${encodedMsg}` : `https://api.whatsapp.com/send?text=${encodedMsg}`);
    window.open(url, '_blank');
}

async function loadProducts() {
    try {
        const url = (SHOP_ID && !IS_MASTER) ? `${SCRIPT_URL}?shop=${SHOP_ID}` : SCRIPT_URL;
        const response = await fetch(url);
        const data = await response.json();

        if (!IS_MASTER && data.status === "inactive") {
            document.body.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px; text-align: center; background-color: #F4F7F9; font-family: 'Outfit', sans-serif; color: #122133;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🚧</div>
                    <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 10px; color: #1F3A5A;">Catálogo en Mantenimiento</h2>
                    <p style="font-size: 14px; color: #7E93A8; max-width: 300px; line-height: 1.5; margin-bottom: 30px;">Este catálogo se encuentra temporalmente fuera de servicio por mantenimiento o actualización de inventario. ¡Vuelve pronto!</p>
                    <button onclick="location.reload()" style="background-color: #E98C30; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; font-family: 'Outfit', sans-serif; transition: transform 0.2s;">Reintentar</button>
                </div>
            `;
            return;
        }

        MONEDA = data.moneda || "$";
        const mainTitle = data.nombre_tienda || "MiCatálogoX";
        SUBTITULO_TIENDA = data.subtitulo_tienda || "Mi Catálogo Digital"; 

        const titleEl = document.getElementById('headerTitle');
        const subtitleEl = document.getElementById('headerSubtitle');

        if (titleEl) { titleEl.innerHTML = mainTitle; }

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = mainTitle;
        document.title = tempDiv.textContent || tempDiv.innerText || "Catálogo";

        if (!IS_ADMIN && subtitleEl) { subtitleEl.innerText = SUBTITULO_TIENDA; }

        const logoEl = document.getElementById('headerLogo');
        if (logoEl && !IS_MASTER) {
            logoEl.src = "./icons/icon-192x192.png?v=" + new Date().getTime(); 
            logoEl.style.display = "block";
            logoEl.onerror = () => { logoEl.style.display = "none"; };
        } else if (logoEl) {
            logoEl.style.display = "none"; 
        }

        const root = document.documentElement;
        if (data.color_primario) { root.style.setProperty('--primary', data.color_primario); root.style.setProperty('--primary-rgb', hexToRgb(data.color_primario)); }
        if (data.color_acento) { root.style.setProperty('--accent', data.color_acento); root.style.setProperty('--accent-rgb', hexToRgb(data.color_acento)); }
        if (data.color_fondo) { root.style.setProperty('--bg-body', data.color_fondo); }
        if (data.color_texto) { root.style.setProperty('--text-dark', data.color_texto); root.style.setProperty('--text-dark-rgb', hexToRgb(data.color_texto)); }
        if (data.color_carta) { root.style.setProperty('--bg-card', data.color_carta); root.style.setProperty('--bg-panel', `rgba(${hexToRgb(data.color_carta)}, 0.95)`); }

        if (!IS_MASTER) { WHATSAPP_EMPRENDEDOR = data.whatsapp ? data.whatsapp.toString().replace(/[^0-9]/g, '') : ""; }

        const placeholderSheet = data.placeholder || data.texto_placeholder || data.Placeholder;
        TEXTO_PLACEHOLDER = (placeholderSheet && placeholderSheet.toString().trim() !== "") ? placeholderSheet.toString().trim() : "Tu nombre y apellido...";

        const rawMensaje = data.mensaje || "Hola, mi nombre es *{nombre}*.\nMe interesa el siguiente pedido:\n\n";
        TEXTO_MENSAJE = rawMensaje.replace(/\\n/g, '\n');

        if (data.promo) {
            PROMO_ACTIVO = true;
            PROMO_CARD_TITULO = data.promo.card_titulo || "INFO";
            PROMO_CARD_SUBTITULO = data.promo.card_subtitulo || "Aviso Importante";
            PROMO_CARD_DESC = data.promo.card_desc || "Toca aquí para ver detalles.";
            PROMO_MODAL_TITULO = data.promo.modal_titulo || "Promoción Especial";
            PROMO_MODAL_SUBTITULO = data.promo.modal_subtitulo || "";
            PROMO_MODAL_DESC = data.promo.modal_desc || "";
            PROMO_BOTON = data.promo.boton || "Ver detalles";
            PROMO_LINK = data.promo.link || "";

            document.getElementById('dinPromoTitle').innerHTML = PROMO_MODAL_TITULO;
            document.getElementById('dinPromoSubtitle').innerText = PROMO_MODAL_SUBTITULO;
            document.getElementById('dinPromoDesc').innerText = PROMO_MODAL_DESC;
            document.getElementById('dinPromoBtn').innerHTML = PROMO_BOTON;
        } else { PROMO_ACTIVO = false; }

        const nameInput = document.getElementById('customerName');
        if (nameInput) { nameInput.placeholder = TEXTO_PLACEHOLDER; nameInput.setAttribute("placeholder", TEXTO_PLACEHOLDER); }

        if (IS_MASTER) {
            TIENDAS_DB = data.emprendedores || [];
            TODAS_LAS_TIENDAS = data.todas_las_tiendas || [];
            MASTER_STATS = data.stats || {};
            categories = TIENDAS_DB; 

            const btnMasterStats = document.getElementById('btnMasterStats');
            if (IS_ADMIN && btnMasterStats) { btnMasterStats.style.display = "flex"; }
            
            const btnSettings = document.getElementById('btnSettings');
            const fabAdd = document.querySelector('.fab-add');
            if (btnSettings) btnSettings.style.display = "none";
            if (fabAdd) fabAdd.style.display = "none";
        } else {
            categories = data.categorias;
        }

        products = data.productos.map(item => ({
            id: item.id, 
            name: item.nombre, 
            cat: IS_MASTER ? (item.emprendedor ? item.emprendedor.toLowerCase() : '') : (item.categoria ? item.categoria.toLowerCase() : ''),
            price: parseFloat(item.precio) || 0, 
            desc: item.descripcion, 
            img: item.imagen,
            available: (item.activo === "SÍ" || item.activo === "SI" || item.activo === true), 
            qty: 0,
            emprendedor: item.emprendedor ? item.emprendedor.toLowerCase() : "" 
        }));

        renderCategoriesUI();
        renderProducts();
        updateCartBar();

        if (!IS_MASTER && IS_ADMIN && !localStorage.getItem('tutorial_admin_visto_' + currentFolder)) {
            mostrarTutorialAdmin();
        }

    } catch (error) {
        console.error("Error cargando productos:", error);
        document.getElementById('productGrid').innerHTML = `<div class="empty-state">Error de conexión.</div>`;
    }
}

async function saveCurrency() {
    if (IS_MASTER) return;
    const newVal = document.getElementById('currencyInput').value.trim() || "$";
    const btn = document.getElementById('btnSaveCurrency');

    MONEDA = newVal; renderProducts(); updateCartBar();
    btn.innerText = "Guardando..."; btn.disabled = true;

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action: "updateCurrency", moneda: MONEDA, shop: SHOP_ID }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: "follow"
        });
        btn.style.backgroundColor = 'var(--success)'; btn.innerText = "¡Listo!";
    } catch (e) {
        btn.innerText = "Error";
    } finally {
        setTimeout(() => { btn.style.backgroundColor = 'var(--accent)'; btn.innerText = "Guardar"; btn.disabled = false; }, 2000);
    }
}

function setCategory(cat, btnElement) {
    currentCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = "";
    const searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : "";
    const isVisualizingAsAdmin = document.body.classList.contains('modo-admin');

    const filtered = products.filter(p => {
        const matchCat = (currentCategory === 'todas' || p.cat === currentCategory);
        const matchSearch = p.name.toLowerCase().includes(searchVal) || p.desc.toLowerCase().includes(searchVal);

        if (!isVisualizingAsAdmin) {
            return p.available && matchCat && matchSearch;
        } else {
            let matchVis = true;
            if (visibilityState === 1) matchVis = (p.available === true);
            if (visibilityState === 2) matchVis = (p.available === false);
            return matchCat && matchVis && matchSearch;
        }
    });

    let tarjetaPublicidad = "";
    if (PROMO_ACTIVO) {
        tarjetaPublicidad = `
            <div class="card ad-card" onclick="document.getElementById('promoModal').classList.add('show')">
                <div class="ad-card-image">${PROMO_CARD_TITULO}</div>
                <div class="ad-title">${PROMO_CARD_SUBTITULO}</div>
                <div class="ad-desc">${PROMO_CARD_DESC}</div>
                <div class="ad-action">Ver más <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>
            </div>
        `;
    }

    if (filtered.length === 0) {
        if (isVisualizingAsAdmin) {
            grid.innerHTML = `<div class="empty-state">No hay productos.</div>`;
        } else {
            let mensajeVacio = "";
            let mostrarPromo = true; 
            if (products.filter(p => p.available).length === 0) {
                mensajeVacio = `<div class="empty-state large"><div class="empty-icon">🛍️</div><h3 class="empty-title">Catálogo en preparación</h3><p class="empty-desc">Aún no hemos publicado nuestros productos. ¡Vuelve muy pronto!</p></div>`;
                mostrarPromo = false; 
            } else {
                mensajeVacio = `<div class="empty-state large"><div class="empty-icon small">🔍</div><h3 class="empty-title">Sin resultados</h3><p class="empty-desc">No encontramos ningún modelo con esa descripción.</p></div>`;
            }
            grid.innerHTML = mensajeVacio + (mostrarPromo ? tarjetaPublicidad : "");
        }
        return;
    }

    filtered.forEach((p, index) => {
        const safeId = `prod-card-${p.id}`;
        if (!isVisualizingAsAdmin && index === 2) grid.innerHTML += tarjetaPublicidad;

        if (isVisualizingAsAdmin) {
            const hiddenClass = !p.available ? "hidden-prod" : "";
            const badge = !p.available ? `<div class="badge-hidden">Oculto</div>` : "";
            // Botón dinámico: EDITAR para la tienda, MODERAR para el Master
            const textoBotonAdmin = IS_MASTER ? "MODERAR" : "EDITAR";
            
            grid.innerHTML += `
                <div class="card ${hiddenClass}" onclick="openFormModal('${p.id}')">
                    ${badge}
                    <img src="${p.img}" class="card-img">
                    <div class="card-title">${p.name}</div>
                    <div class="card-desc">${p.desc}</div>
                    <div class="card-footer">
                        <div class="price">${MONEDA} ${formatPrice(p.price)}</div>
                        <div class="controls-wrapper">
                            <button class="btn-add admin-edit">${textoBotonAdmin}</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const showAddBtn = p.qty === 0 ? "flex" : "none";
            const showStepper = p.qty > 0 ? "flex" : "none";
            const isSelected = p.qty > 0 ? "selected" : "";
            grid.innerHTML += `
                <div id="${safeId}" class="card ${isSelected}" onclick="openDetailModal('${p.id}')">
                    <img src="${p.img}" class="card-img" alt="${p.name}">
                    <div class="card-title">${p.name}</div>
                    <div class="card-desc">${p.desc}</div>
                    <div class="card-footer" onclick="event.stopPropagation()">
                        <div class="price">${MONEDA} ${formatPrice(p.price)}</div>
                        <div class="controls-wrapper">
                            <button class="btn-add" style="display: ${showAddBtn};" onclick="updateQty('${p.id}', 1)">AGREGAR</button>
                            <div class="stepper" style="display: ${showStepper};">
                                <button onclick="updateQty('${p.id}', -1)">-</button>
                                <span class="qty-val">${p.qty}</span>
                                <button onclick="updateQty('${p.id}', 1)">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    if (!isVisualizingAsAdmin && filtered.length < 3 && PROMO_ACTIVO) grid.innerHTML += tarjetaPublicidad;
}

function changeAdminVisibilityFilter(val) { visibilityState = parseInt(val) || 0; renderProducts(); }

function processImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2, startY = (img.height - size) / 2;
            canvas.width = 400; canvas.height = 400;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, startX, startY, size, size, 0, 0, 400, 400);
            resolve(canvas.toDataURL('image/webp', 0.80));
        };
        img.onerror = () => reject(new Error("Formato de imagen no válido"));
        img.src = URL.createObjectURL(file);
    });
}

let currentImageFile = null;
const imgCam = document.getElementById('prodImgCam'), imgGal = document.getElementById('prodImgGal');
const previewImg = document.getElementById('previewImg'), uploadText = document.getElementById('uploadText');

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentImageFile = file; previewImg.src = URL.createObjectURL(file);
        previewImg.style.display = 'block'; uploadText.style.display = 'none';
    }
}

if (imgCam) imgCam.addEventListener('change', handleImageSelect);
if (imgGal) imgGal.addEventListener('change', handleImageSelect);
if (previewImg) { previewImg.addEventListener('click', () => { previewImg.style.display = 'none'; uploadText.style.display = 'flex'; currentImageFile = null; if (imgCam) imgCam.value = ""; if (imgGal) imgGal.value = ""; }); }

function handlePriceInput(e) {
    let val = e.target.value;
    val = val.replace(/[^0-9,]/g, '');
    let parts = val.split(',');
    if (parts.length > 2) parts = [parts[0], parts.slice(1).join('')];
    let intPart = parts[0];
    let decPart = parts.length > 1 ? parts[1] : null;

    if (intPart.length > 0) {
        intPart = intPart.replace(/^0+(?=\d)/, '');
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    } else if (decPart !== null) {
        intPart = "0";
    }

    if (decPart !== null) { e.target.value = intPart + ',' + decPart.substring(0, 2); } 
    else { e.target.value = intPart; }
}

function getRawPrice() {
    let val = document.getElementById('prodPrice').value;
    val = val.replace(/\./g, '');
    val = val.replace(',', '.');
    return val;
}

function formatPriceForInput(priceFloat) {
    let parts = priceFloat.toFixed(2).split('.');
    let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return intPart + ',' + parts[1];
}

function openFormModal(id) {
    document.getElementById('productForm').reset();
    previewImg.style.display = 'none'; uploadText.style.display = 'flex'; currentImageFile = null;
    if (imgCam) imgCam.value = ""; if (imgGal) imgGal.value = "";
    document.getElementById('btnEliminar').style.display = 'none';

    const prodDescTx = document.getElementById('prodDesc');
    const prodNameTx = document.getElementById('prodName');
    if (prodDescTx) prodDescTx.style.height = "auto";
    if (prodNameTx) prodNameTx.style.height = "auto";

    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.innerText = "Guardar Nuevo";
    btnGuardar.disabled = false;

    if (id) {
        const p = products.find(x => x.id.toString() === id.toString());
        document.getElementById('editId').value = p.id; document.getElementById('oldImgUrl').value = p.img;
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodPrice').value = formatPriceForInput(p.price);
        document.getElementById('prodCat').value = p.cat; document.getElementById('prodDesc').value = p.desc;
        document.getElementById('prodActivo').checked = p.available;
        previewImg.src = p.img; previewImg.style.display = 'block'; uploadText.style.display = 'none';
        
        if (!IS_MASTER) {
            // El botón borrar solo aparece en tiendas individuales
            document.getElementById('btnEliminar').style.display = 'grid';
        }
        btnGuardar.innerText = "Actualizar";

        if (prodDescTx) { prodDescTx.style.height = "auto"; prodDescTx.style.height = prodDescTx.scrollHeight + "px"; }
        if (prodNameTx) { prodNameTx.style.height = "auto"; prodNameTx.style.height = prodNameTx.scrollHeight + "px"; }
    } else {
        document.getElementById('editId').value = ""; document.getElementById('oldImgUrl').value = "";
    }
    document.getElementById('formModal').classList.add('show');
}

function closeFormModal() { document.getElementById('formModal').classList.remove('show'); }

const productForm = document.getElementById('productForm');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnGuardar');
        btn.innerText = "Procesando..."; btn.disabled = true;

        let finalImg = document.getElementById('oldImgUrl').value;
        const file = currentImageFile;
        const itemId = document.getElementById('editId').value;

        if (!itemId && !file) {
            showAlert("Imagen Faltante", "Por favor, toma una foto o selecciona una de la galería.");
            btn.innerText = "Guardar"; btn.disabled = false; return;
        }

        let base64String = null;

        if (file) {
            try {
                base64String = await processImageToBase64(file);
            } catch (error) {
                showAlert("Error de subida", "No pudimos procesar la imagen.");
                btn.innerText = itemId ? "Actualizar" : "Guardar Nuevo"; btn.disabled = false; return;
            }
        }

        // Si es master, solo permite moderar (ocultar), pero respeta al emprendedor original
        const pOriginal = itemId ? products.find(x => x.id.toString() === itemId.toString()) : null;
        const targetShop = IS_MASTER && pOriginal ? pOriginal.emprendedor : SHOP_ID;

        const datos = {
            action: itemId ? "update" : "create", id: itemId,
            nombre: document.getElementById('prodName').value, 
            categoria: document.getElementById('prodCat').value,
            precio: getRawPrice(),
            descripcion: document.getElementById('prodDesc').value,
            imagen: finalImg, 
            imageBase64: base64String, 
            activo: document.getElementById('prodActivo').checked ? "SÍ" : "NO",
            shop: targetShop
        };

        try {
            const response = await fetch(SCRIPT_URL, { 
                method: "POST", body: JSON.stringify(datos), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: "follow" 
            });
            const resData = await response.json();
            if (resData.status === "error") { showAlert("Error de Drive", resData.msg); } 
            else { closeFormModal(); loadProducts(); }
        } catch (error) {
            showAlert("Error de guardado", "Hubo un problema de conexión al guardar el producto.");
        } finally {
            btn.innerText = itemId ? "Actualizar" : "Guardar Nuevo"; btn.disabled = false;
        }
    });
}

async function executeDelete() {
    if (IS_MASTER) return;
    const btn = document.getElementById('btnConfirmDelete'); btn.innerText = "Borrando..."; btn.disabled = true;
    await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "delete", id: document.getElementById('editId').value, shop: SHOP_ID }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: "follow" });
    document.getElementById('deleteModal').classList.remove('show'); closeFormModal(); loadProducts(); btn.innerText = "Sí, Eliminar"; btn.disabled = false;
}

function openShareModal() {
    document.getElementById('qrCode').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.LINK_CLIENTES)}`;
    document.getElementById('shareModal').classList.add('show');
}

function shareWhatsApp() {
    let number = document.getElementById('shareWaNumber').value.trim();
    const msg = `¡Hola! Conoce mi catálogo y haz tu pedido aquí: ${window.LINK_CLIENTES}`;
    if (number !== "") {
        if (number.length !== 11 || !number.startsWith('0')) { showAlert("Número Inválido", "Ingresa 11 dígitos que comiencen con 0."); return; }
        number = '58' + number.substring(1); openWhatsApp(number, msg);
    } else { openWhatsApp('', msg); }
}

function toggleSearch(show) {
    const navN = document.getElementById('navNormal'), navS = document.getElementById('navSearch'), input = document.getElementById('searchInput');
    if (show) { navN.style.display = 'none'; navS.style.display = 'flex'; input.focus(); }
    else { input.value = ''; document.getElementById('clearBtn').style.display = 'none'; navS.style.display = 'none'; navN.style.display = 'flex'; renderProducts(); }
}
function handleSearch() { document.getElementById('clearBtn').style.display = document.getElementById('searchInput').value.length > 0 ? 'block' : 'none'; renderProducts(); }
function clearSearch() { document.getElementById('searchInput').value = ''; document.getElementById('clearBtn').style.display = 'none'; document.getElementById('searchInput').focus(); renderProducts(); }

function updateQty(id, change) {
    const prod = products.find(p => p.id.toString() === id.toString());
    if (prod) {
        prod.qty = Math.max(0, prod.qty + change);
        const card = document.getElementById(`prod-card-${id}`);
        if (card) {
            if (prod.qty === 0) { card.classList.remove('selected'); card.querySelector('.btn-add').style.display = 'flex'; card.querySelector('.stepper').style.display = 'none'; }
            else { card.classList.add('selected'); card.querySelector('.btn-add').style.display = 'none'; card.querySelector('.stepper').style.display = 'flex'; card.querySelector('.qty-val').innerText = prod.qty; }
        }
    }
    updateCartBar();
    if (document.getElementById('cartModal').classList.contains('show')) renderCartModal();
    if (document.getElementById('detailModal').classList.contains('show') && currentDetailId.toString() === id.toString()) renderDetailAction(prod);
}

function updateCartBar() {
    let items = 0, total = 0; products.forEach(p => { items += p.qty; total += (p.qty * p.price); });
    document.getElementById('cartCount').innerText = `${items}x`;
    document.getElementById('cartTotal').innerText = `${MONEDA} ${formatPrice(total)}`;
    if (document.getElementById('ticketTotalAmount')) document.getElementById('ticketTotalAmount').innerText = `${MONEDA} ${formatPrice(total)}`;
    items > 0 ? document.getElementById('checkoutBar').classList.add('show') : document.getElementById('checkoutBar').classList.remove('show');
}

function openDetailModal(id) {
    const prod = products.find(p => p.id.toString() === id.toString()); currentDetailId = id;
    document.getElementById('detailImg').src = prod.img; document.getElementById('detailTitle').innerText = prod.name;
    document.getElementById('detailDesc').innerText = prod.desc; document.getElementById('detailPrice').innerText = `${MONEDA} ${formatPrice(prod.price)}`;
    renderDetailAction(prod); document.getElementById('detailModal').classList.add('show');
}

function renderDetailAction(prod) {
    const cont = document.getElementById('detailActionContainer');
    if (prod.qty === 0) { 
        cont.innerHTML = `<button class="btn-checkout btn-checkout-list" onclick="updateQty('${prod.id}', 1)">Agregar a mi lista</button>`; 
    } else { 
        cont.innerHTML = `<div class="stepper-list"><button onclick="updateQty('${prod.id}', -1)">-</button><span>${prod.qty} EN LISTA</span><button onclick="updateQty('${prod.id}', 1)">+</button></div>`; 
    }
}

function closeDetailModal() { document.getElementById('detailModal').classList.remove('show'); currentDetailId = null; }
function openCartModal() { renderCartModal(); document.getElementById('cartModal').classList.add('show'); document.getElementById('nameError').style.display = 'none'; }
function closeCartModal() { document.getElementById('cartModal').classList.remove('show'); }

function renderCartModal() {
    const list = document.getElementById('ticketList'); list.innerHTML = ""; let total = 0;
    const cartItems = products.filter(p => p.qty > 0); 
    if (cartItems.length === 0) { closeCartModal(); return; }
    cartItems.forEach(p => {
        const sub = p.qty * p.price; total += sub;
        
        // Convertimos el salto de línea (Enter) en un guion y espacio para que se lea fluido en el carrito
        const nombreLimpio = p.name.replace(/\n/g, ' ');
        
        // Nuevo diseño: Nombre arriba, y barra de controles abajo (Precio | Cantidad | Subtotal)
        list.innerHTML += `
            <div class="ticket-item" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 12px;">
                <!-- Línea Superior: Nombre del Producto (white-space: normal anula el salto de línea) -->
                <div class="ticket-name" style="margin: 0; text-align: left; width: 100%; white-space: normal;">${nombreLimpio}</div>
                
                <!-- Línea Inferior: Precio Unitario / Cantidad / Subtotal -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    
                    <!-- Izquierda: Precio Unitario -->
                    <div class="ticket-unit-price" style="flex: 1; text-align: left;">${MONEDA} ${formatPrice(p.price)} c/u</div>
                    
                    <!-- Centro: Selector de Cantidad -->
                    <div class="ticket-stepper" style="width: 100px; flex-shrink: 0; margin: 0;">
                        <button onclick="updateQty('${p.id}', -1)">-</button>
                        <span>${p.qty}</span>
                        <button onclick="updateQty('${p.id}', 1)">+</button>
                    </div>
                    
                    <!-- Derecha: Subtotal -->
                    <div class="ticket-subtotal" style="flex: 1; text-align: right; width: auto;">${MONEDA} ${formatPrice(sub)}</div>
                    
                </div>
            </div>
        `;
    });
    document.getElementById('ticketTotalAmount').innerText = `${MONEDA} ${formatPrice(total)}`;
}

// === VACIAR EL CARRITO DE COMPRAS ===
function executeResetCart() { 
    try {
        products.forEach(p => p.qty = 0); 
        const inputName = document.getElementById('customerName');
        if (inputName) inputName.value = ''; 
        
        renderProducts(); 
        updateCartBar(); 
        
        document.getElementById('confirmResetModal').classList.remove('show'); 
        closeCartModal(); 
    } catch(e) {
        console.error("Error al vaciar carrito:", e);
    }
}

// Envío inteligente de WhatsApp según la tienda a la que pertenece el producto
// Envío inteligente de WhatsApp según la tienda a la que pertenece el producto
function sendWhatsAppClient() {
    const cartItems = products.filter(p => p.qty > 0);
    if (cartItems.length === 0) return;

    const name = document.getElementById('customerName').value.trim();
    if (!name) { 
        document.getElementById('nameError').style.display = 'block'; 
        document.getElementById('customerName').focus(); 
        return; 
    }

    if (IS_MASTER) {
        // Agrupar los productos por emprendedor
        const itemsByVendor = {};
        cartItems.forEach(p => {
            if (!itemsByVendor[p.emprendedor]) itemsByVendor[p.emprendedor] = [];
            itemsByVendor[p.emprendedor].push(p);
        });

        const vendors = Object.keys(itemsByVendor);

        // Si hay más de una tienda, abrimos el Modal de Pedido Dividido
        if (vendors.length > 1) {
            let html = "";
            vendors.forEach(empId => {
                const empData = TIENDAS_DB.find(t => t.id.toLowerCase() === empId.toLowerCase());
                const shopName = empData ? empData.nombre_tienda : empId;
                
                // Calcula el total rápido solo para mostrarlo en el botón
                let subTotalTienda = 0;
                itemsByVendor[empId].forEach(prod => { subTotalTienda += (prod.qty * prod.price); });
                
                html += `
                    <button class="btn-whatsapp" onclick="sendToSingleVendor('${empId}', '${name}')" style="justify-content: space-between; padding: 12px 16px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.2);">
                        <div style="text-align: left; display: flex; flex-direction: column;">
                            <span style="font-size: 13px; font-weight: 800;">📦 ${shopName}</span>
                            <span style="font-size: 11px; font-weight: 500; opacity: 0.9;">Total: ${MONEDA} ${formatPrice(subTotalTienda)}</span>
                        </div>
                        <span style="font-size: 12px;">Enviar ➔</span>
                    </button>
                `;
            });
            document.getElementById('multiVendorList').innerHTML = html;
            document.getElementById('multiVendorModal').classList.add('show');
            return; // Detenemos la ejecución aquí hasta que el cliente toque los botones
        } else {
            // Si solo es una tienda, enviamos directo
            sendToSingleVendor(vendors[0], name);
        }
    } else {
        // Modo Individual clásico
        sendToSingleVendor(null, name, WHATSAPP_EMPRENDEDOR);
    }
}

// Función auxiliar que arma y envía el mensaje para un emprendedor en específico
function sendToSingleVendor(empId, customerName, fallbackWa = null) {
    let destinatarioWa = fallbackWa;
    let vendorItems = products.filter(p => p.qty > 0);

    if (empId) {
        vendorItems = vendorItems.filter(p => p.emprendedor === empId);
        const empData = TIENDAS_DB.find(t => t.id.toLowerCase() === empId.toLowerCase());
        if (empData && empData.whatsapp) {
            destinatarioWa = empData.whatsapp.toString().replace(/[^0-9]/g, '');
        }
    }

    if (!destinatarioWa) {
        showAlert("Atención", "Esta marca no ha configurado un número de WhatsApp.");
        return;
    }

    let msg = TEXTO_MENSAJE.replace('{nombre}', customerName);
    if (!msg.includes(customerName)) msg = msg + `\nDatos del cliente: *${customerName}*\n\n`;

    let total = 0;
    vendorItems.forEach(p => {
        const sub = p.qty * p.price;
        total += sub;
        msg += `✔ ${p.qty}x ${p.name} - ${MONEDA} ${formatPrice(sub)}\n`;
    });

    msg += `\n*TOTAL: ${MONEDA} ${formatPrice(total)}*\n\n¡Gracias!`;
    openWhatsApp(destinatarioWa, msg);
}

function renderCategoriesUI() {
    const container = document.getElementById('categoryContainer'), select = document.getElementById('prodCat');
    if (!container) return;

    let html = `<button class="cat-btn ${currentCategory === 'todas' ? 'active' : ''}" onclick="setCategory('todas', this)">TODOS</button>`;
    let options = "";

    if (IS_MASTER) {
        TIENDAS_DB.forEach(tienda => {
            const empId = tienda.id.toLowerCase();
            html += `<button class="cat-btn ${currentCategory === empId ? 'active' : ''}" onclick="setCategory('${empId}', this)">${tienda.nombre_tienda.toUpperCase()}</button>`;
        });
    } else {
        categories.forEach(cat => {
            const catId = cat.toLowerCase(); html += `<button class="cat-btn ${currentCategory === catId ? 'active' : ''}" onclick="setCategory('${catId}', this)">${cat.toUpperCase()}</button>`;
            options += `<option value="${catId}">${cat}</option>`;
        });
    }

    container.innerHTML = html;
    if (select) select.innerHTML = options;
}

function renderCategoryManagerList() {
    if (IS_MASTER) return;
    const list = document.getElementById('categoryManagerList'); list.innerHTML = "";
    categories.forEach(cat => {
        list.innerHTML += `<div class="cat-list-item"><span class="cat-list-name">${cat}</span><div class="cat-list-actions"><button onclick="editCategory('${cat}')" class="btn-text-edit">Editar</button><button onclick="deleteCategory('${cat}')" class="btn-text-delete">Borrar</button></div></div>`;
    });
}

function openCategoryManager() {
    if (IS_MASTER) return;
    const select = document.getElementById('currencyInput');
    if (select.querySelector(`option[value="${MONEDA}"]`)) { select.value = MONEDA; } else { select.value = "$"; }
    const visSelect = document.getElementById('visibilityInput');
    if (visSelect) visSelect.value = visibilityState.toString();

    renderCategoryManagerList();
    document.getElementById('categoryManagerModal').classList.add('show');
}

async function addCategory() {
    if (IS_MASTER) return;
    const name = document.getElementById('newCatName').value.trim(); if (!name) return;
    categories.push(name); renderCategoryManagerList(); renderCategoriesUI(); document.getElementById('newCatName').value = "";
    await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "addCategory", nombre: name, shop: SHOP_ID }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: "follow" });
    loadProducts();
}

function editCategory(oldName) {
    if (IS_MASTER) return;
    document.getElementById('labelOldCat').innerText = oldName; document.getElementById('oldCatNameHolder').value = oldName;
    document.getElementById('editCatInput').value = oldName; document.getElementById('editCategoryModal').classList.add('show');
    setTimeout(() => document.getElementById('editCatInput').focus(), 300);
}

async function executeEditCategory() {
    if (IS_MASTER) return;
    const oldName = document.getElementById('oldCatNameHolder').value, nuevoNombre = document.getElementById('editCatInput').value.trim();
    const btn = document.querySelector('#editCategoryModal .btn-submit');
    if (!nuevoNombre || nuevoNombre === oldName) { document.getElementById('editCategoryModal').classList.remove('show'); return; }
    btn.innerText = "Guardando..."; btn.disabled = true;
    const index = categories.indexOf(oldName); if (index !== -1) categories[index] = nuevoNombre;
    renderCategoryManagerList(); renderCategoriesUI(); document.getElementById('editCategoryModal').classList.remove('show');
    try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateCategory", viejoNombre: oldName, nuevoNombre: nuevoNombre, shop: SHOP_ID }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: "follow" }); await loadProducts(); }
    catch (e) { console.error(e); } finally { btn.innerText = "Guardar"; btn.disabled = false; }
}

function deleteCategory(name) {
    if (IS_MASTER) return;
    document.getElementById('labelDelCat').innerText = `"${name}"`; document.getElementById('delCatNameHolder').value = name;
    document.getElementById('confirmDeleteCategoryModal').classList.add('show');
}

async function executeDeleteCategory() {
    if (IS_MASTER) return;
    const name = document.getElementById('delCatNameHolder').value.trim(), btn = document.querySelector('#confirmDeleteCategoryModal .btn-submit');
    btn.innerText = "Eliminando..."; btn.disabled = true;
    categories = categories.filter(c => c !== name); renderCategoryManagerList(); renderCategoriesUI(); document.getElementById('confirmDeleteCategoryModal').classList.remove('show');
    try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "deleteCategory", nombre: name, shop: SHOP_ID }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: "follow" }); await loadProducts(); }
    catch (e) { console.error(e); } finally { btn.innerText = "Sí, Eliminar"; btn.disabled = false; }
}

function toggleClientAdminView() {
    const body = document.body;
    const subtitle = document.getElementById('headerSubtitle');
    const previewBadge = document.getElementById('previewBadge');

    if (body.classList.contains('modo-admin')) {
        body.classList.remove('modo-admin');
        body.classList.add('modo-cliente');
        if (subtitle) subtitle.innerText = SUBTITULO_TIENDA; 
        if (previewBadge) previewBadge.style.display = "flex"; 
    } else {
        body.classList.remove('modo-cliente');
        body.classList.add('modo-admin');
        if (subtitle) subtitle.innerText = IS_MASTER ? "PANEL DE CONTROL MASTER" : "PANEL DE ADMINISTRACIÓN";
        if (previewBadge) previewBadge.style.display = "none"; 
    }
    renderProducts();
    updateCartBar();
}

// === GESTOR DEL DASHBOARD MASTER SECRET ===
function openMasterDashboard() {
    if (!IS_MASTER) return;
    
    document.getElementById('masterTotalShops').innerText = TIENDAS_DB.length;
    document.getElementById('masterTotalProducts').innerText = products.length;

    const tableContainer = document.getElementById('masterStatsTableContainer');
    if (tableContainer) {
        tableContainer.innerHTML = "";
        
        TODAS_LAS_TIENDAS.forEach(tienda => {
            const shopId = tienda.id.toLowerCase();
            const stats = MASTER_STATS[shopId] || { instalaciones: 0, visitas: 0 };
            
            const prodCount = products.filter(p => p.emprendedor === shopId).length;

            const isActiva = tienda.activo;
            const colorEstado = isActiva ? 'var(--success)' : 'var(--danger)';
            const btnTexto = isActiva ? 'Suspender' : 'Activar';
            const newStatusTarget = isActiva ? 'NO' : 'SÍ';

            tableContainer.innerHTML += `
                <div style="background: var(--bg-hover); border: 1px solid var(--border-color); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${colorEstado};"></div>
                            <span style="font-weight: 700; color: var(--primary); font-size: 14px;">${tienda.nombre_tienda}</span>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="font-size: 11px; background: var(--accent-light); color: var(--accent); padding: 2px 8px; border-radius: 20px; font-weight: 700;">${prodCount} Prods</span>
                            <button onclick="toggleShopStatus('${shopId}', '${newStatusTarget}')" style="background: ${isActiva ? 'var(--danger-light)' : 'var(--success)'}; color: ${isActiva ? 'var(--danger)' : '#fff'}; border: none; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s;">${btnTexto}</button>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: center; margin-top: 4px;">
                        <div>
                            <span style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">📲 Instalas</span>
                            <div style="font-size: 16px; font-weight: 700; color: var(--primary);">${stats.instalaciones}</div>
                        </div>
                        <div>
                            <span style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">👁️ Aperturas</span>
                            <div style="font-size: 16px; font-weight: 700; color: var(--primary);">${stats.visitas}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    document.getElementById('masterDashboardModal').classList.add('show');
}

// === MÓDULO DE SUSPENSIÓN DE TIENDAS DESDE EL DASHBOARD ===
function toggleShopStatus(targetShopId, newStatus) {
    const isSuspend = (newStatus === 'NO');
    
    document.getElementById('suspendTitle').innerText = isSuspend ? '¿Suspender Tienda?' : '¿Activar Tienda?';
    document.getElementById('suspendTitle').className = isSuspend ? 'alert-title danger' : 'alert-title text-primary';
    document.getElementById('suspendMsg').innerText = `¿Estás seguro de que deseas ${isSuspend ? 'SUSPENDER' : 'ACTIVAR'} la tienda "${targetShopId}"?`;
    
    const btnConfirm = document.getElementById('btnConfirmSuspend');
    btnConfirm.innerText = isSuspend ? 'Sí, Suspender' : 'Sí, Activar';
    btnConfirm.className = 'btn-submit';
    btnConfirm.style.backgroundColor = isSuspend ? 'var(--danger)' : 'var(--success)';

    document.getElementById('suspendTargetShop').value = targetShopId;
    document.getElementById('suspendNewStatus').value = newStatus;

    document.getElementById('confirmSuspendModal').classList.add('show');
}

async function executeToggleShopStatus() {
    const targetShopId = document.getElementById('suspendTargetShop').value;
    const newStatus = document.getElementById('suspendNewStatus').value;
    const btn = document.getElementById('btnConfirmSuspend');
    
    btn.innerText = "Procesando...";
    btn.disabled = true;

    try {
        await fetch(SCRIPT_URL, { 
            method: "POST", 
            body: JSON.stringify({ action: "toggleShopStatus", targetShop: targetShopId, newStatus: newStatus }), 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        location.reload();
    } catch (e) {
        showAlert("Error", "No se pudo actualizar el estado de la tienda.");
        btn.innerText = "Confirmar";
        btn.disabled = false;
    }
}

// === MÓDULO DE ESTADÍSTICAS SILENCIOSAS ===
function registrarEstadistica(evento) {
    if (!SHOP_ID) return; 
    const datosStats = { action: "analytics", shop: SHOP_ID, evento: evento };
    fetch(SCRIPT_URL, { 
        method: "POST", 
        body: JSON.stringify(datosStats), 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).catch(e => console.log("Stats error ignorado"));
}

window.addEventListener('appinstalled', (evt) => {
    registrarEstadistica("APP INSTALADA");
});

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            registrarEstadistica("VISITA DESDE LA APP");
        }
    }, 3000);
});

// === ACCIÓN DE LA PUBLICIDAD GLOBAL ===
function ejecutarPromoAccion() {
    if (PROMO_LINK && PROMO_LINK.trim() !== "") {
        window.open(PROMO_LINK, '_blank');
    } else {
        document.getElementById('promoModal').classList.remove('show');
    }
}

// === FUNCIÓN DE BIENVENIDA Y TUTORIAL DEL ADMINISTRADOR ===
function mostrarTutorialAdmin() {
    const slides = [
        {
            img: "https://lh3.googleusercontent.com/d/1R_PVRSGCsx4jhgBNOqwEkBDzHKa0uR1w", 
            title: "¡Bienvenido a tu Panel secreto!",
            desc: "Éste es tu centro de control, y sólo tú lo verás. Desde aquí podrás agregar, modificar, ocultar o eliminar tus productos."
        },  
        {
            img: "https://lh3.googleusercontent.com/d/12bwwY89pTMViims0F0akCLup3mnFeD4E", 
            title: "Agregar un nuevo producto",
            desc: "Toca el botón flotante + abajo a la derecha. <br>Se abrirá una ficha."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1GVHcLfcfOKlU2_gUKEFErDzuStQuRP0o", 
            title: "Registra tu producto",
            desc: "En esta ficha subes una imagen de la galería, completa el formulario y toca en GUARDAR NUEVO."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1FcwxdoOA1ZBN7bmqmbCe_ImlZdF2rf5N", 
            title: "Modificar un producto",
            desc: "Si quieres cambiar el precio o la descripción de un producto, simplemente tócalo en tu panel administrativo."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1T2neUix4Ut2nkTLJTXjGVFX5cYjxnZjy", 
            title: "Ocultar, borrar o actualizar",
            desc: "Si sólo deseas ocultar, desactiva VISIBLE EN CATÁLOGO y actualiza. El producto quedará guardado para ti, pero tus clientes ya no lo verán."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1UEPe7EEPoclL2zRwEk8yQ75YB1R5vI-Z", 
            title: "Ajustes del catálogo",
            desc: "En tu panel administrativo, toca el botón flotante ⚙️ (Ajustes) abajo a la derecha."
        },
        {
            img: "https://lh3.googleusercontent.com/d/19GWICUHMjguQ5RNH5mWuYes-tecWfN90", 
            title: "Gestionar categorías",
            desc: "En esta ficha puedes gestionar diferentes ajustes para adaptar tu catálogo a tus requerimientos."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1x92jrfLmSTMGzKM_oYcRudb4ModJbCiR", 
            title: "El catálogo de tus clientes",
            desc: "El proceso de compra es sumamente intuitivo para tus clientes."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1ZExOyLhYm_OUZVndryfKhZdercZZwbUD", 
            title: "Total de la compra",
            desc: "Según las cantidades de los productos que eligen, se totaliza en la barra del carrito de compras."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1ubk_OTKoCEfCFQXySVyaQOCZ46ecmcTd", 
            title: "Momento del pedido",
            desc: "El cliente escribe su nombre y el pedido llega directo a tu WhasApp. Tú coordinas el pedido sin intermedarios ni comisiones."
        },
        {
            img: "https://lh3.googleusercontent.com/d/16gCRjxPWQ2BbeI8-6eilk1hmi_dIko7l", 
            title: "Compartir tu catálogo",
            desc: "Tú y tus clientes pueden compartir el modo no editable de tu catálgo."
        },
        {
            img: "https://lh3.googleusercontent.com/d/1u3uDgN5vbNUvlO4mDpfBbbTn13-G6nJm", 
            title: "Código QR y WhatsApp",
            desc: "Que escaneen el QR o envía un link para el acceso inmediato a tu Catálogo Digital."
        }
    ];

    let currentSlide = 0;

    const overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(18, 33, 51, 0.9); backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px); z-index: 2000; 
        display: flex; align-items: center; justify-content: center;
        font-family: 'Outfit', sans-serif; padding: 20px; box-sizing: border-box;
    `;

    const content = document.createElement('div');
    content.style = `
        background: white; width: 100%; max-width: 380px;
        border-radius: 1rem; padding: 24px; text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex;
        flex-direction: column; align-items: center; position: relative;
        box-sizing: border-box;
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    function renderSlide() {
        const slide = slides[currentSlide];
        content.innerHTML = `
            <button id="closeTutorialBtn" style="position: absolute; top: 15px; right: 15px; background: #F1F5F9; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 14px; font-weight: bold; color: #1F3A5A; display: flex; align-items: center; justify-content: center;">✕</button>
            <img src="${slide.img}" style="width: 100%; height: auto; object-fit: contain; border-radius: 14px; margin-bottom: 20px; background: #F8FAFC; padding: 10px; box-sizing: border-box;" alt="Tutorial">
            <h3 style="font-size: 18px; font-weight: 700; color: #1F3A5A; margin-bottom: 8px;">${slide.title}</h3>
            <p style="font-size: 13px; color: #7E93A8; line-height: 1.5; margin-bottom: 24px; min-height: 60px; white-space: pre-line;">${slide.desc}</p>
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; gap: 15px;">
                <span style="font-size: 11px; font-weight: 700; color: #7E93A8; text-transform: uppercase; letter-spacing: 0.5px;">Paso ${currentSlide + 1} de ${slides.length}</span>
                <button id="nextTutorialBtn" style="background: #E98C30; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; transition: transform 0.2s;">
                    ${currentSlide === slides.length - 1 ? 'Empezar' : 'Siguiente'}
                </button>
            </div>
        `;

        document.getElementById('closeTutorialBtn').onclick = finalizarTutorial;
        document.getElementById('nextTutorialBtn').onclick = () => {
            if (currentSlide === slides.length - 1) { finalizarTutorial(); } 
            else { currentSlide++; renderSlide(); }
        };
    }

    function finalizarTutorial() {
        localStorage.setItem('tutorial_admin_visto_' + currentFolder, 'true');
        overlay.remove();
    }

    renderSlide();
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => { installModal.classList.add('show'); }, 2000);
});

btnInstallConfirm.addEventListener('click', async () => {
    installModal.classList.remove('show');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
    }
});

window.onload = loadProducts;