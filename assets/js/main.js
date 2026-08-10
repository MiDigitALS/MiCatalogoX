// === SERVICE WORKER REGISTRATION ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.error('Error al registrar el Service Worker', err));
    });
}

// === LÓGICA MAESTRA ===

// 1. TUS CREDENCIALES
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx27ehEycCOiHqyYOmPHNYQ7w_ZYluYA8wkdI2G_4PuzHqciyXYuftYqCUmuncpYaeRcQ/exec";

document.addEventListener("DOMContentLoaded", () => {
    // Hace que cualquier textarea con la clase textarea-auto ajuste su altura
    const autoResizeTextareas = document.querySelectorAll('.textarea-auto');
    autoResizeTextareas.forEach(tx => {
        tx.addEventListener('input', function() {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";
        });
    });
});

// 2. MULTI-EMPRENDEDOR AISLADO: Crear una memoria única basada en la carpeta
const currentFolder = window.location.pathname.split('/').filter(Boolean)[0] || 'root';
const storageKey = 'tienda_guardada_' + currentFolder;

const _urlParams = new URLSearchParams(window.location.search);
let SHOP_ID = _urlParams.get('shop');

if (SHOP_ID) {
    localStorage.setItem(storageKey, SHOP_ID);
} else {
    SHOP_ID = localStorage.getItem(storageKey);
}

window.LINK_CLIENTES = window.location.href.split('?')[0] + (SHOP_ID ? `?shop=${SHOP_ID}` : '');

let WHATSAPP_EMPRENDEDOR = "";
let MONEDA = "$";
let SUBTITULO_TIENDA = "Mi Catálogo Digital"; // Nueva variable global para recordar el subtítulo real

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

// 3. DETECCIÓN DE MODO
const IS_ADMIN = window.location.href.includes('admin=true');
if (IS_ADMIN) {
    document.body.classList.remove('modo-cliente');
    document.body.classList.add('modo-admin');
    document.getElementById('headerSubtitle').innerText = "PANEL DE ADMINISTRACIÓN";

    const btnToggle = document.getElementById('btnToggleMode');
    if (btnToggle) btnToggle.style.display = "flex";
}

// 4. VARIABLES GLOBALES Y UTILIDADES
let products = [], categories = [];
let currentCategory = 'todas', currentDetailId = null, visibilityState = 0;

function formatPrice(num) { return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Función para convertir color HEX a RGB para las sombras CSS
function hexToRgb(hex) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(', ');
    }
    return "31, 58, 90"; // Color primario por defecto en caso de error
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
        const url = SHOP_ID ? `${SCRIPT_URL}?shop=${SHOP_ID}` : SCRIPT_URL;
        const response = await fetch(url);
        const data = await response.json();

        // Si el catálogo está desactivado en Sheets, mostramos la pantalla de mantenimiento
        if (data.status === "inactive") {
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
        WHATSAPP_EMPRENDEDOR = data.whatsapp ? data.whatsapp.toString().replace(/[^0-9]/g, '') : "";
        
        // --- 1. PERSONALIZACIÓN DE MARCA Y TEXTOS ---
        const mainTitle = data.nombre_tienda || "MiCatálogoX";
        SUBTITULO_TIENDA = data.subtitulo_tienda || "Mi Catálogo Digi"; // Guardamos el subtítulo real aquí

        const titleEl = document.getElementById('headerTitle');
        const subtitleEl = document.getElementById('headerSubtitle');

        // Inyectamos el título como HTML para permitir etiquetas (<span>, <br>, etc.) desde GSheets
        if (titleEl) {
            titleEl.innerHTML = mainTitle;
        }

        // Para el título de la pestaña del navegador, le quitamos las etiquetas HTML para que se vea limpio
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = mainTitle;
        document.title = tempDiv.textContent || tempDiv.innerText || "Catálogo";

        if (!IS_ADMIN && subtitleEl) {
            subtitleEl.innerText = SUBTITULO_TIENDA;
        }

        // Logo
        const logoEl = document.getElementById('headerLogo');
        if (logoEl) {
            if (data.logo_url && data.logo_url.trim() !== "") {
                logoEl.src = data.logo_url;
                logoEl.style.display = "block";
            } else {
                logoEl.style.display = "none";
            }
        }

        // Variables de Color (Inyectadas en CSS :root)
        const root = document.documentElement;
        if (data.color_primario) {
            root.style.setProperty('--primary', data.color_primario);
            root.style.setProperty('--primary-rgb', hexToRgb(data.color_primario));
        }
        if (data.color_acento) {
            root.style.setProperty('--accent', data.color_acento);
            root.style.setProperty('--accent-rgb', hexToRgb(data.color_acento));
        }
        if (data.color_fondo) {
            root.style.setProperty('--bg-body', data.color_fondo);
        }
        // ---------------------------------------------

        const placeholderSheet = data.placeholder || data.texto_placeholder || data.Placeholder;
        TEXTO_PLACEHOLDER = (placeholderSheet && placeholderSheet.toString().trim() !== "")
            ? placeholderSheet.toString().trim()
            : "Tu nombre y apellido...";

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
        } else {
            PROMO_ACTIVO = false;
        }

        const nameInput = document.getElementById('customerName');
        if (nameInput) {
            nameInput.placeholder = TEXTO_PLACEHOLDER;
            nameInput.setAttribute("placeholder", TEXTO_PLACEHOLDER);
        }

        categories = data.categorias;
        products = data.productos.map(item => ({
            id: item.id, name: item.nombre, cat: item.categoria ? item.categoria.toLowerCase() : '',
            price: parseFloat(item.precio) || 0, desc: item.descripcion, img: item.imagen,
            available: (item.activo === "SÍ" || item.activo === "SI" || item.activo === true), qty: 0
        }));

        renderCategoriesUI();
        renderProducts();
        updateCartBar();

        renderCategoriesUI();
        renderProducts();
        updateCartBar();

        // === DISPARADOR DEL TUTORIAL DEL EMPRENDEDOR ===
        if (IS_ADMIN && !localStorage.getItem('tutorial_admin_visto_' + currentFolder)) {
            mostrarTutorialAdmin();
        }

    } catch (error) {
        console.error("Error cargando productos:", error);
        document.getElementById('productGrid').innerHTML = `<div class="empty-state">Error de conexión.</div>`;
    }
}

