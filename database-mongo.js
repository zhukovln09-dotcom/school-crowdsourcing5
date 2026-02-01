// database-mongo.js - для MongoDB Atlas с авторизацией
const mongoose = require('mongoose');

// Строка подключения к MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 
    'mongodb+srv://Leonid:yzF-UgN-teN-TQ8@cluster0.52cmiku.mongodb.net/school_auth?appName=Cluster0&serverSelectionTimeoutMS=5000&socketTimeoutMS=45000';

// Подключение к MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Успешно подключено к MongoDB Atlas');
}).catch((error) => {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    console.log('💡 Проверьте:');
    console.log('1. Правильный ли пароль в строке подключения?');
    console.log('2. Добавили ли IP 0.0.0.0/0 в Network Access?');
    console.log('3. Работает ли интернет?');
});

// ========== СХЕМЫ ДЛЯ АВТОРИЗАЦИИ ==========

// Схема для пользователей
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email обязателен'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Пожалуйста, введите правильный email']
    },
    passwordHash: {
        type: String,
        required: [true, 'Пароль обязателен'],
        minlength: [6, 'Пароль должен быть минимум 6 символов']
    },
    username: {
        type: String,
        required: [true, 'Имя пользователя обязательно'],
        minlength: [3, 'Имя должно быть минимум 3 символа'],
        maxlength: [100, 'Имя слишком длинное']
    },
    role: {
        type: String,
        enum: ['user', 'moderator', 'content_manager', 'admin'],
        default: 'user'
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String,
        maxlength: 10
    },
    verificationExpires: {
        type: Date
    },
    lastLogin: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Схема для сессий
