// init-admin.js - создание первого администратора
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 
    'mongodb+srv://Leonid:yzF-UgN-teN-TQ8@cluster0.52cmiku.mongodb.net/school_auth?appName=Cluster0';

async function createAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Подключено к MongoDB');

        const User = mongoose.model('User', new mongoose.Schema({
            email: String,
            passwordHash: String,
            username: String,
            role: String,
            emailVerified: Boolean,
            isActive: Boolean
        }));

        const InvitationCode = mongoose.model('InvitationCode', new mongoose.Schema({
            code: String,
            role: String,
            createdBy: mongoose.Schema.Types.ObjectId,
            usedBy: mongoose.Schema.Types.ObjectId,
            usedAt: Date,
            maxUses: Number,
            useCount: Number,
            expiresAt: Date
        }));

        // Создаем администратора
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('admin123', salt);
        
        const admin = new User({
            email: 'admin@school.ru',
            passwordHash,
            username: 'Администратор',
            role: 'admin',
            emailVerified: true,
            isActive: true
        });

        await admin.save();
        console.log('👑 Администратор создан:');
        console.log('📧 Email: admin@school.ru');
        console.log('🔑 Пароль: admin123');
        console.log('⚠️ СМЕНИТЕ ПАРОЛЬ ПОСЛЕ ПЕРВОГО ВХОДА!');

        // Создаем тестовые коды приглашения
        const crypto = require('crypto');
        
        // Код для модератора
        const moderatorCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const moderatorInvite = new InvitationCode({
            code: moderatorCode,
            role: 'moderator',
            createdBy: admin._id,
            maxUses: 5,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        // Код для контент-менеджера
        const contentManagerCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const contentManagerInvite = new InvitationCode({
            code: contentManagerCode,
            role: 'content_manager',
            createdBy: admin._id,
            maxUses: 5,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        await moderatorInvite.save();
        await contentManagerInvite.save();

        console.log('\n🎟️ Коды приглашения созданы:');
        console.log(`👮 Модератор: ${moderatorCode}`);
        console.log(`📊 Контент-менеджер: ${contentManagerCode}`);

        await mongoose.disconnect();
        console.log('\n✅ Инициализация завершена!');

    } catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    }
}

createAdmin();
