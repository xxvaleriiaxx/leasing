<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    $search = $_GET['search'] ?? '';
    $min_price = isset($_GET['min_price']) ? (float)$_GET['min_price'] : null;
    $max_price = isset($_GET['max_price']) ? (float)$_GET['max_price'] : null;
    $min_term = isset($_GET['min_term']) ? (int)$_GET['min_term'] : null;
    $max_term = isset($_GET['max_term']) ? (int)$_GET['max_term'] : null;
    
    $sql = "SELECT * FROM " . table('products') . " WHERE status = 1";
    $params = [];
    
    if ($search) {
        $sql .= " AND name LIKE ?";
        $params[] = "%$search%";
    }
    if ($min_price !== null) {
        $sql .= " AND price >= ?";
        $params[] = $min_price;
    }
    if ($max_price !== null) {
        $sql .= " AND price <= ?";
        $params[] = $max_price;
    }
    if ($min_term !== null) {
        $sql .= " AND lease_term_min >= ?";
        $params[] = $min_term;
    }
    if ($max_term !== null) {
        $sql .= " AND lease_term_max <= ?";
        $params[] = $max_term;
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();
    jsonResponse($products);
}
elseif ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM " . table('products') . " WHERE id = ? AND status = 1");
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if ($product) {
        jsonResponse($product);
    } else {
        jsonResponse(['error' => 'Товар не найден'], 404);
    }
}
else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}