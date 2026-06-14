function formatPrice(price) {
    if (isNaN(price)) price = 0;
    return new Intl.NumberFormat('ru-RU').format(price);
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Toast уведомления
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || (() => {
        const div = document.createElement('div');
        div.id = 'toast-container';
        div.className = 'toast-container';
        document.body.appendChild(div);
        return div;
    })();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${escapeHtml(message)}</span><span class="toast-close">&times;</span>`;
    container.appendChild(toast);
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => toast.remove();
    setTimeout(() => toast.remove(), 4000);
}

// Кастомное модальное окно для ввода числа
function showNumberInputModal(title, defaultValue, min, max, callback) {
    const modalHtml = `
        <div id="custom-number-modal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:2000; display:flex; align-items:center; justify-content:center;">
            <div style="background:white; max-width:400px; width:90%; border-radius:24px; padding:2rem;">
                <h3>${escapeHtml(title)}</h3>
                <input type="number" id="modal-number-input" value="${defaultValue}" min="${min}" max="${max}" style="width:100%; padding:0.5rem; margin:1rem 0; border-radius:8px; border:1px solid #ccc;">
                <div style="display:flex; gap:1rem;">
                    <button id="modal-number-ok" class="btn">OK</button>
                    <button id="modal-number-cancel" class="btn-outline">Отмена</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('custom-number-modal');
    const input = document.getElementById('modal-number-input');
    const okBtn = document.getElementById('modal-number-ok');
    const cancelBtn = document.getElementById('modal-number-cancel');
    const closeModal = () => modal.remove();
    okBtn.onclick = () => {
        const value = parseInt(input.value);
        if (!isNaN(value) && value >= min && value <= max) {
            callback(value);
            closeModal();
        } else {
            showToast(`Введите число от ${min} до ${max}`, 'error');
        }
    };
    cancelBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

// Глобальные действия
window.goToProduct = (id, term = null) => {
    if (term) sessionStorage.setItem('selected_term_' + id, term);
    router.navigate(`/product/${id}`);
};

window.addToCartAction = async (id) => {
    try {
        let leaseTerm = sessionStorage.getItem('selected_term_' + id);
        if (!leaseTerm) {
            const product = await getProduct(id);
            leaseTerm = product.lease_term_min;
            sessionStorage.setItem('selected_term_' + id, leaseTerm);
        }
        const res = await addToCart(id, parseInt(leaseTerm));
        if (res.success) showToast('✅ Добавлено в корзину', 'success');
        else showToast(res.message || 'Ошибка', 'error');
    } catch(e) { showToast(e.message, 'error'); }
};

window.addToFavAction = async (id) => {
    try {
        const res = await addToFavorites(id);
        if (res.success) showToast('❤️ Добавлено в избранное', 'success');
        else showToast(res.message || 'Ошибка', 'error');
    } catch(e) { showToast(e.message, 'error'); }
};

window.removeCartItem = async (cartId) => {
    await removeFromCart(cartId);
    router.navigate('/cart');
};

window.removeFavItem = async (favId) => {
    await removeFromFavorites(favId);
    router.navigate('/favorites');
};

window.requestOrderAction = async (orderId, type) => {
    if (type === 'extend') {
        showNumberInputModal('Продление договора', 6, 1, 60, async (months) => {
            try {
                await extendOrder(orderId);
                showToast(`Запрос на продление на ${months} месяцев отправлен администратору`, 'success');
            } catch(e) { showToast(e.message, 'error'); }
        });
    } else if (type === 'return') {
        try {
            await returnOrder(orderId);
            showToast('Запрос на возврат отправлен администратору', 'success');
        } catch(e) { showToast(e.message, 'error'); }
    } else if (type === 'buyout') {
        try {
            await buyoutOrder(orderId);
            showToast('Запрос на выкуп отправлен администратору', 'success');
        } catch(e) { showToast(e.message, 'error'); }
    }
};

// Оплата
window.processPayment = async (orderId, amount) => {
    try {
        console.log('processPayment called', orderId, amount);
        const res = await makePayment(orderId, amount);
        console.log('Payment response:', res);
        if (res && res.success === true) {
            showToast(`Оплата ${formatPrice(amount)} ₽ прошла успешно!`, 'success');
            router.navigate('/profile');
        } else {
            const errMsg = res && res.message ? res.message : 'Неизвестная ошибка';
            showToast(errMsg, 'error');
        }
    } catch(e) {
        console.error(e);
        showToast(e.message, 'error');
    }
};

// Инициализация калькулятора
function initProductCalculator(product) {
    const slider = document.getElementById('term-slider');
    if (!slider) return;
    const termSpan = document.getElementById('term-value');
    const paymentSpan = document.getElementById('payment-display');
    const price = parseFloat(product.price);
    let advancePercent = parseFloat(product.advance_percent) || 20;
    let residualPercent = parseFloat(product.residual_percent) || 10;
    if (advancePercent + residualPercent >= 100) {
        advancePercent = 20;
        residualPercent = 10;
    }
    const minTerm = parseInt(product.lease_term_min);
    const maxTerm = parseInt(product.lease_term_max);
    const productId = product.id;

    function updatePayment() {
        let term = parseInt(slider.value);
        term = Math.max(minTerm, Math.min(maxTerm, term)); // ограничение диапазона
        slider.value = term;
        if (termSpan) termSpan.textContent = term;
        const advance = price * advancePercent / 100;
        const residual = price * residualPercent / 100;
        let amountToLease = price - advance - residual;
        if (amountToLease <= 0) amountToLease = price * 0.7; // защита от некорректных процентов
        const payment = amountToLease / term;
        if (paymentSpan) paymentSpan.textContent = formatPrice(payment);
        sessionStorage.setItem('selected_term_' + productId, term);
    }
    slider.addEventListener('input', updatePayment);
    updatePayment();
}

function renderProductCard(product, withButtons = true) {
    const id = parseInt(product.id);
    const price = parseFloat(product.price);
    const monthly = parseFloat(product.monthly_payment);
    return `
        <div class="product-card" data-id="${id}">
            <img src="uploads/${product.image || 'placeholder.jpg'}" alt="${escapeHtml(product.name)}">
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml((product.description || '').substring(0, 100))}...</p>
            <div class="price">${formatPrice(price)} ₽</div>
            <div class="monthly">от ${formatPrice(monthly)} ₽/мес</div>
            ${withButtons ? `
            <div class="card-buttons">
                <button class="btn" onclick="goToProduct(${id})">Подробнее</button>
                <button class="btn-small" onclick="addToCartAction(${id})"><i class="fas fa-cart-plus"></i></button>
                <button class="btn-small" onclick="addToFavAction(${id})"><i class="fas fa-heart"></i></button>
            </div>` : ''}
        </div>
    `;
}

function attachFormHandlers() {
    const filterForm = document.getElementById('filter-form');
    if (filterForm && !filterForm._listener) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(filterForm);
            const params = new URLSearchParams(formData).toString();
            window.location.hash = '#/catalog?' + params;
        });
        filterForm._listener = true;
    }
    const loginForm = document.getElementById('login-form');
    if (loginForm && !loginForm._listener) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[name="email"]').value;
            const password = loginForm.querySelector('input[name="password"]').value;
            try {
                const res = await login(email, password);
                if (res.success) router.navigate('/profile');
                else showToast(res.message, 'error');
            } catch(err) { showToast(err.message, 'error'); }
        });
        loginForm._listener = true;
    }
    const registerForm = document.getElementById('register-form');
    if (registerForm && !registerForm._listener) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = registerForm.querySelector('input[name="name"]').value;
            const email = registerForm.querySelector('input[name="email"]').value;
            const phone = registerForm.querySelector('input[name="phone"]').value;
            const password = registerForm.querySelector('input[name="password"]').value;
            try {
                const res = await register(name, email, phone, password);
                if (res.success) router.navigate('/profile');
                else showToast(res.message, 'error');
            } catch(err) { showToast(err.message, 'error'); }
        });
        registerForm._listener = true;
    }
}

