<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';

try {
    if ($action === 'login') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) jsonResponse(['success' => false, 'message' => 'Некорректный запрос'], 400);
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $stmt = $pdo->prepare("SELECT * FROM " . table('users') . " WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_role'] = $user['role'];
            jsonResponse(['success' => true, 'name' => $user['name'], 'role' => $user['role']]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Неверный email или пароль'], 401);
        }
    }
    elseif ($action === 'register') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) jsonResponse(['success' => false, 'message' => 'Некорректный запрос'], 400);
        $name = trim($input['name'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $password = $input['password'] ?? '';
        if (empty($name) || empty($email) || empty($password)) {
            jsonResponse(['success' => false, 'message' => 'Все поля обязательны'], 400);
        }
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO " . table('users') . " (name, email, phone, password) VALUES (?,?,?,?)");
        $stmt->execute([$name, $email, $phone, $hashed]);
        $_SESSION['user_id'] = $pdo->lastInsertId();
        $_SESSION['user_role'] = 'user';
        jsonResponse(['success' => true, 'name' => $name]);
    }
    elseif ($action === 'logout') {
        session_destroy();
        jsonResponse(['success' => true]);
    }
    elseif ($action === 'check') {
        if (isLoggedIn()) {
            $stmt = $pdo->prepare("SELECT name, role FROM " . table('users') . " WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch();
            if ($user) {
                jsonResponse(['loggedIn' => true, 'name' => $user['name'], 'role' => $user['role']]);
            } else {
                session_destroy();
                jsonResponse(['loggedIn' => false]);
            }
        } else {
            jsonResponse(['loggedIn' => false]);
        }
    }
    else {
        jsonResponse(['error' => 'Неизвестное действие'], 400);
    }
} catch (PDOException $e) {
    jsonResponse(['success' => false, 'message' => 'Ошибка базы данных: ' . $e->getMessage()], 500);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}