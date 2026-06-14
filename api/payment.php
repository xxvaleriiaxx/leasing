<?php
require_once 'config.php';
requireAuth();

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

if ($action === 'make') {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)($input['order_id'] ?? 0);
    $amount = (float)($input['amount'] ?? 0);
    
    $stmt = $pdo->prepare("SELECT id, total_amount, paid_amount, status FROM " . table('orders') . " WHERE id = ? AND user_id = ?");
    $stmt->execute([$order_id, $userId]);
    $order = $stmt->fetch();
    if (!$order) jsonResponse(['success' => false, 'message' => 'Заказ не найден'], 404);
    if ($order['status'] !== 'active') jsonResponse(['success' => false, 'message' => 'Договор не активен'], 400);
    
    $new_paid = $order['paid_amount'] + $amount;
    if ($new_paid > $order['total_amount']) $new_paid = $order['total_amount'];
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE " . table('orders') . " SET paid_amount = ? WHERE id = ?");
        $stmt->execute([$new_paid, $order_id]);
        
        $stmt = $pdo->prepare("INSERT INTO " . table('payments') . " (order_id, amount) VALUES (?, ?)");
        $stmt->execute([$order_id, $amount]);
        $pdo->commit();
        jsonResponse(['success' => true, 'new_paid' => $new_paid]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}
elseif ($action === 'history') {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)($input['order_id'] ?? 0);
    if ($order_id <= 0) {
        $stmt = $pdo->prepare("
            SELECT p.*, o.contract_number, pr.name as product_name
            FROM " . table('payments') . " p
            JOIN " . table('orders') . " o ON p.order_id = o.id
            JOIN " . table('products') . " pr ON o.product_id = pr.id
            WHERE o.user_id = ?
            ORDER BY p.payment_date DESC
        ");
        $stmt->execute([$userId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT p.*, o.contract_number, pr.name as product_name
            FROM " . table('payments') . " p
            JOIN " . table('orders') . " o ON p.order_id = o.id
            JOIN " . table('products') . " pr ON o.product_id = pr.id
            WHERE p.order_id = ?
            ORDER BY p.payment_date DESC
        ");
        $stmt->execute([$order_id]);
    }
    $payments = $stmt->fetchAll();
    jsonResponse($payments);
}
else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}