// Делегирование для корзины
document.getElementById('app')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-cart-item')) {
        removeCartItem(e.target.dataset.cartId);
    }
});
document.getElementById('app')?.addEventListener('input', (e) => {
    if (e.target.classList.contains('cart-item-term')) {
        const cartId = e.target.dataset.cartId;
        const productId = e.target.dataset.productId;
        let term = parseInt(e.target.value);
        const min = parseInt(e.target.min);
        const max = parseInt(e.target.max);
        term = Math.max(min, Math.min(max, term));
        e.target.value = term;
        const price = parseFloat(e.target.dataset.price);
        const advancePercent = parseFloat(e.target.dataset.advance);
        const residualPercent = parseFloat(e.target.dataset.residual);
        const advance = price * advancePercent / 100;
        const residual = price * residualPercent / 100;
        let amount = price - advance - residual;
        if (amount <= 0) amount = price * 0.7;
        const payment = amount / term;
        const paymentSpan = document.querySelector(`.payment-display[data-cart-id="${cartId}"]`);
        const totalSpan = document.querySelector(`.total-display[data-cart-id="${cartId}"]`);
        if (paymentSpan) paymentSpan.textContent = formatPrice(payment);
        if (totalSpan) totalSpan.textContent = formatPrice(payment * term);
        sessionStorage.setItem('selected_term_' + productId, term);
        updateCartTerm(cartId, term).catch(console.warn);
    }
});


