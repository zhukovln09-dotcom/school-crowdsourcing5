// server.js - версия с авторизацией
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database-mongo.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Настройка почтового транспорта
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Middleware для проверки авторизации
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        const verification = await db.verifyToken(token);
        
        if (!verification.valid) {
            return res.status(401).json({ error: 'Неверный или просроченный токен' });
        }

        req.user = verification.user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Ошибка авторизации' });
    }
};

// Middleware для проверки ролей
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        next();
    };
};

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Получить IP пользователя
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.ip || 
           req.connection.remoteAddress;
};

// ========== МАРШРУТЫ АВТОРИЗАЦИИ ==========

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        
        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        const result = await db.registerUser(email, password, username);

        // Отправляем email с кодом подтверждения
        if (process.env.NODE_ENV !== 'test') {
            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@yourschool.ru',
                to: email,
                subject: 'Подтверждение email - Школьная платформа',
                html: `
                    <h2>Добро пожаловать на школьную платформу!</h2>
                    <p>Ваш код подтверждения: <strong>${result.verificationCode}</strong></p>
                    <p>Введите этот код на странице подтверждения.</p>
                    <p>Код действителен в течение 24 часов.</p>
                `
            };

            await transporter.sendMail(mailOptions);
        }

        res.json({ 
            success: true, 
            message: 'Регистрация успешна! Проверьте email для подтверждения.',
            userId: result.userId
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        
        if (error.message.includes('уже существует')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Ошибка регистрации' });
        }
    }
});

// Подтверждение email
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (!email || !code) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        const result = await db.verifyEmail(email, code);
        
        res.json({ 
            success: true, 
            message: result.message
        });

    } catch (error) {
        console.error('Ошибка подтверждения:', error);
        res.status(400).json({ error: error.message });
    }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'];
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        const result = await db.loginUser(email, password, ip, userAgent);
        
        res.json({ 
            success: true,
            token: result.token,
            user: result.user
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        
        if (error.message.includes('Неверный') || 
            error.message.includes('Подтвердите') || 
            error.message.includes('заблокирован')) {
            res.status(401).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Ошибка входа' });
        }
    }
});

// Выход
app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
        const token = req.headers.authorization.replace('Bearer ', '');
        await db.logoutUser(token);
        
        res.json({ success: true, message: 'Выход выполнен' });
    } catch (error) {
        console.error('Ошибка выхода:', error);
        res.status(500).json({ error: 'Ошибка выхода' });
    }
});

// Профиль пользователя
app.get('/api/auth/profile', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                username: req.user.username,
                role: req.user.role,
                emailVerified: req.user.emailVerified,
                createdAt: req.user.createdAt
            }
        });
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ error: 'Ошибка получения профиля' });
    }
});

// Использование пригласительного кода
app.post('/api/auth/use-invitation', authenticate, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Введите код приглашения' });
        }

        const result = await db.useInvitationCode(code.toUpperCase(), req.user._id);
        
        res.json({ 
            success: true,
            message: `Роль обновлена: ${result.role}`,
            role: result.role
        });

    } catch (error) {
        console.error('Ошибка использования кода:', error);
        res.status(400).json({ error: error.message });
    }
});

// Создание пригласительного кода (только для админов)
app.post('/api/admin/invitation-codes', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        const { role, expiresInDays, maxUses } = req.body;
        
        if (!role || !['moderator', 'content_manager', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Укажите правильную роль' });
        }

        const result = await db.createInvitationCode(
            role, 
            req.user._id, 
            expiresInDays || 30, 
            maxUses || 1
        );
        
        res.json({ 
            success: true,
            code: result.code,
            role,
            expiresInDays: expiresInDays || 30,
            maxUses: maxUses || 1
        });

    } catch (error) {
        console.error('Ошибка создания кода:', error);
        res.status(500).json({ error: 'Ошибка создания кода' });
    }
});

// ========== МАРШРУТЫ ДЛЯ ИДЕЙ ==========

// Получить все идеи
app.get('/api/ideas', async (req, res) => {
    try {
        const userId = req.headers.authorization 
            ? (await db.verifyToken(req.headers.authorization.replace('Bearer ', ''))).user?._id 
            : null;
        
        const ideas = await db.getAllIdeas(userId);
        res.json(ideas);
    } catch (error) {
        console.error('Ошибка загрузки идей:', error);
        res.status(500).json({ error: 'Ошибка загрузки идей. Попробуйте позже.' });
    }
});

// Добавить новую идею
app.post('/api/ideas', authenticate, async (req, res) => {
    try {
        const { title, description } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ 
                error: 'Заполните все поля',
                details: 'Нужны название и описание идеи'
            });
        }
        
        if (title.length < 3) {
            return res.status(400).json({ 
                error: 'Название слишком короткое',
                details: 'Минимум 3 символа'
            });
        }
        
        if (description.length < 10) {
            return res.status(400).json({ 
                error: 'Описание слишком короткое',
                details: 'Минимум 10 символов'
            });
        }
        
        const result = await db.addIdea(title, description, req.user._id);
        
        res.json({ 
            success: true, 
            message: req.user.role === 'content_manager' 
                ? 'Идея успешно добавлена и одобрена!' 
                : 'Идея успешно добавлена! Ожидает модерации.',
            id: result.id,
            status: result.status
        });
        
    } catch (error) {
        console.error('Ошибка добавления идеи:', error);
        
        if (error.message.includes('обязательно') || 
            error.message.includes('должно быть')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Не удалось добавить идею' });
        }
    }
});

