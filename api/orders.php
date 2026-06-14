<?php
require_once 'config.php';
requireAuth();

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

if ($action === 'user_orders') {
    $stmt = $pdo->prepare("
        SELECT o.*, p.name as product_name,
               (SELECT SUM(monthly_payment) FROM " . table('orders') . " 
                WHERE user_id = o.user_id AND status = 'active' AND id <= o.id) as paid_amount
        FROM " . table('orders') . " o
        JOIN " . table('products') . " p ON o.product_id = p.id
        WHERE o.user_id = ?
        ORDER BY o.id DESC
    ");
    $stmt->execute([$userId]);
    $orders = $stmt->fetchAll();
    // Добавляем виртуальное поле paid_amount для активных договоров
    foreach ($orders as &$order) {
        if ($order['status'] == 'active' && $order['start_date']) {
            $start = new DateTime($order['start_date']);
            $now = new DateTime();
            $monthsPassed = ($now->diff($start)->y * 12) + $now->diff($start)->m;
            $monthsPassed = max(0, min($monthsPassed, $order['lease_term']));
            $order['paid_amount'] = $order['monthly_payment'] * $monthsPassed;
        } else {
            $order['paid_amount'] = 0;
        }
    }
    jsonResponse($orders);
}
elseif ($action === 'create') {
    $input = json_decode(file_get_contents('php://input'), true);
    $items = $input['items'] ?? [];
    if (empty($items)) {
        jsonResponse(['success' => false, 'message' => 'Корзина пуста'], 400);
    }
    $errors = [];
    foreach ($items as $item) {
        $cart_id = (int)$item['cart_id'];
        $lease_term = (int)$item['lease_term'];
        $stmt = $pdo->prepare("
            SELECT c.product_id, p.price, p.advance_percent, p.residual_percent,
                   p.lease_term_min, p.lease_term_max, p.name as product_name
            FROM " . table('cart') . " c
            JOIN " . table('products') . " p ON c.product_id = p.id
            WHERE c.id = ? AND c.user_id = ?
        ");
        $stmt->execute([$cart_id, $userId]);
        $cartItem = $stmt->fetch();
        if (!$cartItem) {
            $errors[] = "Товар в корзине не найден";
            continue;
        }
        if ($lease_term < $cartItem['lease_term_min'] || $lease_term > $cartItem['lease_term_max']) {
            $errors[] = "Неверный срок лизинга для " . $cartItem['product_name'];
            continue;
        }
        $price = $cartItem['price'];
        $advance = $price * ($cartItem['advance_percent'] / 100);
        $residual = $price * ($cartItem['residual_percent'] / 100);
        $amount_to_lease = $price - $advance - $residual;
        if ($amount_to_lease <= 0) {
            $errors[] = "Некорректная стоимость лизинга для " . $cartItem['product_name'];
            continue;
        }
        $monthly_payment = $amount_to_lease / $lease_term;
        $contract_number = 'L-' . time() . '-' . $cartItem['product_id'] . '-' . rand(100,999);
        $total = $monthly_payment * $lease_term;
        $end_date = date('Y-m-d', strtotime("+$lease_term months"));
        $stmt2 = $pdo->prepare("
            INSERT INTO " . table('orders') . "
            (user_id, product_id, contract_number, lease_term, monthly_payment, total_amount, status, end_date)
            VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
        ");
        $stmt2->execute([$userId, $cartItem['product_id'], $contract_number, $lease_term, $monthly_payment, $total, $end_date]);
        $pdo->prepare("DELETE FROM " . table('cart') . " WHERE id = ? AND user_id = ?")->execute([$cart_id, $userId]);
    }
    if (empty($errors)) {
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['success' => false, 'message' => implode(', ', $errors)], 400);
    }
}
elseif ($action === 'request') {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)($input['order_id'] ?? 0);
    $type = $input['type'] ?? '';
    if (!in_array($type, ['extend', 'return', 'buyout'])) {
        jsonResponse(['success' => false, 'message' => 'Неверный тип запроса'], 400);
    }
    $stmt = $pdo->prepare("SELECT id FROM " . table('orders') . " WHERE id = ? AND user_id = ?");
    $stmt->execute([$order_id, $userId]);
    if (!$stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Заказ не найден'], 404);
    }
    $stmt = $pdo->prepare("INSERT INTO " . table('lease_requests') . " (order_id, request_type) VALUES (?, ?)");
    $stmt->execute([$order_id, $type]);
    jsonResponse(['success' => true]);
}
else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}