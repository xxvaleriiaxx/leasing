<?php
require_once 'config.php';
requireAuth();

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

if ($action === 'get') {
    $stmt = $pdo->prepare("
        SELECT c.id as cart_id, c.selected_lease_term, p.*, c.quantity 
        FROM " . table('cart') . " c 
        JOIN " . table('products') . " p ON c.product_id = p.id 
        WHERE c.user_id = ?
    ");
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    // Приводим числовые поля к числам
    foreach ($items as &$item) {
        $item['id'] = (int)$item['id'];
        $item['price'] = (float)$item['price'];
        $item['monthly_payment'] = (float)$item['monthly_payment'];
        $item['advance_percent'] = (float)$item['advance_percent'];
        $item['residual_percent'] = (float)$item['residual_percent'];
        if ($item['selected_lease_term'] !== null) $item['selected_lease_term'] = (int)$item['selected_lease_term'];
    }
    jsonResponse(['items' => $items]);
}
elseif ($action === 'add') {
    $input = json_decode(file_get_contents('php://input'), true);
    $product_id = (int)($input['product_id'] ?? 0);
    $lease_term = isset($input['lease_term']) ? (int)$input['lease_term'] : null;
    if (!$product_id) jsonResponse(['error' => 'Не указан товар'], 400);
    $stmt = $pdo->prepare("SELECT id FROM " . table('cart') . " WHERE user_id = ? AND product_id = ?");
    $stmt->execute([$userId, $product_id]);
    if ($stmt->fetch()) {
        if ($lease_term !== null) {
            $stmt = $pdo->prepare("UPDATE " . table('cart') . " SET selected_lease_term = ? WHERE user_id = ? AND product_id = ?");
            $stmt->execute([$lease_term, $userId, $product_id]);
        }
        jsonResponse(['success' => true]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO " . table('cart') . " (user_id, product_id, quantity, selected_lease_term) VALUES (?, ?, 1, ?)");
        $stmt->execute([$userId, $product_id, $lease_term]);
        jsonResponse(['success' => true]);
    }
}
elseif ($action === 'remove') {
    $input = json_decode(file_get_contents('php://input'), true);
    $cart_id = (int)($input['cart_id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM " . table('cart') . " WHERE id = ? AND user_id = ?");
    $stmt->execute([$cart_id, $userId]);
    jsonResponse(['success' => true]);
}
elseif ($action === 'update_term') {
    $input = json_decode(file_get_contents('php://input'), true);
    $cart_id = (int)($input['cart_id'] ?? 0);
    $lease_term = (int)($input['lease_term'] ?? 0);
    $stmt = $pdo->prepare("UPDATE " . table('cart') . " SET selected_lease_term = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$lease_term, $cart_id, $userId]);
    jsonResponse(['success' => true]);
}
else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}