const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 'expiresAt' }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Схема для пригласительных кодов
const invitationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    role: {
        type: String,
        enum: ['moderator', 'content_manager', 'admin'],
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    usedAt: {
        type: Date
    },
    maxUses: {
        type: Number,
        default: 1
    },
    useCount: {
        type: Number,
        default: 0
    },
    expiresAt: {
        type: Date,
        index: { expires: 'expiresAt' }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ========== СУЩЕСТВУЮЩИЕ СХЕМЫ ==========

// Схема для Идей с доп. полями для контент-менеджеров
const ideaSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Название идеи обязательно'],
        minlength: [3, 'Название должно быть минимум 3 символа']
    },
    description: {
        type: String,
        required: [true, 'Описание идеи обязательно'],
        minlength: [10, 'Описание должно быть минимум 10 символов']
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorName: {
        type: String,
        required: true
    },
    votes: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'in_progress', 'completed', 'featured'],
        default: 'pending'
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: {
        type: Date
    },
    reviewNotes: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Схема для Комментариев
const commentSchema = new mongoose.Schema({
    ideaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Idea',
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorName: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: [true, 'Текст комментария обязателен'],
        minlength: [2, 'Комментарий должен быть минимум 2 символа']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Схема для Голосов
const voteSchema = new mongoose.Schema({
    ideaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Idea',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userIp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Уникальный индекс для голосов
voteSchema.index({ ideaId: 1, userId: 1 }, { unique: true });

// ========== МОДЕЛИ ==========

const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);
const InvitationCode = mongoose.model('InvitationCode', invitationCodeSchema);
const Idea = mongoose.model('Idea', ideaSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Vote = mongoose.model('Vote', voteSchema);

class Database {
    constructor() {
        console.log('📊 Инициализация MongoDB базы данных с авторизацией...');
        this.models = {
            User,
            Session,
            InvitationCode,
            Idea,
            Comment,
            Vote
        };
        
        // Создаем индексы при инициализации
        this.createIndexes();
    }

    // Создание индексов
    async createIndexes() {
        try {
            await User.createIndexes();
            await Session.createIndexes();
            await InvitationCode.createIndexes();
            await Idea.createIndexes();
            await Comment.createIndexes();
            await Vote.createIndexes();
            console.log('✅ Индексы созданы');
        } catch (error) {
            console.error('❌ Ошибка создания индексов:', error);
        }
    }

    // ========== МЕТОДЫ АВТОРИЗАЦИИ ==========

    // Регистрация пользователя
    async registerUser(email, password, username) {
        try {
            // Проверяем, существует ли пользователь
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw new Error('Пользователь с таким email уже существует');
            }

            // Хешируем пароль
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Создаем пользователя
            const user = new User({
                email,
                passwordHash,
                username,
                role: 'user',
                emailVerified: false
            });

            const savedUser = await user.save();
            
            // Генерируем код верификации
            const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
            
            user.verificationCode = verificationCode;
            user.verificationExpires = verificationExpires;
            await user.save();

            return {
                success: true,
                userId: savedUser._id,
                verificationCode
            };

        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            throw error;
        }
    }

    // Вход пользователя
    async loginUser(email, password, ip, userAgent) {
        try {
            // Находим пользователя
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('Неверный email или пароль');
            }

            // Проверяем активность
            if (!user.isActive) {
                throw new Error('Аккаунт заблокирован');
            }

            // Проверяем пароль
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                throw new Error('Неверный email или пароль');
            }

            // Проверяем верификацию email
            if (!user.emailVerified) {
                throw new Error('Подтвердите email для входа');
            }

            // Обновляем последний вход
            user.lastLogin = new Date();
            await user.save();

            // Создаем сессию
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { 
                    userId: user._id,
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '7d' }
            );

            // Сохраняем сессию в БД
            const session = new Session({
                userId: user._id,
                token,
                ipAddress: ip,
                userAgent,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 дней
            });
            await session.save();

            return {
                success: true,
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    emailVerified: user.emailVerified
                }
            };

        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            throw error;
        }
    }

    // Проверка токена
    async verifyToken(token) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            
            // Проверяем сессию в БД
            const session = await Session.findOne({ 
                token,
                expiresAt: { $gt: new Date() }
            }).populate('userId');
            
            if (!session) {
                throw new Error('Сессия не найдена или истекла');
            }

            return {
                valid: true,
                user: session.userId
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // Выход пользователя
    async logoutUser(token) {
        try {
            await Session.deleteOne({ token });
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            throw error;
        }
    }

    // Подтверждение email
    async verifyEmail(email, code) {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            if (user.emailVerified) {
                return { success: true, message: 'Email уже подтвержден' };
            }

            if (user.verificationCode !== code) {
                throw new Error('Неверный код подтверждения');
            }

            if (user.verificationExpires < new Date()) {
                throw new Error('Срок действия кода истек');
            }

            user.emailVerified = true;
            user.verificationCode = null;
            user.verificationExpires = null;
            await user.save();

            return { success: true, message: 'Email успешно подтвержден' };
        } catch (error) {
            console.error('❌ Ошибка подтверждения email:', error);
            throw error;
        }
    }

    // Создание пригласительного кода
    async createInvitationCode(role, createdBy, expiresInDays = 30, maxUses = 1) {
        try {
            const crypto = require('crypto');
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            
            const invitationCode = new InvitationCode({
                code,
                role,
                createdBy,
                expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
                maxUses
            });

            await invitationCode.save();
            return { success: true, code };
        } catch (error) {
            console.error('❌ Ошибка создания кода:', error);
            throw error;
        }
    }

    // Использование пригласительного кода
    async useInvitationCode(code, userId) {
        try {
            const invitation = await InvitationCode.findOne({ code });
            if (!invitation) {
                throw new Error('Неверный код приглашения');
            }

            if (invitation.expiresAt && invitation.expiresAt < new Date()) {
                throw new Error('Срок действия кода истек');
            }

            if (invitation.useCount >= invitation.maxUses) {
                throw new Error('Код использован максимальное количество раз');
            }

            // Обновляем пользователя
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            user.role = invitation.role;
            await user.save();

            // Обновляем код
            invitation.usedBy = userId;
            invitation.usedAt = new Date();
            invitation.useCount += 1;
            await invitation.save();

            return { success: true, role: invitation.role };
        } catch (error) {
            console.error('❌ Ошибка использования кода:', error);
            throw error;
        }
    }

    // ========== МЕТОДЫ ДЛЯ ИДЕЙ ==========

    // Получить все идеи с учетом ролей
    async getAllIdeas(userId = null) {
        try {
            const query = {};
            
            // Для обычных пользователей показываем только approved/featured
            if (userId) {
                const user = await User.findById(userId);
                if (user.role === 'user') {
                    query.$or = [
                        { status: 'approved' },
                        { status: 'featured' },
                        { status: 'completed' },
                        { status: 'in_progress' },
                        { author: userId } // Пользователь видит свои идеи
                    ];
                }
                // Модераторы и контент-менеджеры видят все
            }

            const ideas = await Idea.aggregate([
                { $match: query },
                {
                    $lookup: {
                        from: 'comments',
                        localField: '_id',
                        foreignField: 'ideaId',
                        as: 'comments'
                    }
                },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'ideaId',
                        as: 'votes'
                    }
                },
                {
                    $addFields: {
                        comment_count: { $size: '$comments' },
                        vote_count: { $size: '$votes' }
                    }
                },
                {
                    $project: {
                        comments: 0,
                        votes: 0,
                        __v: 0
                    }
                },
                {
                    $sort: {
                        isFeatured: -1,
                        votes: -1,
                        createdAt: -1
                    }
                }
            ]);

            // Заменяем author на authorName
            return ideas.map(idea => ({
                id: idea._id,
                title: idea.title,
                description: idea.description,
                author: idea.authorName,
                authorId: idea.author,
                votes: idea.votes,
                status: idea.status,
                isFeatured: idea.isFeatured,
                created_at: idea.createdAt,
                comment_count: idea.comment_count,
                vote_count: idea.vote_count
            }));

        } catch (error) {
            console.error('❌ Ошибка получения идей:', error);
            throw error;
        }
    }

    // Добавить новую идею
    async addIdea(title, description, userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            const idea = new Idea({
                title,
                description,
                author: userId,
                authorName: user.username,
                status: user.role === 'content_manager' ? 'approved' : 'pending'
            });

            const savedIdea = await idea.save();
            return { success: true, id: savedIdea._id, status: idea.status };

        } catch (error) {
            console.error('❌ Ошибка добавления идеи:', error);
            
            if (error.errors?.title) {
                throw new Error(error.errors.title.message);
            }
            if (error.errors?.description) {
                throw new Error(error.errors.description.message);
            }
            
            throw new Error('Не удалось добавить идею');
        }
    }

    // Проголосовать за идею
    async voteForIdea(ideaId, userId, userIp) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();

            // Проверяем существование идеи
            const idea = await Idea.findById(ideaId).session(session);
            if (!idea) {
                throw new Error('Идея не найдена');
            }

            // Проверяем статус идеи
            if (idea.status !== 'approved' && idea.status !== 'featured') {
                throw new Error('За эту идею пока нельзя голосовать');
            }

            // Пытаемся добавить голос
            try {
                const vote = new Vote({
                    ideaId,
                    userId,
                    userIp
                });
                await vote.save({ session });
            } catch (error) {
                if (error.code === 11000) {
                    throw new Error('Вы уже голосовали за эту идею');
                }
                throw error;
            }

            // Увеличиваем счетчик голосов
            idea.votes += 1;
            await idea.save({ session });

            await session.commitTransaction();
            return { success: true };

        } catch (error) {
            await session.abortTransaction();
            throw error;
            
        } finally {
            session.endSession();
        }
    }

    // Добавить комментарий
    async addComment(ideaId, userId, text) {
        try {
            // Проверяем существование идеи
            const idea = await Idea.findById(ideaId);
            if (!idea) {
                throw new Error('Идея не найдена');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            const comment = new Comment({
                ideaId,
                author: userId,
                authorName: user.username,
                text
            });

            const savedComment = await comment.save();
            return { success: true, id: savedComment._id };

        } catch (error) {
            console.error('❌ Ошибка добавления комментария:', error);
            
            if (error.errors?.text) {
                throw new Error(error.errors.text.message);
            }
            
            throw new Error('Не удалось добавить комментарий');
        }
    }

    // Получить комментарии для идеи
    async getComments(ideaId) {
        try {
            const comments = await Comment.find({ ideaId })
                .sort({ createdAt: 1 })
                .lean();
            
            return comments.map(comment => ({
                id: comment._id,
                idea_id: comment.ideaId,
                author: comment.authorName,
                authorId: comment.author,
                text: comment.text,
                created_at: comment.createdAt
            }));

        } catch (error) {
            console.error('❌ Ошибка получения комментариев:', error);
            throw error;
        }
    }

    // ========== МЕТОДЫ ДЛЯ МОДЕРАТОРОВ И КОНТЕНТ-МЕНЕДЖЕРОВ ==========

    // Обновить статус идеи (для контент-менеджеров)
    async updateIdeaStatus(ideaId, status, reviewedBy, notes = '') {
        try {
            const idea = await Idea.findById(ideaId);
            if (!idea) {
                throw new Error('Идея не найдена');
            }

            idea.status = status;
            idea.reviewedBy = reviewedBy;
            idea.reviewedAt = new Date();
            idea.reviewNotes = notes;

            // Если статус featured, то ставим флаг
            if (status === 'featured') {
                idea.isFeatured = true;
            }

            await idea.save();
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            throw error;
        }
    }

    // Удалить идею (для модераторов)
    async deleteIdea(ideaId, moderatorId) {
        try {
            const idea = await Idea.findById(ideaId);
            if (!idea) {
                throw new Error('Идея не найдена');
            }

            // Проверяем права (можно удалять только свои или чужие с разрешением)
            const moderator = await User.findById(moderatorId);
            
            if (moderator.role === 'moderator' || moderator.role === 'admin') {
                // Удаляем связанные комментарии и голоса
                await Comment.deleteMany({ ideaId });
                await Vote.deleteMany({ ideaId });
                await Idea.deleteOne({ _id: ideaId });
                
                return { success: true, message: 'Идея удалена' };
            } else if (idea.author.toString() === moderatorId.toString()) {
                // Автор может удалить свою идею
                await Idea.deleteOne({ _id: ideaId });
                await Comment.deleteMany({ ideaId });
                await Vote.deleteMany({ ideaId });
                
                return { success: true, message: 'Идея удалена' };
            } else {
                throw new Error('Недостаточно прав для удаления');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления идеи:', error);
            throw error;
        }
    }

    // Удалить комментарий (для модераторов)
    async deleteComment(commentId, moderatorId) {
        try {
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('Комментарий не найден');
            }

            const moderator = await User.findById(moderatorId);
            
            if (moderator.role === 'moderator' || moderator.role === 'admin' || 
                comment.author.toString() === moderatorId.toString()) {
                await Comment.deleteOne({ _id: commentId });
                return { success: true, message: 'Комментарий удален' };
            } else {
                throw new Error('Недостаточно прав для удаления');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления комментария:', error);
            throw error;
        }
    }

    // Получить идеи на модерацию
    async getIdeasForModeration() {
        try {
            const ideas = await Idea.find({ status: 'pending' })
                .populate('author', 'username email')
                .sort({ createdAt: 1 })
                .lean();
            
            return ideas;
        } catch (error) {
            console.error('❌ Ошибка получения идей на модерацию:', error);
            throw error;
        }
    }

    // Получить статистику
    async getStats() {
        try {
            const ideasCount = await Idea.countDocuments();
            const commentsCount = await Comment.countDocuments();
            const votesCount = await Vote.countDocuments();
            const usersCount = await User.countDocuments();
            const pendingIdeas = await Idea.countDocuments({ status: 'pending' });
            
            return {
                ideas: ideasCount,
                comments: commentsCount,
                votes: votesCount,
                users: usersCount,
                pending: pendingIdeas
            };
        } catch (error) {
            console.error('❌ Ошибка получения статистики:', error);
            return { ideas: 0, comments: 0, votes: 0, users: 0, pending: 0 };
        }
    }

    // Тест подключения
    async testConnection() {
        try {
            await mongoose.connection.db.admin().ping();
            return { connected: true };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
}

// Экспортируем экземпляр базы данных
const database = new Database();
module.exports = database;