// Страницы
const pages = {
    home: async () => {
        const products = await getProducts();
        const latest = products.slice(0, 6);
        return `
            <div class="page-transition">
                <h1>Лизинг строительной техники <span style="color: var(--accent);">с выкупом</span></h1>
                <p>ПрофиЛизинг – надёжный партнёр. Аванс от 0%, индивидуальные графики, возможность продления.</p>
                <h2>Популярные предложения</h2>
                <div class="product-grid">${latest.map(p => renderProductCard(p)).join('')}</div>
                <div style="text-align:center; margin:2rem 0;">
                    <a href="#/catalog" class="btn"><i class="fas fa-arrow-right"></i> Весь каталог</a>
                </div>
            </div>
        `;
    },
    about: () => `<div class="page-transition"><h1>О компании</h1><p>ПрофиЛизинг с 2010 года. Надёжность и профессионализм.</p></div>`,
    contacts: () => `<div class="page-transition"><h1>Контакты</h1><p>Москва, ул. Лизинговая, 10<br>+7 (495) 123-45-67<br>info@profleasing.ru</p></div>`,
    delivery: () => `<div class="page-transition"><h1>Доставка</h1><p>Доставка по всей России от 2 до 7 дней.</p></div>`,
    
    catalog: async (params) => {
        const search = params.search || '';
        const min_price = params.min_price || '';
        const max_price = params.max_price || '';
        const min_term = params.min_term || '';
        const max_term = params.max_term || '';
        let products = await getProducts(search, min_price, max_price, min_term, max_term);
        return `
            <div class="page-transition">
                <h1>Каталог оборудования</h1>
                <form id="filter-form" class="filter-form">
                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
                        <input type="text" name="search" placeholder="Поиск" value="${escapeHtml(search)}">
                        <input type="number" name="min_price" placeholder="Цена от" value="${min_price}" step="100000">
                        <input type="number" name="max_price" placeholder="Цена до" value="${max_price}" step="100000">
                        <input type="number" name="min_term" placeholder="Срок от (мес)" value="${min_term}">
                        <input type="number" name="max_term" placeholder="Срок до (мес)" value="${max_term}">
                        <button type="submit"><i class="fas fa-filter"></i> Применить</button>
                    </div>
                </form>
                <div class="product-grid">
                    ${products.map(p => renderProductCard(p)).join('')}
                </div>
            </div>
        `;
    },
    
    product: async (params) => {
        const id = params.id;
        const product = await getProduct(id);
        if (!product) return '<div class="error">Товар не найден</div>';
        const price = parseFloat(product.price);
        const advancePercent = parseFloat(product.advance_percent) || 20;
        const residualPercent = parseFloat(product.residual_percent) || 10;
        const lease_term_min = parseInt(product.lease_term_min);
        const lease_term_max = parseInt(product.lease_term_max);
        const savedTerm = sessionStorage.getItem('selected_term_' + id);
        let defaultTerm = lease_term_min;
        if (savedTerm) defaultTerm = Math.min(lease_term_max, Math.max(lease_term_min, parseInt(savedTerm)));
        const advance = price * advancePercent / 100;
        const residual = price * residualPercent / 100;
        let amountToLease = price - advance - residual;
        if (amountToLease <= 0) amountToLease = price * 0.7;
        const defaultPayment = amountToLease / defaultTerm;
        return `
            <div class="page-transition">
                <h1>${escapeHtml(product.name)}</h1>
                <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                    <img src="uploads/${product.image || 'placeholder.jpg'}" style="max-width:400px; width:100%; border-radius:24px;">
                    <div style="flex:1;">
                        <p>${escapeHtml(product.description)}</p>
                        <p><strong>Полная стоимость:</strong> ${formatPrice(price)} ₽</p>
                        <p><strong>Аванс (${advancePercent}%):</strong> ${formatPrice(advance)} ₽</p>
                        <p><strong>Остаточная стоимость (${residualPercent}%):</strong> ${formatPrice(residual)} ₽</p>
                        <div class="calculator">
                            <h3>Калькулятор лизинга</h3>
                            <label>Срок (мес): </label>
                            <input type="range" id="term-slider" 
                                   min="${lease_term_min}" max="${lease_term_max}" value="${defaultTerm}" step="1">
                            <div style="margin-top:10px;"><span id="term-value">${defaultTerm}</span> мес.</div>
                            <p><strong>Ежемесячный платёж:</strong> <span id="payment-display">${formatPrice(defaultPayment)}</span> ₽</p>
                        </div>
                        <div style="margin-top:1.5rem;">
                            <button onclick="addToCartAction(${id})"><i class="fas fa-cart-plus"></i> В корзину</button>
                            <button onclick="addToFavAction(${id})" style="background:var(--secondary-emerald);"><i class="fas fa-heart"></i> В избранное</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    cart: async () => {
        const auth = await checkAuth();
        if (!auth.loggedIn) return '<div class="error">Для просмотра корзины <a href="#/login">войдите</a></div>';
        const cart = await getCart();
        if (!cart.items || cart.items.length === 0) return '<h1>Корзина пуста</h1><p><a href="#/catalog">Перейти в каталог</a></p>';
        
        let form = `<h1>Корзина</h1><form id="order-form"><div class="table-responsive"><table><thead><tr><th>Товар</th><th>Ежемесячный платёж</th><th>Срок (мес)</th><th>Сумма договора</th><th></th></tr></thead><tbody>`;
        for (const item of cart.items) {
            let selectedTerm = item.selected_lease_term || sessionStorage.getItem('selected_term_' + item.product_id);
            if (!selectedTerm) selectedTerm = item.lease_term_min;
            selectedTerm = parseInt(selectedTerm);
            const price = parseFloat(item.price);
            const advancePercent = parseFloat(item.advance_percent) || 20;
            const residualPercent = parseFloat(item.residual_percent) || 10;
            const advance = price * advancePercent / 100;
            const residual = price * residualPercent / 100;
            let amountToLease = price - advance - residual;
            if (amountToLease <= 0) amountToLease = price * 0.7;
            const payment = amountToLease / selectedTerm;
            const total = payment * selectedTerm;
            form += `<tr>
                <td>${escapeHtml(item.name)}</td>
                <td><span class="payment-display" data-cart-id="${item.cart_id}">${formatPrice(payment)}</span> ₽</td>
                <td><input type="number" class="cart-item-term" data-cart-id="${item.cart_id}" data-product-id="${item.product_id}" 
                           min="${item.lease_term_min}" max="${item.lease_term_max}" value="${selectedTerm}" 
                           style="width:100px;" data-price="${price}" 
                           data-advance="${advancePercent}" data-residual="${residualPercent}"></td>
                <td><span class="total-display" data-cart-id="${item.cart_id}">${formatPrice(total)}</span> ₽</td>
                <td><button type="button" class="btn-small remove-cart-item" data-cart-id="${item.cart_id}">Удалить</button></td>
            </tr>`;
        }
        form += `</tbody></table></div><button type="submit" class="btn"><i class="fas fa-file-signature"></i> Оформить договор</button></form>`;
        
        setTimeout(() => {
            const orderForm = document.getElementById('order-form');
            if (orderForm && !orderForm._listener) {
                orderForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const items = [];
                    document.querySelectorAll('.cart-item-term').forEach(input => {
                        const cartId = input.dataset.cartId;
                        const term = parseInt(input.value);
                        items.push({ cart_id: parseInt(cartId), lease_term: term });
                    });
                    try {
                        const res = await createOrder(items);
                        if (res.success) {
                            showToast('Заявка отправлена!', 'success');
                            router.navigate('/profile');
                        } else showToast(res.message, 'error');
                    } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
                });
                orderForm._listener = true;
            }
        }, 50);
        return form;
    },
    
    favorites: async () => {
        const auth = await checkAuth();
        if (!auth.loggedIn) return '<div class="error">Для просмотра избранного <a href="#/login">войдите</a></div>';
        const favs = await getFavorites();
        if (!favs.length) return '<h1>Избранное</h1><p>Здесь будут избранные товары</p>';
        return `<h1>Избранное</h1><div class="product-grid">${favs.map(fav => `
            <div class="product-card">
                <img src="uploads/${fav.image}" alt="${escapeHtml(fav.name)}">
                <h3>${escapeHtml(fav.name)}</h3>
                <div class="price">${formatPrice(fav.monthly_payment)} ₽/мес</div>
                <div class="card-buttons">
                    <button class="btn-small" onclick="goToProduct(${fav.product_id})">Перейти</button>
                    <button class="btn-small" onclick="removeFavItem(${fav.fav_id})">Удалить</button>
                </div>
            </div>
        `).join('')}</div>`;
    },
    
    profile: async () => {
        const auth = await checkAuth();
        if (!auth.loggedIn) return '<div class="error">Необходимо <a href="#/login">войти</a></div>';
        const orders = await getUserOrders();
        const statusMap = { 'new':'Новая','approved':'Одобрена','active':'Активен','returned':'Возвращён','bought_out':'Выкуплен','expired':'Просрочен' };
        let html = '<h2>Мои договоры лизинга</h2><div class="table-responsive"><table class="profile-table"><thead><tr><th>№ договора</th><th>Оборудование</th><th>Статус</th><th>Срок</th><th>Платёж/мес</th><th>Общая сумма</th><th>Выплачено</th><th>Дата окончания</th><th>Действия</th></tr></thead><tbody>';
        if (!orders.length) html += '<td><td colspan="9">Нет договоров</td></td>';
        for (const order of orders) {
            const monthly = parseFloat(order.monthly_payment);
            const total = parseFloat(order.total_amount);
            const paid = parseFloat(order.paid_amount) || 0;
            html += `<tr>
                <td>${escapeHtml(order.contract_number)}</td>
                <td>${escapeHtml(order.product_name)}</td>
                <td><span class="status-${order.status}">${statusMap[order.status]}</span></td>
                <td>${order.lease_term} мес.</td>
                <td>${formatPrice(monthly)} ₽</td>
                <td>${formatPrice(total)} ₽</td>
                <td>${formatPrice(paid)} ₽</td>
                <td>${order.end_date || '—'}</td>
                <td>${order.status === 'active' ? `
                    <button onclick="requestOrderAction(${order.id}, 'extend')" class="btn-small">Продлить</button>
                    <button onclick="requestOrderAction(${order.id}, 'return')" class="btn-small">Вернуть</button>
                    <button onclick="requestOrderAction(${order.id}, 'buyout')" class="btn-small">Выкупить</button>
                    <button onclick="processPayment(${order.id}, ${monthly})" class="btn-small">Оплатить</button>
                ` : (order.status === 'new' ? 'Ожидает одобрения' : '—')}</td>
            </tr>`;
        }
        html += '</tbody></table></div>';

        // История платежей и запросов
        let requestsHtml = '<h3>Мои запросы</h3><div class="table-responsive"><table class="profile-table"><thead><tr><th>Тип</th><th>Статус</th><th>Дата</th></tr></thead><tbody>';
        let paymentsHtml = '<h3>История платежей</h3><div class="table-responsive"><table class="profile-table"><thead><tr><th>Договор</th><th>Оборудование</th><th>Дата</th><th>Сумма</th></tr></thead><tbody>';
        try {
            const payments = await getPaymentHistory();
            if (payments && payments.length) {
                for (let p of payments) {
                    paymentsHtml += `<tr>
                        <td>${escapeHtml(p.contract_number || '—')}</td>
                        <td>${escapeHtml(p.product_name || '—')}</td>
                        <td>${p.payment_date || p.created_at || ''}</td>
                        <td>${formatPrice(p.amount)} ₽
                    </tr>`;
                }
            } else {
                paymentsHtml += '<tr><td colspan="4">Нет платежей</td></tr>';
            }
        } catch(e) { 
            console.warn(e);
            paymentsHtml += '<tr><td colspan="4">Ошибка загрузки</td></tr>';
        }
        paymentsHtml += '</tbody></table></div>';

        try {
            const requests = await getUserRequests();
            if (requests && requests.length) {
                for (let r of requests) {
                    let typeText = r.request_type === 'extend' ? 'Продление' : (r.request_type === 'return' ? 'Возврат' : 'Выкуп');
                    let statusText = r.status === 'pending' ? 'Ожидает' : (r.status === 'approved' ? 'Одобрен' : 'Отклонён');
                    requestsHtml += `<tr><td>${typeText}</td><td>${statusText}</td><td>${r.created_at || ''}</td></tr>`;
                }
            } else {
                requestsHtml += '<tr><td colspan="3">Нет запросов</td></tr>';
            }
        } catch(e) { requestsHtml += '<tr><td colspan="3">Ошибка загрузки</td></tr>'; }
        requestsHtml += '</tbody></table></div>';

        return `<div class="page-transition"><h1>Личный кабинет</h1><p>Здравствуйте, ${escapeHtml(auth.name)}!</p>${html}${paymentsHtml}${requestsHtml}</div>`;
    },
    
    login: async () => {
        if ((await checkAuth()).loggedIn) { router.navigate('/profile'); return ''; }
        return `
            <div class="page-transition">
                <h1>Вход / Регистрация</h1>
                <div id="auth-error" class="error" style="display:none"></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
                    <div><h3>Вход</h3><form id="login-form"><input type="email" name="email" placeholder="Email" required><input type="password" name="password" placeholder="Пароль" required><button type="submit"><i class="fas fa-sign-in-alt"></i> Войти</button></form></div>
                    <div><h3>Регистрация</h3><form id="register-form"><input type="text" name="name" placeholder="Имя" required><input type="email" name="email" placeholder="Email" required><input type="text" name="phone" placeholder="Телефон"><input type="password" name="password" placeholder="Пароль" required><button type="submit"><i class="fas fa-user-plus"></i> Зарегистрироваться</button></form></div>
                </div>
            </div>
        `;
    },
    
    admin: async () => {
        const auth = await checkAuth();
        if (!auth.loggedIn || auth.role !== 'admin') return '<div class="error">Доступ запрещён</div>';
        let orders = [], products = [], requests = [];
        try { orders = await adminGetOrders(); } catch(e){}
        try { products = await adminGetProducts(); } catch(e){}
        try { requests = await adminGetRequests(); } catch(e){}
        
        const renderOrders = () => {
            let html = '<h2>Договоры</h2><div class="table-responsive"><table class="admin-table"><thead>'
                + '<tr><th>№ договора</th><th>Клиент</th><th>Оборудование</th><th>Срок</th><th>Сумма</th><th>Выплачено</th><th>Статус</th><th>Дата окончания</th><th>Действия</th></tr>'
                + '</thead><tbody>';
            for (let o of orders) {
                html += `<tr>
                    <td>${escapeHtml(o.contract_number)}</td>
                    <td>${escapeHtml(o.user_name)}<br><small>${escapeHtml(o.user_email)}</small></td>
                    <td>${escapeHtml(o.product_name)}</td>
                    <td>${o.lease_term} мес.</td>
                    <td>${formatPrice(o.total_amount)} ₽</td>
                    <td>${formatPrice(o.paid_amount || 0)} ₽</td>
                    <td>
                        <select class="order-status" data-id="${o.id}">
                            <option value="new" ${o.status === 'new' ? 'selected' : ''}>Новая</option>
                            <option value="approved" ${o.status === 'approved' ? 'selected' : ''}>Одобрена</option>
                            <option value="active" ${o.status === 'active' ? 'selected' : ''}>Активен</option>
                            <option value="returned" ${o.status === 'returned' ? 'selected' : ''}>Возвращён</option>
                            <option value="bought_out" ${o.status === 'bought_out' ? 'selected' : ''}>Выкуплен</option>
                            <option value="expired" ${o.status === 'expired' ? 'selected' : ''}>Просрочен</option>
                        </select>
                    </td>
                    <td><input type="date" class="order-end-date" data-id="${o.id}" value="${o.end_date || ''}" style="width:120px;"></td>
                    <td>
                        <button class="view-payments-btn btn-small" data-id="${o.id}">Платежи</button>
                        <button class="save-order-btn btn-small" data-id="${o.id}">Сохранить</button>
                    </td>
                </tr>`;
            }
            html += '</tbody></table></div>';
            return html;
        };
        
        const renderProducts = () => {
            let html = `<div style="display:flex; justify-content:space-between;"><h2>Товары</h2><button id="add-product-btn" class="btn">+ Добавить</button></div>
                        <div class="table-responsive"><table class="admin-table"><thead><tr><th>ID</th><th>Фото</th><th>Название</th><th>Цена</th><th>Аванс%</th><th>Остаток%</th><th>Статус</th><th>Действия</th></tr></thead><tbody>`;
            for (let p of products) {
                html += `<tr>
                    <td>${p.id}</td>
                    <td><img src="uploads/${p.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;"></td>
                    <td>${escapeHtml(p.name)}</td>
                    <td>${formatPrice(p.price)} ₽</td>
                    <td>${p.advance_percent}%</td>
                    <td>${p.residual_percent}%</td>
                    <td>${p.status==1?'Активен':'Неактивен'}</td>
                    <td><button class="edit-product-btn btn-small" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-product-btn btn-small" data-id="${p.id}" style="background:#dc3545;"><i class="fas fa-trash"></i></button></td>
                </tr>`;
            }
            html += '</tbody></table></div>';
            return html;
        };
        
        const renderRequests = () => {
            let html = '<h2>Запросы клиентов</h2><div class="table-responsive"><table class="admin-table"><thead><tr><th>Клиент</th><th>Оборудование</th><th>Тип</th><th>Статус</th><th>Дата</th><th>Действие</th></tr></thead><tbody>';
            for (let r of requests) {
                html += `<tr>
                    <td>${escapeHtml(r.user_name)}</td>
                    <td>${escapeHtml(r.product_name)}</td>
                    <td>${r.request_type==='extend'?'Продление':(r.request_type==='return'?'Возврат':'Выкуп')}</td>
                    <td><select class="request-status" data-id="${r.id}">
                        <option value="pending" ${r.status==='pending'?'selected':''}>Ожидает</option>
                        <option value="approved" ${r.status==='approved'?'selected':''}>Одобрен</option>
                        <option value="rejected" ${r.status==='rejected'?'selected':''}>Отклонён</option>
                    </select></td>
                    <td>${r.created_at}</td>
                    <td><button class="save-request-btn btn-small" data-id="${r.id}">Сохранить</button></td>
                </tr>`;
            }
            html += '</tbody></table></div>';
            return html;
        };
        
        const getProductModal = () => `
            <div id="product-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                <div style="background:white; max-width:600px; width:90%; max-height:90vh; overflow:auto; border-radius:24px; padding:2rem;">
                    <h3 id="modal-title">Новый товар</h3>
                    <form id="product-form" enctype="multipart/form-data">
                        <input type="hidden" name="id" value="0">
                        <label>Название</label><input type="text" name="name" required>
                        <label>Описание</label><textarea name="description" rows="3"></textarea>
                        <label>Полная стоимость (₽)</label><input type="number" name="price" step="0.01" required>
                        <label>Ежемесячный платёж (каталог)</label><input type="number" name="monthly_payment" step="0.01" required>
                        <label>Мин. срок (мес)</label><input type="number" name="lease_term_min" required>
                        <label>Макс. срок (мес)</label><input type="number" name="lease_term_max" required>
                        <label>Аванс (%)</label><input type="number" name="advance_percent" step="0.1" value="20" required>
                        <label>Остаточная стоимость (%)</label><input type="number" name="residual_percent" step="0.1" value="10" required>
                        <label>Статус</label><select name="status"><option value="1">Активен</option><option value="0">Неактивен</option></select>
                        <label>Изображение (файл)</label><input type="file" name="image_file" accept="image/jpeg,image/png,image/webp">
                        <label>Или URL изображения</label><input type="text" name="image_url" placeholder="https://example.com/photo.jpg">
                        <input type="hidden" name="existing_image" value="">
                        <div class="current-image-preview"></div>
                        <div style="margin-top:1rem;"><button type="submit" class="btn">Сохранить</button> <button type="button" id="close-modal" class="btn-outline">Отмена</button></div>
                    </form>
                </div>
            </div>`;
        
        let html = `<div class="page-transition"><h1>Админ-панель</h1><div class="admin-tabs" style="display:flex; gap:1rem; border-bottom:1px solid #ddd; margin-bottom:1rem;"><button class="admin-tab active" data-tab="orders">Договоры</button><button class="admin-tab" data-tab="products">Товары</button><button class="admin-tab" data-tab="requests">Запросы</button></div>
            <div id="orders-panel" class="admin-panel">${renderOrders()}</div>
            <div id="products-panel" class="admin-panel" style="display:none;">${renderProducts()}</div>
            <div id="requests-panel" class="admin-panel" style="display:none;">${renderRequests()}</div>
            ${getProductModal()}
        </div>`;
        
        setTimeout(() => {
            // Вкладки
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.onclick = () => {
                    document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
                    tab.classList.add('active');
                    const target = tab.dataset.tab;
                    document.getElementById('orders-panel').style.display = target==='orders'?'block':'none';
                    document.getElementById('products-panel').style.display = target==='products'?'block':'none';
                    document.getElementById('requests-panel').style.display = target==='requests'?'block':'none';
                    if (target === 'products') {
                        adminGetProducts().then(newProducts => {
                            products = newProducts;
                            document.getElementById('products-panel').innerHTML = renderProducts();
                            attachProductHandlers();
                        });
                    }
                };
            });
            // Сохранение заказов
            document.querySelectorAll('.save-order-btn').forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    const status = document.querySelector(`.order-status[data-id="${id}"]`).value;
                    const end_date = document.querySelector(`.order-end-date[data-id="${id}"]`).value;
                    const res = await adminUpdateOrderStatus(id, status, end_date);
                    showToast(res.success ? 'Сохранено' : 'Ошибка', res.success ? 'success' : 'error');
                };
            });
            // Обработчик кнопок Платежи
            document.querySelectorAll('.view-payments-btn').forEach(btn => {
                btn.onclick = async () => {
                    const orderId = btn.dataset.id;
                    try {
                        const payments = await adminGetOrderPayments(orderId);
                        let modalHtml = `
                            <div id="payments-modal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:2000; display:flex; align-items:center; justify-content:center;">
                                <div style="background:white; max-width:600px; width:90%; border-radius:24px; padding:2rem; max-height:80vh; overflow:auto;">
                                    <h3>Платежи по договору</h3>
                                    <table class="admin-table"><thead><tr><th>Дата</th><th>Сумма</th></tr></thead><tbody>
                        `;
                        if (payments && payments.length) {
                            for (let p of payments) {
                                modalHtml += `<tr><td>${p.payment_date}</td><td>${formatPrice(p.amount)} ₽</td></tr>`;
                            }
                        } else {
                            modalHtml += `<tr><td colspan="2">Нет платежей</td></tr>`;
                        }
                        modalHtml += `</tbody></table><button id="close-payments-modal" class="btn-outline" style="margin-top:1rem;">Закрыть</button></div></div>`;
                        document.body.insertAdjacentHTML('beforeend', modalHtml);
                        const modal = document.getElementById('payments-modal');
                        const closeBtn = document.getElementById('close-payments-modal');
                        closeBtn.onclick = () => modal.remove();
                        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                    } catch(e) {
                        showToast('Ошибка загрузки платежей', 'error');
                    }
                };
            });
            // Сохранение запросов
            document.querySelectorAll('.save-request-btn').forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    const status = document.querySelector(`.request-status[data-id="${id}"]`).value;
                    const res = await adminUpdateRequestStatus(id, status);
                    showToast(res.success ? 'Сохранено' : 'Ошибка', res.success ? 'success' : 'error');
                };
            });
            // Управление товарами
            const attachProductHandlers = () => {
                const addBtn = document.getElementById('add-product-btn');
                if (addBtn) {
                    addBtn.onclick = () => {
                        const modal = document.getElementById('product-modal');
                        const form = document.getElementById('product-form');
                        form.reset();
                        document.querySelector('#product-modal input[name="id"]').value = 0;
                        document.querySelector('#product-modal .current-image-preview').innerHTML = '';
                        document.getElementById('modal-title').innerText = 'Новый товар';
                        modal.style.display = 'flex';
                    };
                }
                document.querySelectorAll('.edit-product-btn').forEach(btn => {
                    btn.onclick = async () => {
                        const id = parseInt(btn.dataset.id);
                        const freshProducts = await adminGetProducts();
                        const product = freshProducts.find(p => p.id == id);
                        if (product) {
                            const modal = document.getElementById('product-modal');
                            modal.querySelector('input[name="id"]').value = product.id;
                            modal.querySelector('input[name="name"]').value = product.name;
                            modal.querySelector('textarea[name="description"]').value = product.description || '';
                            modal.querySelector('input[name="price"]').value = product.price;
                            modal.querySelector('input[name="monthly_payment"]').value = product.monthly_payment;
                            modal.querySelector('input[name="lease_term_min"]').value = product.lease_term_min;
                            modal.querySelector('input[name="lease_term_max"]').value = product.lease_term_max;
                            modal.querySelector('input[name="advance_percent"]').value = product.advance_percent;
                            modal.querySelector('input[name="residual_percent"]').value = product.residual_percent;
                            modal.querySelector('select[name="status"]').value = product.status;
                            modal.querySelector('input[name="existing_image"]').value = product.image;
                            const previewDiv = modal.querySelector('.current-image-preview');
                            previewDiv.innerHTML = product.image ? `<img src="uploads/${product.image}" style="max-width:100px; margin-bottom:10px;">` : '';
                            document.getElementById('modal-title').innerText = 'Редактирование товара';
                            modal.style.display = 'flex';
                        } else {
                            showToast('Товар не найден', 'error');
                        }
                    };
                });
                document.querySelectorAll('.delete-product-btn').forEach(btn => {
                    btn.onclick = async () => {
                        if (confirm('Удалить товар?')) {
                            await adminDeleteProduct(parseInt(btn.dataset.id));
                            showToast('Товар удалён', 'success');
                            const newProducts = await adminGetProducts();
                            products = newProducts;
                            document.getElementById('products-panel').innerHTML = renderProducts();
                            attachProductHandlers();
                        }
                    };
                });
            };
            attachProductHandlers();
            
            const productForm = document.getElementById('product-form');
            const modal = document.getElementById('product-modal');
            const closeModal = document.getElementById('close-modal');
            if (productForm) {
                productForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const fd = new FormData(productForm);
                    const res = await adminSaveProduct(fd);
                    if (res.success) {
                        showToast('Сохранено', 'success');
                        modal.style.display = 'none';
                        const newProducts = await adminGetProducts();
                        products = newProducts;
                        document.getElementById('products-panel').innerHTML = renderProducts();
                        attachProductHandlers();
                    } else {
                        showToast(res.message || 'Ошибка сохранения', 'error');
                    }
                };
            }
            if (closeModal) closeModal.onclick = () => modal.style.display = 'none';
            modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        }, 100);
        return html;
    }
};

// Роутер
class Router {
    constructor() {
        this.routes = {
            '/':'home','/about':'about','/catalog':'catalog','/product/:id':'product',
            '/cart':'cart','/favorites':'favorites','/profile':'profile','/login':'login',
            '/contacts':'contacts','/delivery':'delivery','/admin':'admin'
        };
        window.addEventListener('hashchange', () => this.handleHash());
        this.handleHash();
    }
    handleHash() {
        let hash = window.location.hash.slice(1);
        if (!hash || hash === '') hash = '/';
        this.navigate(hash);
    }
    async navigate(path, params = {}) {
        let query = {}, cleanPath = path;
        if (path.includes('?')) { let [p,q] = path.split('?'); cleanPath = p; new URLSearchParams(q).forEach((v,k)=>query[k]=v); }
        let matched = null, routeParams = {};
        for (let route in this.routes) {
            let regex = new RegExp('^' + route.replace(/:[^\s/]+/g, '([\\w-]+)') + '$');
            let match = cleanPath.match(regex);
            if (match) {
                matched = this.routes[route];
                let keys = (route.match(/:[^\s/]+/g) || []).map(k=>k.slice(1));
                keys.forEach((k,idx)=>routeParams[k]=match[idx+1]);
                break;
            }
        }
        if (!matched) matched = 'home';
        const pageFunc = pages[matched];
        if (!pageFunc) { document.getElementById('app').innerHTML = '<h1>404</h1>'; return; }
        document.getElementById('app').innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        try {
            const html = await pageFunc({ ...params, ...query, ...routeParams });
            document.getElementById('app').innerHTML = html;
            attachFormHandlers();
            if (matched === 'product') {
                const productId = routeParams.id;
                if (productId) {
                    const prod = await getProduct(productId);
                    if (prod) setTimeout(() => initProductCalculator(prod), 50);
                }
            }
            this.updateActiveLinks();
            this.updateAuthNav();
            window.scrollTo(0,0);
        } catch(e) { console.error(e); document.getElementById('app').innerHTML = `<div class="error">Ошибка: ${e.message}</div>`; }
    }
    updateActiveLinks() {
        let currentHash = window.location.hash.slice(1) || '/';
        document.querySelectorAll('nav a').forEach(a => {
            let href = a.getAttribute('href');
            if (href === `#${currentHash}`) a.classList.add('active');
            else a.classList.remove('active');
        });
    }
    async updateAuthNav() {
        const authNav = document.getElementById('auth-nav');
        const adminNav = document.getElementById('admin-nav');
        try {
            const auth = await checkAuth();
            if (auth.loggedIn) {
                authNav.innerHTML = `<li><a href="#/profile"><i class="fas fa-user-circle"></i> ${escapeHtml(auth.name)}</a></li><li><a href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Выход</a></li>`;
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) logoutBtn.addEventListener('click', async(e) => { e.preventDefault(); await logout(); router.navigate('/'); });
                adminNav.style.display = auth.role === 'admin' ? 'block' : 'none';
            } else {
                authNav.innerHTML = `<li><a href="#/login"><i class="fas fa-sign-in-alt"></i> Вход</a></li>`;
                adminNav.style.display = 'none';
            }
        } catch(e) { console.error(e); }
    }
}

const router = new Router();

// Обработка кликов по ссылкам с хэшем
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        const hash = link.getAttribute('href').slice(1);
        window.location.hash = hash || '/';
    }
});
// Мобильное меню
document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
    document.getElementById('mainNav')?.classList.toggle('show');
});
// Инициализация
document.addEventListener('DOMContentLoaded', () => router.updateAuthNav());
