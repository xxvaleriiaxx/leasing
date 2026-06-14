# leasing
Лизинг оборудования. Сайт без бд не запустится. Работу сайта в действии можно глянуть по ссылке http://r926402k.beget.tech/sites/leasing/index.html#/. Либо же выполнить подключение у себя с бд. В config.php нужно поменять данные для подключения. БД для теста (данные админа на сайте будут admin@leasing.ru и admin123):

CREATE TABLE IF NOT EXISTS leasing_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leasing_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    monthly_payment DECIMAL(10,2) NOT NULL COMMENT 'Для отображения в каталоге (без учёта аванса/остатка)',
    lease_term_min INT NOT NULL,
    lease_term_max INT NOT NULL,
    advance_percent DECIMAL(5,2) NOT NULL DEFAULT 20 COMMENT 'Аванс в %',
    residual_percent DECIMAL(5,2) NOT NULL DEFAULT 10 COMMENT 'Остаточная стоимость в %',
    image VARCHAR(255) DEFAULT 'placeholder.jpg',
    status TINYINT DEFAULT 1 COMMENT '1 – активен, 0 – неактивен',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leasing_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_favorite (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES leasing_users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES leasing_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leasing_cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    selected_lease_term INT DEFAULT NULL COMMENT 'Срок, выбранный пользователем в калькуляторе',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES leasing_users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES leasing_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leasing_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    contract_number VARCHAR(50) NOT NULL UNIQUE,
    lease_term INT NOT NULL COMMENT 'Срок в месяцах',
    monthly_payment DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Уже выплаченная сумма',
    status ENUM('new', 'approved', 'active', 'returned', 'bought_out', 'expired') DEFAULT 'new',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES leasing_users(id),
    FOREIGN KEY (product_id) REFERENCES leasing_products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leasing_lease_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    request_type ENUM('extend', 'return', 'buyout') NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES leasing_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leasing_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES leasing_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO leasing_users (email, password, name, role) VALUES
('admin@leasing.ru', '$2y$10$Frzy1JE0MC.OBLTsf.pxw.tRL8k7ly/8V59uIoIZERoOqJGKePP4G', 'Администратор', 'admin')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO leasing_products (name, description, price, monthly_payment, lease_term_min, lease_term_max, advance_percent, residual_percent, image, status) VALUES
('Экскаватор Hitachi ZX200', 'Мощный гусеничный экскаватор для строительных работ. Глубина копания до 6 м.', 3500000.00, 70000.00, 12, 60, 20, 10, 'excavator.jpg', 1),
('Буровая установка Atlas Copco', 'Высокопроизводительная буровая установка для скальных пород.', 5200000.00, 104000.00, 24, 72, 20, 10, 'drill.jpg', 1),
('Компрессорная станция Kaeser', 'Промышленный винтовой компрессор, производительность 10 м³/мин.', 1200000.00, 25000.00, 12, 48, 20, 10, 'compressor.jpg', 1),
('Фронтальный погрузчик Liugong 856H', 'Погрузчик с ковшом 3 м³, грузоподъёмность 5 тонн.', 2800000.00, 55000.00, 12, 60, 20, 10, 'loader.jpg', 1),
('Автовышка Aichi SH150', 'Дизельная автовышка с высотой подъёма 15 м.', 3900000.00, 78000.00, 12, 48, 20, 10, 'aichi.jpg', 1)
ON DUPLICATE KEY UPDATE id=id;
