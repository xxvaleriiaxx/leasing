# ПрофиЛизинг — сайт лизинговой компании

Веб-приложение для лизинга строительного и промышленного оборудования. Клиенты могут выбирать товары, оформлять договоры лизинга, вносить платежи, запрашивать продление, возврат или выкуп. Администратор управляет договорами, товарами и запросами.

## Функциональные возможности

### Для клиентов
- Регистрация и авторизация.
- Просмотр каталога с фильтрацией по цене и сроку.
- Калькулятор лизинга на странице товара (расчёт ежемесячного платежа с учётом аванса и остаточной стоимости).
- Добавление товаров в корзину с выбором срока.
- Оформление договора лизинга (заявка).
- Личный кабинет с историей договоров, запросами и платежами.
- Возможность продлить, вернуть или выкупить оборудование.
- Оплата ежемесячных платежей (демо-режим).

### Для администратора
- Встроенная админ-панель (доступна по хэшу `#/admin`).
- Просмотр и изменение статусов договоров (новая → одобрена → активен → возвращён/выкуплен).
- Управление товарами (CRUD): добавление, редактирование, удаление с загрузкой изображений.
- Просмотр запросов клиентов (продление, возврат, выкуп) с возможностью одобрения/отклонения.
- Просмотр платежей по каждому договору.

## Технологический стек

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), SPA на нативном JS (хэш-роутинг).
- **Backend**: PHP (без фреймворков), MySQL 5.7+.
- **Сервер**: Apache с поддержкой .htaccess (опционально).
- **Стили**: адаптивная вёрстка, CSS Grid, Flexbox, медиа-запросы.
- **Коммуникация**: REST-like API (JSON), fetch с credentials.

## Установка и запуск

### Требования
- Веб-сервер (Apache / Nginx + PHP)
- PHP версии 7.4 или выше
- MySQL 5.7 или выше
- Расширения PHP: PDO, mysqli, json, session, fileinfo (для загрузки изображений)

### Пошаговая инструкция

1. **Склонируйте репозиторий** в корневую папку вашего веб-сервера (например, `sites/leasing/`).

2. **Настройте базу данных**:
   - Откройте phpMyAdmin или консоль MySQL.
   - Выполните SQL-скрипт приведённый ниже. Он создаст базу `leasing_db` и все таблицы с префиксом `leasing_`.

   ```sql
   CREATE DATABASE IF NOT EXISTS leasing_db 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
    
    USE leasing_db;
    
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

Настройте подключение к БД:
Отредактируйте файл api/config.php.
Укажите параметры доступа: $host, $dbname, $username, $password.

    $host = 'localhost';
    $dbname = 'leasing_db';
    $username = 'root';
    $password = '';
    
Настройте права на папку uploads (для загрузки изображений):
Установите права 755 (или 777 при проблемах).
Убедитесь, что PHP может записывать файлы в эту папку.

Запустите сайт:
Откройте в браузере URL вашего проекта, например http://localhost/sites/leasing/.
Главная страница откроется автоматически. Навигация через хэши: #/catalog, #/profile, #/admin и т.д.

Тестовый доступ:
Администратор: email admin@leasing.ru, пароль admin123.
Обычный пользователь: зарегистрируйтесь через форму входа (ссылка «Вход» в шапке).

Структура проекта

    /sites/leasing/
    ├── index.html               # Главный HTML-скелет SPA
    ├── .htaccess               # (опционально) правила перезаписи
    ├── install.php             # (одноразовый) установщик БД
    ├── css/
    │   └── style.css           # Все стили (адаптивные)
    ├── js/
    │   ├── api.js              # Взаимодействие с сервером (fetch)
    │   └── app.js              # Роутер, рендеринг страниц, логика
    ├── api/                    # Серверные PHP-скрипты (JSON API)
    │   ├── config.php          # Подключение к БД, сессии, константы
    │   ├── auth.php            # Регистрация, логин, выход
    │   ├── products.php        # Список и карточка товара (с фильтрами)
    │   ├── cart.php            # Корзина: получить, добавить, удалить
    │   ├── favorites.php       # Избранное
    │   ├── orders.php          # Создание договора, запросы клиента
    │   ├── payment.php         # Оплата и история платежей
    │   ├── lease_requests.php  # Запросы пользователя
    │   └── admin.php           # Админские функции (договоры, товары, запросы)
    ├── uploads/                # Загруженные изображения товаров
    │   ├── placeholder.jpg
    │   └── (другие картинки)
    └── sql/
        └── install.sql         # SQL-скрипт для создания БД

Основные API-эндпоинты (примеры):

    GET /api/products.php?action=list – список товаров.
    POST /api/auth.php?action=login – вход.
    POST /api/cart.php?action=add – добавить в корзину.
    POST /api/orders.php?action=create – оформить договор.
    POST /api/payment.php?action=make – оплатить.
    POST /api/admin.php?action=update_order – изменить статус договора.

Примечания
- Все API-запросы возвращают JSON, сессии хранятся в cookie.
- Калькулятор лизинга учитывает аванс (по умолчанию 20%) и остаточную стоимость (10%). Для новых товаров их можно задать в админке.
- Платежи – демонстрационные, реального шлюза нет, но данные сохраняются в БД.
- При добавлении товара можно загрузить изображение файлом или указать URL (картинка скачается на сервер).

Возможные проблемы и их решение
- Ошибка 404 при запросах API – проверьте путь API_BASE в js/api.js. Он должен соответствовать фактическому расположению папки api относительно корня сайта.
- Ошибка 500 при оплате – убедитесь, что в БД есть таблицы leasing_payments и leasing_lease_requests. Если нет – выполните соответствующий CREATE.
- Не загружаются изображения – проверьте права на папку uploads и наличие расширения PHP fileinfo.
- Не работают фильтры в каталоге – очистите кэш браузера (Ctrl+F5).

Лицензия
Проект разработан в учебных/демонстрационных целях. Свободно используется и дорабатывается.

Контакты
По вопросам доработки: [gurinava07@mail.ru].
