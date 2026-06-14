<?php
require_once 'config.php';
requireAuth();

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

if ($action === 'user_requests') {
    $stmt = $pdo->prepare("
        SELECT r.*, o.contract_number, p.name as product_name
        FROM " . table('lease_requests') . " r
        JOIN " . table('orders') . " o ON r.order_id = o.id
        JOIN " . table('products') . " p ON o.product_id = p.id
        WHERE o.user_id = ?
        ORDER BY r.created_at DESC
    ");
    $stmt->execute([$userId]);
    jsonResponse($stmt->fetchAll());
}
else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}