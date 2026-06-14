<?php
require_once 'config.php';
requireAdmin();

$action = $_GET['action'] ?? '';

// Договоры
if ($action === 'get_orders') {
    $stmt = $pdo->query("
        SELECT o.*, u.name as user_name, u.email as user_email, p.name as product_name
        FROM " . table('orders') . " o
        JOIN " . table('users') . " u ON o.user_id = u.id
        JOIN " . table('products') . " p ON o.product_id = p.id
        ORDER BY o.id DESC
    ");
    jsonResponse($stmt->fetchAll());
}
elseif ($action === 'update_order') {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)($input['order_id'] ?? 0);
    $status = $input['status'] ?? '';
    $end_date = $input['end_date'] ?? null;
    $allowed = ['new', 'approved', 'active', 'returned', 'bought_out', 'expired'];
    if (!in_array($status, $allowed)) {
        jsonResponse(['success' => false, 'message' => 'Недопустимый статус'], 400);
    }
    $update = "UPDATE " . table('orders') . " SET status = ?";
    $params = [$status];
    if ($end_date && preg_match('/\d{4}-\d{2}-\d{2}/', $end_date)) {
        $update .= ", end_date = ?";
        $params[] = $end_date;
    }
    if ($status === 'active') {
        $update .= ", start_date = IFNULL(start_date, CURDATE())";
    }
    $update .= " WHERE id = ?";
    $params[] = $order_id;
    $stmt = $pdo->prepare($update);
    $stmt->execute($params);
    jsonResponse(['success' => true]);
}

// Товары
elseif ($action === 'get_products') {
    $stmt = $pdo->query("SELECT * FROM " . table('products') . " ORDER BY id DESC");
    jsonResponse($stmt->fetchAll());
}
elseif ($action === 'delete_product') {
    $input = json_decode(file_get_contents('php://input'), true);
    $product_id = (int)($input['product_id'] ?? 0);
    $pdo->prepare("DELETE FROM " . table('cart') . " WHERE product_id = ?")->execute([$product_id]);
    $pdo->prepare("DELETE FROM " . table('favorites') . " WHERE product_id = ?")->execute([$product_id]);
    $pdo->prepare("DELETE FROM " . table('orders') . " WHERE product_id = ?")->execute([$product_id]);
    $pdo->prepare("DELETE FROM " . table('products') . " WHERE id = ?")->execute([$product_id]);
    jsonResponse(['success' => true]);
}
elseif ($action === 'save_product_with_image') {
    $id = (int)($_POST['id'] ?? 0);
    $name = trim($_POST['name'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $price = (float)($_POST['price'] ?? 0);
    $monthly_payment = (float)($_POST['monthly_payment'] ?? 0);
    $lease_term_min = (int)($_POST['lease_term_min'] ?? 0);
    $lease_term_max = (int)($_POST['lease_term_max'] ?? 0);
    $status = (int)($_POST['status'] ?? 1);
    $advance_percent = (float)($_POST['advance_percent'] ?? 0);
    $residual_percent = (float)($_POST['residual_percent'] ?? 0);
    
    $imageName = $_POST['existing_image'] ?? 'placeholder.jpg';
    $image_url = trim($_POST['image_url'] ?? '');
    if (!empty($image_url) && filter_var($image_url, FILTER_VALIDATE_URL)) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $ext = pathinfo(parse_url($image_url, PHP_URL_PATH), PATHINFO_EXTENSION);
        if (!in_array(strtolower($ext), ['jpg','jpeg','png','webp'])) $ext = 'jpg';
        $newName = uniqid() . '.' . $ext;
        $fileContent = @file_get_contents($image_url);
        if ($fileContent !== false) {
            file_put_contents($uploadDir . $newName, $fileContent);
            chmod($uploadDir . $newName, 0644);
            $imageName = $newName;
            if ($id > 0 && isset($_POST['existing_image']) && $_POST['existing_image'] != 'placeholder.jpg') {
                $oldFile = $uploadDir . $_POST['existing_image'];
                if (file_exists($oldFile)) unlink($oldFile);
            }
        }
    }
    elseif (isset($_FILES['image_file']) && $_FILES['image_file']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $ext = pathinfo($_FILES['image_file']['name'], PATHINFO_EXTENSION);
        $allowed = ['jpg', 'jpeg', 'png', 'webp'];
        if (in_array(strtolower($ext), $allowed)) {
            $newName = uniqid() . '.' . $ext;
            if (move_uploaded_file($_FILES['image_file']['tmp_name'], $uploadDir . $newName)) {
                chmod($uploadDir . $newName, 0644);
                $imageName = $newName;
                if ($id > 0 && isset($_POST['existing_image']) && $_POST['existing_image'] != 'placeholder.jpg') {
                    $oldFile = $uploadDir . $_POST['existing_image'];
                    if (file_exists($oldFile)) unlink($oldFile);
                }
            }
        }
    }
    else if ($id == 0 && empty($_POST['existing_image'])) {
        $imageName = 'placeholder.jpg';
    }
    
    if ($id > 0) {
        $stmt = $pdo->prepare("UPDATE " . table('products') . " 
            SET name=?, description=?, price=?, monthly_payment=?, 
                lease_term_min=?, lease_term_max=?, image=?, status=?,
                advance_percent=?, residual_percent=?
            WHERE id=?");
        $stmt->execute([$name, $description, $price, $monthly_payment, 
            $lease_term_min, $lease_term_max, $imageName, $status,
            $advance_percent, $residual_percent, $id]);
        jsonResponse(['success' => true, 'id' => $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO " . table('products') . " 
            (name, description, price, monthly_payment, lease_term_min, lease_term_max, image, status, advance_percent, residual_percent) 
            VALUES (?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$name, $description, $price, $monthly_payment, 
            $lease_term_min, $lease_term_max, $imageName, $status,
            $advance_percent, $residual_percent]);
        jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
    }
}

// Запросы клиентов
elseif ($action === 'get_requests') {
    $stmt = $pdo->query("
        SELECT r.*, o.contract_number, u.name as user_name, p.name as product_name
        FROM " . table('lease_requests') . " r
        JOIN " . table('orders') . " o ON r.order_id = o.id
        JOIN " . table('users') . " u ON o.user_id = u.id
        JOIN " . table('products') . " p ON o.product_id = p.id
        ORDER BY r.created_at DESC
    ");
    jsonResponse($stmt->fetchAll());
}
elseif ($action === 'update_request') {
    $input = json_decode(file_get_contents('php://input'), true);
    $request_id = (int)($input['request_id'] ?? 0);
    $status = $input['status'] ?? '';
    if (!in_array($status, ['pending', 'approved', 'rejected'])) jsonResponse(['success' => false], 400);
    $stmt = $pdo->prepare("UPDATE " . table('lease_requests') . " SET status = ? WHERE id = ?");
    $stmt->execute([$status, $request_id]);
    jsonResponse(['success' => true]);
}

// Платежи для админа
elseif ($action === 'get_payments_for_order') {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)($input['order_id'] ?? 0);
    $stmt = $pdo->prepare("
        SELECT p.*, o.contract_number, pr.name as product_name
        FROM " . table('payments') . " p
        JOIN " . table('orders') . " o ON p.order_id = o.id
        JOIN " . table('products') . " pr ON o.product_id = pr.id
        WHERE p.order_id = ?
        ORDER BY p.payment_date DESC
    ");
    $stmt->execute([$order_id]);
    jsonResponse($stmt->fetchAll());
}

else {
    jsonResponse(['error' => 'Неизвестное действие'], 400);
}