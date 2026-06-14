const API_BASE = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/api/';

async function request(endpoint, method = 'GET', data = null) {
    const url = API_BASE + endpoint;
    const options = {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    };
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }
    const response = await fetch(url, options);
    const text = await response.text();
    try {
        const json = JSON.parse(text);
        if (!response.ok) throw new Error(json.message || 'Ошибка сервера');
        return json;
    } catch(e) {
        console.error('API ответ не JSON:', text);
        throw new Error('Сервер вернул некорректный ответ');
    }
}

// Auth
async function login(email, password) {
    return request('auth.php?action=login', 'POST', { email, password });
}
async function register(name, email, phone, password) {
    return request('auth.php?action=register', 'POST', { name, email, phone, password });
}
async function logout() {
    return request('auth.php?action=logout', 'POST');
}
async function checkAuth() {
    return request('auth.php?action=check');
}

// Products
async function getProducts(search = '', min_price = null, max_price = null, min_term = null, max_term = null) {
    let url = `products.php?action=list`;
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (min_price !== null && min_price !== '') params.append('min_price', min_price);
    if (max_price !== null && max_price !== '') params.append('max_price', max_price);
    if (min_term !== null && min_term !== '') params.append('min_term', min_term);
    if (max_term !== null && max_term !== '') params.append('max_term', max_term);
    if (params.toString()) url += '&' + params.toString();
    return request(url);
}
async function getProduct(id) {
    return request(`products.php?action=get&id=${id}`);
}

// Cart
async function getCart() {
    return request('cart.php?action=get');
}
async function addToCart(productId, leaseTerm = null) {
    return request('cart.php?action=add', 'POST', { product_id: productId, lease_term: leaseTerm });
}
async function removeFromCart(cartId) {
    return request('cart.php?action=remove', 'POST', { cart_id: cartId });
}
async function updateCartTerm(cartId, leaseTerm) {
    return request('cart.php?action=update_term', 'POST', { cart_id: cartId, lease_term: leaseTerm });
}

// Favorites
async function getFavorites() {
    return request('favorites.php?action=get');
}
async function addToFavorites(productId) {
    return request('favorites.php?action=add', 'POST', { product_id: productId });
}
async function removeFromFavorites(favId) {
    return request('favorites.php?action=remove', 'POST', { fav_id: favId });
}

// Orders
async function createOrder(items) {
    return request('orders.php?action=create', 'POST', { items });
}
async function getUserOrders() {
    return request('orders.php?action=user_orders');
}
async function extendOrder(orderId) {
    return request('orders.php?action=request', 'POST', { order_id: orderId, type: 'extend' });
}
async function returnOrder(orderId) {
    return request('orders.php?action=request', 'POST', { order_id: orderId, type: 'return' });
}
async function buyoutOrder(orderId) {
    return request('orders.php?action=request', 'POST', { order_id: orderId, type: 'buyout' });
}

// Payments
async function makePayment(orderId, amount) {
    return request('payment.php?action=make', 'POST', { order_id: orderId, amount });
}
async function getPaymentHistory(orderId = null) {
    return request('payment.php?action=history', 'POST', { order_id: orderId });
}
async function getUserRequests() {
    return request('lease_requests.php?action=user_requests');
}

// Admin
async function adminGetOrders() {
    return request('admin.php?action=get_orders');
}
async function adminUpdateOrderStatus(orderId, status, end_date = null) {
    return request('admin.php?action=update_order', 'POST', { order_id: orderId, status, end_date });
}
async function adminGetProducts() {
    return request('admin.php?action=get_products');
}
async function adminDeleteProduct(productId) {
    return request('admin.php?action=delete_product', 'POST', { product_id: productId });
}
async function adminSaveProduct(formData) {
    const response = await fetch(API_BASE + 'admin.php?action=save_product_with_image', {
        method: 'POST',
        credentials: 'include',
        body: formData
    });
    return response.json();
}

async function adminGetPayments(orderId) {
    return request('admin.php?action=get_payments', 'POST', { order_id: orderId });
}
async function updateCartTerm(cartId, leaseTerm) {
    return request('cart.php?action=update_term', 'POST', { cart_id: cartId, lease_term: leaseTerm });
}
async function adminGetRequests() {
    return request('admin.php?action=get_requests');
}
async function adminUpdateRequestStatus(requestId, status) {
    return request('admin.php?action=update_request', 'POST', { request_id: requestId, status });
}
async function adminGetOrderPayments(orderId) {
    return request('admin.php?action=get_payments_for_order', 'POST', { order_id: orderId });
}