async function saveCurrency() {
    const newVal = document.getElementById('currencyInput').value.trim() || "$";
    const btn = document.getElementById('btnSaveCurrency');

    MONEDA = newVal;
    renderProducts();
    updateCartBar();

    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action: "updateCurrency", moneda: MONEDA, shop: SHOP_ID }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: "follow"
        });

        btn.style.backgroundColor = 'var(--success)';
        btn.innerText = "¡Listo!";
    } catch (e) {
        console.error("Error al guardar moneda:", e);
        btn.innerText = "Error";
    } finally {
        setTimeout(() => {
            btn.style.backgroundColor = 'var(--accent)';
            btn.innerText = "Guardar";
            btn.disabled = false;
        }, 2000);
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
            let mostrarPromo = true; // Por defecto mostramos la promo
            if (products.filter(p => p.available).length === 0) {
                mensajeVacio = `<div class="empty-state large"><div class="empty-icon">🛍️</div><h3 class="empty-title">Catálogo en preparación</h3><p class="empty-desc">Aún no hemos publicado nuestros productos. ¡Vuelve muy pronto!</p></div>`;
                mostrarPromo = false; // Si no hay NINGÚN producto en la tienda, ocultamos la promo
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
            grid.innerHTML += `
                <div class="card ${hiddenClass}" onclick="openFormModal('${p.id}')">
                    ${badge}
                    <img src="${p.img}" class="card-img">
                    <div class="card-title">${p.name}</div>
                    <div class="card-desc">${p.desc}</div>
                    <div class="card-footer">
                        <div class="price">${MONEDA} ${formatPrice(p.price)}</div>
                        <div class="controls-wrapper">
                            <button class="btn-add admin-edit">EDITAR</button>
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

function changeAdminVisibilityFilter(val) {
    visibilityState = parseInt(val) || 0;
    renderProducts();
}

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

            // En vez de Blob, devolvemos Base64 directamente
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

    if (decPart !== null) {
        e.target.value = intPart + ',' + decPart.substring(0, 2);
    } else {
        e.target.value = intPart;
    }
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
        document.getElementById('btnEliminar').style.display = 'grid';
        btnGuardar.innerText = "Actualizar";

        if (prodDescTx) {
        prodDescTx.style.height = "auto";
        prodDescTx.style.height = prodDescTx.scrollHeight + "px";
    }
    if (prodNameTx) {
        prodNameTx.style.height = "auto";
        prodNameTx.style.height = prodNameTx.scrollHeight + "px";
    }
    } else {
        document.getElementById('editId').value = "";
        document.getElementById('oldImgUrl').value = "";
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

        const datos = {
            action: itemId ? "update" : "create", id: itemId,
            nombre: document.getElementById('prodName').value, 
            categoria: document.getElementById('prodCat').value,
            precio: getRawPrice(),
            descripcion: document.getElementById('prodDesc').value,
            imagen: finalImg, 
            imageBase64: base64String, // Se envía a Drive
            activo: document.getElementById('prodActivo').checked ? "SÍ" : "NO",
            shop: SHOP_ID
        };

        try {
            const response = await fetch(SCRIPT_URL, { 
                method: "POST", 
                body: JSON.stringify(datos), 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                redirect: "follow" 
            });

            const resData = await response.json();

            if (resData.status === "error") {
                showAlert("Error de Drive", resData.msg);
            } else {
                closeFormModal();
                loadProducts();
            }
        } catch (error) {
            showAlert("Error de guardado", "Hubo un problema de conexión al guardar el producto.");
        } finally {
            btn.innerText = itemId ? "Actualizar" : "Guardar Nuevo";
            btn.disabled = false;
        }
    });
}

async function executeDelete() {
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
        list.innerHTML += `<div class="ticket-item"><div class="flex-1"><div class="ticket-name">${p.name}</div><div class="ticket-unit-price">${MONEDA} ${formatPrice(p.price)} c/u</div></div><div class="ticket-stepper"><button onclick="updateQty('${p.id}', -1)">-</button><span>${p.qty}</span><button onclick="updateQty('${p.id}', 1)">+</button></div><div class="ticket-subtotal">${MONEDA} ${formatPrice(sub)}</div></div>`;
    });
    document.getElementById('ticketTotalAmount').innerText = `${MONEDA} ${formatPrice(total)}`;
}

function executeResetCart() { products.forEach(p => p.qty = 0); document.getElementById('customerName').value = ''; renderProducts(); updateCartBar(); document.getElementById('confirmResetModal').classList.remove('show'); closeCartModal(); }

function sendWhatsAppClient() {
    if (!WHATSAPP_EMPRENDEDOR) {
        showAlert("Atención", "El emprendedor aún no ha configurado su número de WhatsApp.");
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    if (!name) { document.getElementById('nameError').style.display = 'block'; document.getElementById('customerName').focus(); return; }

    let msg = TEXTO_MENSAJE.replace('{nombre}', name);
    if (!msg.includes(name)) msg = msg + `\nDatos del cliente: *${name}*\n\n`;

    let total = 0;
    products.filter(p => p.qty > 0).forEach(p => {
        const sub = p.qty * p.price;
        total += sub;
        msg += `✔ ${p.qty}x ${p.name} - ${MONEDA} ${formatPrice(sub)}\n`;
    });

    msg += `\n*TOTAL: ${MONEDA} ${formatPrice(total)}*\n\n¡Gracias!`;
    openWhatsApp(WHATSAPP_EMPRENDEDOR, msg);
}

function renderCategoriesUI() {
    const container = document.getElementById('categoryContainer'), select = document.getElementById('prodCat');
    let html = `<button class="cat-btn ${currentCategory === 'todas' ? 'active' : ''}" onclick="setCategory('todas', this)">TODOS</button>`;
    let options = "";
    categories.forEach(cat => {
        const catId = cat.toLowerCase(); html += `<button class="cat-btn ${currentCategory === catId ? 'active' : ''}" onclick="setCategory('${catId}', this)">${cat}</button>`;
        options += `<option value="${catId}">${cat}</option>`;
    });
    container.innerHTML = html; select.innerHTML = options;
}

function renderCategoryManagerList() {
    const list = document.getElementById('categoryManagerList'); list.innerHTML = "";
    categories.forEach(cat => {
        list.innerHTML += `<div class="cat-list-item"><span class="cat-list-name">${cat}</span><div class="cat-list-actions"><button onclick="editCategory('${cat}')" class="btn-text-edit">Editar</button><button onclick="deleteCategory('${cat}')" class="btn-text-delete">Borrar</button></div></div>`;
    });
}

function openCategoryManager() {
    const select = document.getElementById('currencyInput');
    if (select.querySelector(`option[value="${MONEDA}"]`)) { select.value = MONEDA; } else { select.value = "$"; }
    const visSelect = document.getElementById('visibilityInput');
    if (visSelect) visSelect.value = visibilityState.toString();

    renderCategoryManagerList();
    document.getElementById('categoryManagerModal').classList.add('show');
}

async function addCategory() {
    const name = document.getElementById('newCatName').value.trim(); if (!name) return;
    categories.push(name); renderCategoryManagerList(); renderCategoriesUI(); document.getElementById('newCatName').value = "";
    await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "addCategory", nombre: name, shop: SHOP_ID }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: "follow" });
    loadProducts();
}

function editCategory(oldName) {
    document.getElementById('labelOldCat').innerText = oldName; document.getElementById('oldCatNameHolder').value = oldName;
    document.getElementById('editCatInput').value = oldName; document.getElementById('editCategoryModal').classList.add('show');
    setTimeout(() => document.getElementById('editCatInput').focus(), 300);
}

async function executeEditCategory() {
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
    document.getElementById('labelDelCat').innerText = `"${name}"`; document.getElementById('delCatNameHolder').value = name;
    document.getElementById('confirmDeleteCategoryModal').classList.add('show');
}

async function executeDeleteCategory() {
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
        if (subtitle) subtitle.innerText = SUBTITULO_TIENDA; // Usar el subtítulo real de la tienda
        if (previewBadge) previewBadge.style.display = "flex"; 
    } else {
        body.classList.remove('modo-cliente');
        body.classList.add('modo-admin');
        if (subtitle) subtitle.innerText = "PANEL DE ADMINISTRACIÓN";
        if (previewBadge) previewBadge.style.display = "none"; 
    }
    renderProducts();
    updateCartBar();
}

// Función para ejecutar la acción de la Publicidad Global
function ejecutarPromoAccion() {
    if (PROMO_LINK && PROMO_LINK.trim() !== "") {
        // Abre el link configurado en Google Sheets en una nueva pestaña
        window.open(PROMO_LINK, '_blank');
    } else {
        // Si por error no hay link en el GSheets, solo cierra el modal
        document.getElementById('promoModal').classList.remove('show');
    }
}

// === MÓDULO DE ESTADÍSTICAS SILENCIOSAS ===

// Función para enviar el dato a Google Sheets sin interrumpir al usuario
function registrarEstadistica(evento) {
    if (!SHOP_ID) return; // Si no hay tienda, no registramos
    const datosStats = { action: "analytics", shop: SHOP_ID, evento: evento };
    fetch(SCRIPT_URL, { 
        method: "POST", 
        body: JSON.stringify(datosStats), 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).catch(e => console.log("Stats error ignorado"));
}

// 1. Rastrear Instalaciones (Cuando el usuario le da a "Instalar App")
window.addEventListener('appinstalled', (evt) => {
    registrarEstadistica("APP INSTALADA");
});

// 2. Rastrear Uso (Detectar si entró desde la App instalada o desde el link web)
window.addEventListener('DOMContentLoaded', () => {
    // Retrasamos 3 segundos el registro para asegurar que la página haya cargado
    setTimeout(() => {
        // Verifica si la pantalla se está mostrando como "Standalone" (es decir, como App nativa)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            registrarEstadistica("VISITA DESDE LA APP");
        } else {
            // Si quieres también registrar las visitas desde el navegador web, descomenta la línea de abajo:
            // registrarEstadistica("VISITA DESDE LA WEB");
        }
    }, 3000);
});

// === FUNCIÓN DE BIENVENIDA Y TUTORIAL DEL ADMINISTRADOR ===
function mostrarTutorialAdmin() {
    // Configura aquí tus diapositivas (puedes subir las capturas de pantalla a tu carpeta de Google Drive y pegar sus links aquí)
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

    // Crear el fondo del modal (Overlay)
    const overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(18, 33, 51, 0.9); backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px); z-index: 2000; 
        display: flex; align-items: center; justify-content: center;
        font-family: 'Outfit', sans-serif; padding: 20px; box-sizing: border-box;
    `;

    // Crear la caja del contenido (Card)
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

    // Función para renderizar cada diapositiva en pantalla
    function renderSlide() {
        const slide = slides[currentSlide];
        content.innerHTML = `
            <button id="closeTutorialBtn" style="position: absolute; top: 15px; right: 15px; background: #F1F5F9; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 14px; font-weight: bold; color: #1F3A5A; display: flex; align-items: center; justify-content: center;">✕</button>
            <img src="${slide.img}" style="width: 100%; height: auto; object-fit: contain; border-radius: 14px; margin-bottom: 20px; background: #F8FAFC; padding: 10px; box-sizing: border-box;" alt="Tutorial">
            <h3 style="font-size: 18px; font-weight: 700; color: #1F3A5A; margin-bottom: 8px;">${slide.title}</h3>
            <p style="font-size: 13px; color: #7E93A8; line-height: 1.5; margin-bottom: 24px; min-height: 60px;">${slide.desc}</p>
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; gap: 15px;">
                <span style="font-size: 11px; font-weight: 700; color: #7E93A8; text-transform: uppercase; letter-spacing: 0.5px;">Paso ${currentSlide + 1} de ${slides.length}</span>
                <button id="nextTutorialBtn" style="background: #E98C30; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; transition: transform 0.2s;">
                    ${currentSlide === slides.length - 1 ? 'Empezar' : 'Siguiente'}
                </button>
            </div>
        `;

        // Eventos de los botones
        document.getElementById('closeTutorialBtn').onclick = finalizarTutorial;
        document.getElementById('nextTutorialBtn').onclick = () => {
            if (currentSlide === slides.length - 1) {
                finalizarTutorial();
            } else {
                currentSlide++;
                renderSlide();
            }
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