// Проголосовать за идею
app.post('/api/ideas/:id/vote', authenticate, async (req, res) => {
    try {
        const ideaId = req.params.id;
        const userIp = getClientIp(req);
        
        if (!ideaId) {
            return res.status(400).json({ error: 'Не указан ID идеи' });
        }
        
        await db.voteForIdea(ideaId, req.user._id, userIp);
        
        res.json({ 
            success: true,
            message: 'Ваш голос учтен!'
        });
        
    } catch (error) {
        console.error('Ошибка голосования:', error);
        
        if (error.message.includes('уже голосовали')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('не найдена')) {
            res.status(404).json({ error: 'Идея не найдена' });
        } else if (error.message.includes('нельзя голосовать')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Ошибка голосования' });
        }
    }
});

// Добавить комментарий
app.post('/api/ideas/:id/comments', authenticate, async (req, res) => {
    try {
        const ideaId = req.params.id;
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ 
                error: 'Введите текст комментария'
            });
        }
        
        if (text.length < 2) {
            return res.status(400).json({ 
                error: 'Комментарий слишком короткий'
            });
        }
        
        const result = await db.addComment(ideaId, req.user._id, text);
        
        res.json({ 
            success: true,
            message: 'Комментарий добавлен!',
            id: result.id
        });
        
    } catch (error) {
        console.error('Ошибка добавления комментария:', error);
        
        if (error.message.includes('не найдена')) {
            res.status(404).json({ error: 'Идея не найдена' });
        } else {
            res.status(500).json({ error: 'Не удалось добавить комментарий' });
        }
    }
});

// Получить комментарии для идеи
app.get('/api/ideas/:id/comments', async (req, res) => {
    try {
        const ideaId = req.params.id;
        const comments = await db.getComments(ideaId);
        
        res.json(comments);
        
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        res.status(500).json({ error: 'Не удалось загрузить комментарии' });
    }
});

// ========== МАРШРУТЫ ДЛЯ МОДЕРАТОРОВ ==========

// Получить идеи на модерацию
app.get('/api/moderator/pending-ideas', authenticate, requireRole(['moderator', 'content_manager', 'admin']), async (req, res) => {
    try {
        const ideas = await db.getIdeasForModeration();
        res.json(ideas);
    } catch (error) {
        console.error('Ошибка загрузки идей на модерацию:', error);
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
});

// Обновить статус идеи
app.put('/api/moderator/ideas/:id/status', authenticate, requireRole(['content_manager', 'admin']), async (req, res) => {
    try {
        const ideaId = req.params.id;
        const { status, notes } = req.body;
        
        if (!status || !['approved', 'rejected', 'in_progress', 'completed', 'featured'].includes(status)) {
            return res.status(400).json({ error: 'Укажите правильный статус' });
        }
        
        await db.updateIdeaStatus(ideaId, status, req.user._id, notes);
        
        res.json({ 
            success: true,
            message: `Статус идеи обновлен на: ${status}`
        });
        
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить идею
app.delete('/api/moderator/ideas/:id', authenticate, requireRole(['moderator', 'admin']), async (req, res) => {
    try {
        const ideaId = req.params.id;
        const result = await db.deleteIdea(ideaId, req.user._id);
        
        res.json(result);
        
    } catch (error) {
        console.error('Ошибка удаления идеи:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить комментарий
app.delete('/api/moderator/comments/:id', authenticate, requireRole(['moderator', 'admin']), async (req, res) => {
    try {
        const commentId = req.params.id;
        const result = await db.deleteComment(commentId, req.user._id);
        
        res.json(result);
        
    } catch (error) {
        console.error('Ошибка удаления комментария:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== СТАТИСТИКА И ЗДОРОВЬЕ ==========

// Проверка здоровья API
app.get('/api/health', async (req, res) => {
    try {
        const connectionStatus = await db.testConnection();
        
        res.json({ 
            status: 'healthy',
            database: connectionStatus.connected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            mongo: connectionStatus
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            error: error.message 
        });
    }
});

// Получить статистику
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ error: 'Страница не найдена' });
});

// Обработка ошибок
app.use((error, req, res, next) => {
    console.error('Глобальная ошибка:', error);
    res.status(500).json({ 
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт: http://localhost:${PORT}`);
    console.log(`📊 MongoDB: ${process.env.MONGODB_URI ? 'Настроен' : 'Используется локальная строка'}`);
    console.log(`🔐 Режим: ${process.env.NODE_ENV || 'development'}`);
});
