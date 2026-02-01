// app.js - с системой авторизации
class CrowdsourcingApp {
    constructor() {
        this.currentIdeaId = null;
        this.apiBaseUrl = window.location.origin;
        this.currentUser = null;
        this.token = localStorage.getItem('auth_token');
        console.log('🚀 Приложение инициализировано');
    }

    // Инициализация при загрузке страницы
    async init() {
        // Проверяем авторизацию
        if (this.token) {
            await this.loadUserProfile();
        }
        
        await this.loadIdeas();
        this.setupEventListeners();
        this.setupGlobalFunctions();
        this.updateUIForAuth();
    }

    // Загрузка профиля пользователя
    async loadUserProfile() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                console.log('👤 Пользователь загружен:', this.currentUser.username);
            } else {
                // Токен невалидный, удаляем
                localStorage.removeItem('auth_token');
                this.token = null;
                this.currentUser = null;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    // Обновление UI в зависимости от авторизации
    updateUIForAuth() {
        const authSection = document.getElementById('authSection');
        const userSection = document.getElementById('userSection');
        const usernameSpan = document.getElementById('usernameSpan');
        const userRole = document.getElementById('userRole');
        const moderationPanel = document.getElementById('moderationPanel');
        const contentManagerPanel = document.getElementById('contentManagerPanel');
        
        if (!this.currentUser) {
            // Неавторизованный пользователь
            if (authSection) authSection.style.display = 'block';
            if (userSection) userSection.style.display = 'none';
            // Скрываем кнопки действий
            document.querySelectorAll('.auth-required').forEach(el => {
                el.style.display = 'none';
            });
        } else {
            // Авторизованный пользователь
            if (authSection) authSection.style.display = 'none';
            if (userSection) userSection.style.display = 'block';
            if (usernameSpan) usernameSpan.textContent = this.currentUser.username;
            if (userRole) userRole.textContent = this.getRoleLabel(this.currentUser.role);
            
            // Показываем кнопки действий
            document.querySelectorAll('.auth-required').forEach(el => {
                el.style.display = 'inline-flex';
            });
            
            // Панель модератора
            if (moderationPanel && (this.currentUser.role === 'moderator' || this.currentUser.role === 'admin')) {
                moderationPanel.style.display = 'block';
                this.loadModerationData();
            }
            
            // Панель контент-менеджера
            if (contentManagerPanel && (this.currentUser.role === 'content_manager' || this.currentUser.role === 'admin')) {
                contentManagerPanel.style.display = 'block';
                this.loadContentManagerData();
            }
        }
    }

    // Методы авторизации
    async register(email, password, username) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, username })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка регистрации');
            }
            
            const result = await response.json();
            this.showMessage('Регистрация успешна! Проверьте email для подтверждения.', 'success');
            
            // Показываем форму подтверждения
            this.showVerifyForm(email);
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.showError(error.message);
        }
    }

    async verifyEmail(email, code) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, code })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка подтверждения');
            }
            
            const result = await response.json();
            this.showMessage('Email успешно подтвержден! Теперь вы можете войти.', 'success');
            
            // Показываем форму входа
            this.showLoginForm();
            
        } catch (error) {
            console.error('❌ Ошибка подтверждения:', error);
            this.showError(error.message);
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка входа');
            }
            
            const result = await response.json();
            
            // Сохраняем токен
            this.token = result.token;
            localStorage.setItem('auth_token', this.token);
            this.currentUser = result.user;
            
            this.showMessage(`Добро пожаловать, ${result.user.username}!`, 'success');
            this.updateUIForAuth();
            this.loadIdeas();
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showError(error.message);
        }
    }

    logout() {
        if (this.token) {
            fetch(`${this.apiBaseUrl}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            }).catch(console.error);
        }
        
        localStorage.removeItem('auth_token');
        this.token = null;
        this.currentUser = null;
        this.showMessage('Вы вышли из системы', 'info');
        this.updateUIForAuth();
        this.loadIdeas();
    }

    async useInvitationCode(code) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/use-invitation`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка использования кода');
            }
            
            const result = await response.json();
            this.showMessage(result.message, 'success');
            
            // Обновляем профиль
            await this.loadUserProfile();
            this.updateUIForAuth();
            
        } catch (error) {
            console.error('❌ Ошибка использования кода:', error);
            this.showError(error.message);
        }
    }

    // Методы для модераторов
    async loadModerationData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/moderator/pending-ideas`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const ideas = await response.json();
                this.displayPendingIdeas(ideas);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных модерации:', error);
        }
    }

    async updateIdeaStatus(ideaId, status, notes = '') {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/moderator/ideas/${ideaId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status, notes })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления статуса');
            }
            
            const result = await response.json();
            this.showMessage(result.message, 'success');
            
            // Обновляем данные
            this.loadModerationData();
            this.loadIdeas();
            
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            this.showError(error.message);
        }
    }

    async deleteIdea(ideaId) {
        if (!confirm('Вы уверены, что хотите удалить эту идею? Это действие нельзя отменить.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/moderator/ideas/${ideaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления');
            }
            
            const result = await response.json();
            this.showMessage(result.message, 'success');
            
            // Обновляем данные
            this.loadModerationData();
            this.loadIdeas();
            
        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            this.showError(error.message);
        }
    }

    async deleteComment(commentId) {
        if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/moderator/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления');
            }
            
            const result = await response.json();
            this.showMessage(result.message, 'success');
            
            // Обновляем комментарии
            if (this.currentIdeaId) {
                this.loadAndDisplayComments(this.currentIdeaId);
            }
            
        } catch (error) {
            console.error('❌ Ошибка удаления комментария:', error);
            this.showError(error.message);
        }
    }

    // Методы для контент-менеджеров
    async loadContentManagerData() {
        // Загружаем статистику или другие данные
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/stats`);
            if (response.ok) {
                const stats = await response.json();
                this.displayStats(stats);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    }

    // Остальные методы остаются похожими, но с проверкой авторизации
    async submitIdea() {
        if (!this.currentUser) {
            this.showError('Для добавления идей необходимо войти в систему');
            this.showLoginForm();
            return;
        }
        
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        
        // Валидация
        if (!title || !description) {
            this.showError('Пожалуйста, заполните все поля');
            return;
        }
        
        if (title.length < 3) {
            this.showError('Название идеи должно быть не менее 3 символов');
            return;
        }
        
        if (description.length < 10) {
            this.showError('Описание должно быть не менее 10 символов');
            return;
        }
        
        // Показываем загрузку
        const submitBtn = document.querySelector('#ideaForm button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Публикую...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ideas`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    description
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка сервера');
            }
            
            const result = await response.json();
            
            // Очищаем форму
            document.getElementById('ideaForm').reset();
            
            // Показываем успех
            this.showMessage(result.message, 'success');
            
            // Обновляем список идей
            setTimeout(() => this.loadIdeas(), 1000);
            
        } catch (error) {
            console.error('❌ Ошибка добавления идеи:', error);
            this.showError(error.message);
            
        } finally {
            // Восстанавливаем кнопку
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;
        }
    }

    async voteForIdea(ideaId, buttonElement) {
        if (!this.currentUser) {
            this.showError('Для голосования необходимо войти в систему');
            this.showLoginForm();
            return;
        }
        
        if (!confirm('Вы уверены, что хотите поддержать эту идею?')) {
            return;
        }
        
        console.log(`👍 Голосую за идею ${ideaId}`);
        
        // Блокируем кнопку во время запроса
        const originalHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Голосую...';
        buttonElement.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ideas/${ideaId}/vote`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка голосования');
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Обновляем счетчик голосов на странице
                const voteCountElement = document.getElementById(`vote-count-${ideaId}`);
                if (voteCountElement) {
                    const currentVotes = parseInt(voteCountElement.textContent) || 0;
                    voteCountElement.textContent = currentVotes + 1;
                }
                
                // Показываем уведомление
                this.showMessage('Спасибо за ваш голос! 💙', 'success');
                
                // Перезагружаем список идей через 1 секунду
                setTimeout(() => this.loadIdeas(), 1000);
                
            } else {
                throw new Error(result.error || 'Ошибка голосования');
            }
            
        } catch (error) {
            console.error('❌ Ошибка голосования:', error);
            
            // Показываем понятную ошибку
            if (error.message.includes('уже голосовали')) {
                this.showError('Вы уже голосовали за эту идею!');
            } else if (error.message.includes('нельзя голосовать')) {
                this.showError(error.message);
            } else {
                this.showError(error.message || 'Не удалось проголосовать');
            }
            
        } finally {
            // Разблокируем кнопку
            buttonElement.innerHTML = originalHTML;
            buttonElement.disabled = false;
        }
    }

    async submitComment() {
        if (!this.currentUser) {
            this.showError('Для добавления комментариев необходимо войти в систему');
            this.showLoginForm();
            return;
        }
        
        if (!this.currentIdeaId) {
            this.showError('Не выбрана идея для комментария');
            return;
        }
        
        const text = document.getElementById('commentText').value.trim();
        
        // Валидация
        if (!text) {
            this.showError('Пожалуйста, введите текст комментария');
            return;
        }
        
        if (text.length < 2) {
            this.showError('Комментарий должен быть не менее 2 символов');
            return;
        }
        
        // Показываем загрузку
        const submitBtn = document.querySelector('#commentForm button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправляю...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ideas/${this.currentIdeaId}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка сервера');
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Очищаем поле с текстом
                document.getElementById('commentText').value = '';
                
                // Показываем успех
                this.showMessage('💬 Комментарий добавлен!', 'success');
                
                // Обновляем комментарии
                await this.loadAndDisplayComments(this.currentIdeaId);
                
                // Обновляем список идей (для счетчика комментариев)
                setTimeout(() => this.loadIdeas(), 1000);
                
            } else {
                throw new Error(result.error || 'Ошибка добавления');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления комментария:', error);
            this.showError(error.message || 'Не удалось добавить комментарий');
            
        } finally {
            // Восстанавливаем кнопку
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;
        }
    }

    // Вспомогательные методы для UI
    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('verifyForm').style.display = 'none';
    }

    showLoginForm() {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('verifyForm').style.display = 'none';
    }

    showVerifyForm(email = '') {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('verifyForm').style.display = 'block';
        document.getElementById('verifyEmail').value = email;
    }

    showInvitationForm() {
        const modal = document.getElementById('invitationModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    getRoleLabel(role) {
        const labels = {
            'user': 'Пользователь',
            'moderator': 'Модератор',
            'content_manager': 'Контент-менеджер',
            'admin': 'Администратор'
        };
        return labels[role] || role;
    }

    displayPendingIdeas(ideas) {
        const container = document.getElementById('pendingIdeasContainer');
        if (!container) return;
        
        if (!ideas || ideas.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-check-circle"></i>
                    <p>Нет идей на модерацию</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = ideas.map(idea => `
            <div class="pending-idea">
                <div class="pending-idea-header">
                    <h4>${this.escapeHtml(idea.title)}</h4>
                    <span class="pending-author">Автор: ${idea.author?.username || 'Аноним'}</span>
                </div>
                <p class="pending-description">${this.escapeHtml(idea.description)}</p>
                <div class="pending-actions">
                    <button class="btn-small btn-success" onclick="app.updateIdeaStatus('${idea._id}', 'approved')">
                        <i class="fas fa-check"></i> Одобрить
                    </button>
                    <button class="btn-small btn-warning" onclick="app.updateIdeaStatus('${idea._id}', 'featured')">
                        <i class="fas fa-star"></i> Выбрать лучшей
                    </button>
                    <button class="btn-small btn-danger" onclick="app.deleteIdea('${idea._id}')">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    displayStats(stats) {
        const container = document.getElementById('statsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <i class="fas fa-lightbulb"></i>
                    <h3>${stats.ideas}</h3>
                    <p>Идей</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-comments"></i>
                    <h3>${stats.comments}</h3>
                    <p>Комментариев</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-thumbs-up"></i>
                    <h3>${stats.votes}</h3>
                    <p>Голосов</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-users"></i>
                    <h3>${stats.users}</h3>
                    <p>Пользователей</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-clock"></i>
                    <h3>${stats.pending}</h3>
                    <p>На модерации</p>
                </div>
            </div>
        `;
    }

    // Остальные методы остаются без изменений
    // ... (loadIdeas, displayIdeas, openComments, loadAndDisplayComments и т.д.)
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========

// Глобальная переменная для приложения
let app;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Документ загружен');
    
    try {
        // Создаем экземпляр приложения
        app = new CrowdsourcingApp();
        
        // Делаем доступным глобально
        window.app = app;
        
        // Инициализируем приложение
        await app.init();
        
        console.log('✅ Приложение успешно запущено');
        console.log('📍 Доступно как window.app');
        
    } catch (error) {
        console.error('❌ Фатальная ошибка инициализации:', error);
        
        // Показываем сообщение об ошибке
        const container = document.getElementById('ideasContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #f44336;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <h3>Ошибка загрузки приложения</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="
                        padding: 10px 20px;
                        background: #4b6cb7;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 20px;
                    ">
                        <i class="fas fa-redo"></i> Перезагрузить страницу
                    </button>
                </div>
            `;
        }
    }
});
