<?php
require_once 'config.php';
requireAuth();

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

if ($action === 'get') {
    $stmt = $pdo->prepare("
        SELECT f.id as fav_id, f.product_id, p.* 
        FROM " . table('favorites') . " f 
        JOIN " . table('products') . " p ON f.product_id = p.id 
        WHERE f.user_id = ?
    ");
    $stmt->execute([$userId]);
    $favs = $stmt->fetchAll();
    jsonResponse($favs);
}
elseif ($action === 'add') {
    $input = json_decode(file_get_contents('php://input'), true);
    $product_id = (int)($input['product_id'] ?? 0);
    if (!$product_id) jsonResponse(['error' => 'Не указан товар'], 400);
    $stmt = $pdo->prepare("INSERT IGNORE INTO " . table('favorites') . " (user_id, product_id) VALUES (?, ?)");
    $stmt->execute([$userId, $product_id]);
    jsonResponse(['success' => true]);
}
elseif ($action === 'remove') {
    $input = json_decode(file_get_contents('php://input'), true);
    $fav_id = (int)($input['fav_id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM " . table('favorites') . " WHERE id = ? AND user_id = ?");
    $stmt->execute([$fav_id, $userId]);
    jsonResponse(['success' => true]);
}
else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}