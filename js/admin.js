// Глобальные переменные
let currentProductId = 0;

// Загрузка договоров
async function loadOrders() {
    const container = document.getElementById('orders-table');
    try {
        const orders = await adminGetOrders();
        if (!orders.length) {
            container.innerHTML = '<p>Нет договоров</p>';
            return;
        }
        let html = `<table class="orders-table"><thead><tr><th>№ договора</th><th>Клиент</th><th>Оборудование</th><th>Статус</th><th>Сумма</th><th>Изменить статус</th></tr></thead><tbody>`;
        orders.forEach(order => {
            html += `<tr>
                <td>${escapeHtml(order.contract_number)}</td>
                <td>${escapeHtml(order.user_name)}</td>
                <td>${escapeHtml(order.product_name)}</td>
                <td>${order.status}</td>
                <td>${formatPrice(order.total_amount)} ₽</td>
                <td>
                    <select onchange="updateOrderStatus(${order.id}, this.value)" class="status-select">
                        <option value="new" ${order.status==='new' ? 'selected' : ''}>Новая</option>
                        <option value="approved" ${order.status==='approved' ? 'selected' : ''}>Одобрена</option>
                        <option value="active" ${order.status==='active' ? 'selected' : ''}>Активен</option>
                        <option value="returned" ${order.status==='returned' ? 'selected' : ''}>Возвращён</option>
                        <option value="bought_out" ${order.status==='bought_out' ? 'selected' : ''}>Выкуплен</option>
                        <option value="expired" ${order.status==='expired' ? 'selected' : ''}>Просрочен</option>
                    </select>
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `<div class="error">Ошибка загрузки: ${e.message}</div>`;
    }
}

window.updateOrderStatus = async (orderId, status) => {
    try {
        await adminUpdateOrderStatus(orderId, status);
        alert('Статус обновлён');
        loadOrders();
    } catch(e) {
        alert('Ошибка: ' + e.message);
    }
};

// Загрузка товаров в таблицу
async function loadProducts() {
    const container = document.getElementById('products-table');
    try {
        const products = await adminGetProducts();
        if (!products.length) {
            container.innerHTML = '<p>Товары отсутствуют. Добавьте первый товар.</p>';
            return;
        }
        let html = `<table><thead><tr><th>ID</th><th>Изображение</th><th>Название</th><th>Цена (полная)</th><th>Платёж/мес</th><th>Статус</th><th>Действия</th></tr></thead><tbody>`;
        products.forEach(prod => {
            html += `<tr>
                <td>${prod.id}</td>
                <td><img src="../uploads/${prod.image}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;"></td>
                <td>${escapeHtml(prod.name)}</td>
                <td>${formatPrice(prod.price)} ₽</td>
                <td>${formatPrice(prod.monthly_payment)} ₽</td>
                <td>${prod.status == 1 ? 'Активен' : 'Неактивен'}</td>
                <td>
                    <button class="btn-small" onclick="editProduct(${prod.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-small" style="background:#dc3545;" onclick="deleteProduct(${prod.id})"><i class="fas fa-trash"></i></button>
                 </td>
            </tr>`;
        });
        html += `</tbody></td>`;
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `<div class="error">Ошибка: ${e.message}</div>`;
    }
}

// Открыть модалку добавления/редактирования
window.editProduct = async (id) => {
    currentProductId = id;
    document.getElementById('modal-title').innerText = id ? 'Редактирование товара' : 'Добавление товара';
    if (id) {
        try {
            const products = await adminGetProducts();
            const product = products.find(p => p.id == id);
            if (product) {
                document.getElementById('product-id').value = product.id;
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-description').value = product.description;
                document.getElementById('product-price').value = product.price;
                document.getElementById('product-monthly').value = product.monthly_payment;
                document.getElementById('product-term-min').value = product.lease_term_min;
                document.getElementById('product-term-max').value = product.lease_term_max;
                document.getElementById('product-status').value = product.status;
                const previewDiv = document.getElementById('current-image-preview');
                previewDiv.innerHTML = `
                    <div style="margin:10px 0;">
                        <img src="../uploads/${product.image}" class="image-preview" id="current-img"><br>
                        <button type="button" id="delete-img-btn" class="btn-small" style="background:#6c757d;">Удалить изображение</button>
                        <input type="hidden" name="existing_image" id="existing-image" value="${product.image}">
                    </div>
                `;
                document.getElementById('delete-img-btn')?.addEventListener('click', () => {
                    document.getElementById('existing-image').value = '';
                    document.getElementById('current-image-preview').innerHTML = '<small>Изображение будет удалено при сохранении</small>';
                });
            }
        } catch(e) { alert('Ошибка загрузки товара'); }
    } else {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = 0;
        document.getElementById('current-image-preview').innerHTML = '';
    }
    document.getElementById('product-modal').style.display = 'flex';
};

window.deleteProduct = async (id) => {
    if (confirm('Удалить товар? Это удалит все связанные договоры и избранное.')) {
        try {
            await adminDeleteProduct(id);
            alert('Товар удалён');
            loadProducts();
        } catch(e) { alert('Ошибка: ' + e.message); }
    }
};

// Обработка формы с загрузкой файла
document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const id = document.getElementById('product-id').value;
    formData.append('id', id);
    formData.append('name', document.getElementById('product-name').value);
    formData.append('description', document.getElementById('product-description').value);
    formData.append('price', document.getElementById('product-price').value);
    formData.append('monthly_payment', document.getElementById('product-monthly').value);
    formData.append('lease_term_min', document.getElementById('product-term-min').value);
    formData.append('lease_term_max', document.getElementById('product-term-max').value);
    formData.append('status', document.getElementById('product-status').value);
    
    const imageFile = document.getElementById('product-image-file').files[0];
    if (imageFile) {
        formData.append('image_file', imageFile);
    } else {
        const existingImage = document.getElementById('existing-image')?.value;
        if (existingImage && existingImage !== '') {
            formData.append('existing_image', existingImage);
        } else if (!id || id == 0) {
            formData.append('existing_image', 'placeholder.jpg');
        }
    }
    
    try {
        const response = await fetch(API_BASE + 'admin.php?action=save_product_with_image', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            alert('Товар сохранён');
            document.getElementById('product-modal').style.display = 'none';
            loadProducts();
        } else {
            alert('Ошибка: ' + (result.message || 'Неизвестная ошибка'));
        }
    } catch(e) {
        alert('Ошибка отправки: ' + e.message);
    }
});

// Закрыть модалку
document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('product-modal').style.display = 'none';
});

// Вкладки
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${target}-panel`).classList.add('active');
        if (target === 'orders') loadOrders();
        if (target === 'products') loadProducts();
    });
});

// Инициализация
(async () => {
    const auth = await checkAuth();
    if (!auth.loggedIn || auth.role !== 'admin') {
        document.body.innerHTML = '<div class="container"><h1>Доступ запрещён</h1><a href="#/">На главную</a></div>';
        return;
    }
    loadOrders();
    document.getElementById('add-product-btn')?.addEventListener('click', () => editProduct(0));
})();

function formatPrice(price) {
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