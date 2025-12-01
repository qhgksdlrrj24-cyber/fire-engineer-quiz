// Quiz Application Logic
class QuizApp {
    constructor() {
        this.allData = {};
        this.currentMode = 'deck';
        this.selectedDecks = [];
        this.currentQuestions = [];
        this.currentIndex = 0;
        this.completedQuestions = new Set();
        this.starredQuestions = new Set();
        this.init();
    }

    async init() {
        this.loadData();
        this.loadProgress();
        this.setupEventListeners();
        this.updateStats();
        this.renderDeckSelection();
        this.hideLoading();
    }

    loadData() {
        // 오프라인용: 임베디드 데이터 사용
        if (typeof QUESTIONS_DATA !== 'undefined') {
            this.allData = QUESTIONS_DATA;
        } else {
            alert('문제 데이터를 불러올 수 없습니다. questions-data-embedded.js 파일을 확인해주세요.');
        }
    }

    loadProgress() {
        const saved = localStorage.getItem('quizProgress');
        if (saved) {
            const progress = JSON.parse(saved);
            this.completedQuestions = new Set(progress.completed || []);
            this.starredQuestions = new Set(progress.starred || []);
            // Load saved indices for each mode/deck combination
            this.savedIndices = progress.savedIndices || {};
        } else {
            this.savedIndices = {};
        }
    }

    saveProgress() {
        const progress = {
            completed: Array.from(this.completedQuestions),
            starred: Array.from(this.starredQuestions),
            savedIndices: this.savedIndices
        };
        localStorage.setItem('quizProgress', JSON.stringify(progress));

        // Trigger storage event for other tabs (custom event for same tab)
        window.dispatchEvent(new CustomEvent('quizProgressUpdated', { detail: progress }));
    }

    // Get unique key for current quiz session
    getSessionKey() {
        if (this.currentMode === 'all') {
            return 'mode_all';
        } else if (this.currentMode === 'starred') {
            return 'mode_starred';
        } else if (this.currentMode === 'deck') {
            // Sort deck names to ensure consistent key
            return 'deck_' + this.selectedDecks.sort().join('_');
        }
        return 'unknown';
    }

    // Save current index for the current session
    saveCurrentIndex() {
        const sessionKey = this.getSessionKey();
        this.savedIndices[sessionKey] = this.currentIndex;
        this.saveProgress();
    }

    // Load saved index for the current session
    loadCurrentIndex() {
        const sessionKey = this.getSessionKey();
        return this.savedIndices[sessionKey] || 0;
    }

    setupEventListeners() {
        // Mode selection
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.currentMode = card.dataset.mode;
                this.updateDeckSelectionVisibility();
            });
        });

        // Start button
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startQuiz();
        });

        // Reset progress button
        document.getElementById('resetProgressBtn').addEventListener('click', () => {
            this.resetProgress();
        });

        // Quiz controls
        document.getElementById('showAnswerBtn').addEventListener('click', () => {
            this.showAnswer();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            this.nextQuestion();
        });

        document.getElementById('prevBtn').addEventListener('click', () => {
            this.prevQuestion();
        });

        document.getElementById('starBtn').addEventListener('click', () => {
            this.toggleStar();
        });

        document.getElementById('backToSetupBtn').addEventListener('click', () => {
            this.backToSetup();
        });

        // Listen for storage changes from other tabs/windows
        window.addEventListener('storage', (e) => {
            if (e.key === 'quizProgress' && e.newValue) {
                this.handleProgressUpdate(JSON.parse(e.newValue));
            }
        });

        // Listen for custom event from same tab
        window.addEventListener('quizProgressUpdated', (e) => {
            // This handles updates within the same tab
            this.updateStats();
        });
    }

    handleProgressUpdate(progress) {
        // Update local state with data from other tabs
        this.completedQuestions = new Set(progress.completed || []);
        this.starredQuestions = new Set(progress.starred || []);
        this.savedIndices = progress.savedIndices || {};

        // Update UI
        this.updateStats();

        // If currently in quiz mode, update the star button
        if (!document.getElementById('quizScreen').classList.contains('hidden')) {
            const question = this.currentQuestions[this.currentIndex];
            const starBtn = document.getElementById('starBtn');
            if (this.starredQuestions.has(question.id)) {
                starBtn.classList.add('starred');
            } else {
                starBtn.classList.remove('starred');
            }
        }
    }

    updateDeckSelectionVisibility() {
        const deckArea = document.getElementById('deckSelectionArea');
        if (this.currentMode === 'deck') {
            deckArea.style.display = 'block';
        } else {
            deckArea.style.display = 'none';
        }
    }

    renderDeckSelection() {
        const container = document.getElementById('deckSelection');
        container.innerHTML = '';

        Object.keys(this.allData).forEach(deckLabel => {
            const count = this.allData[deckLabel].length;
            const btn = document.createElement('button');
            btn.className = 'deck-btn';
            btn.innerHTML = `
                ${deckLabel}
                <span class="deck-count">${count}문제</span>
            `;
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                if (btn.classList.contains('active')) {
                    this.selectedDecks.push(deckLabel);
                } else {
                    this.selectedDecks = this.selectedDecks.filter(d => d !== deckLabel);
                }
            });
            container.appendChild(btn);
        });
    }

    startQuiz() {
        // Prepare questions based on mode
        this.currentQuestions = [];

        if (this.currentMode === 'all') {
            // All questions
            Object.values(this.allData).forEach(questions => {
                this.currentQuestions.push(...questions);
            });
        } else if (this.currentMode === 'starred') {
            // Starred questions only
            Object.values(this.allData).forEach(questions => {
                const starred = questions.filter(q => this.starredQuestions.has(q.id));
                this.currentQuestions.push(...starred);
            });

            if (this.currentQuestions.length === 0) {
                alert('별표 표시된 문제가 없습니다. 먼저 문제를 풀면서 별표를 추가해주세요.');
                return;
            }
        } else if (this.currentMode === 'deck') {
            // Selected decks
            if (this.selectedDecks.length === 0) {
                alert('학습할 강의를 선택해주세요.');
                return;
            }

            this.selectedDecks.forEach(deckLabel => {
                this.currentQuestions.push(...this.allData[deckLabel]);
            });
        }

        if (this.currentQuestions.length === 0) {
            alert('학습할 문제가 없습니다.');
            return;
        }

        // Load saved index for this session, or start from 0
        this.currentIndex = this.loadCurrentIndex();

        // Ensure currentIndex is within bounds
        if (this.currentIndex >= this.currentQuestions.length) {
            this.currentIndex = 0;
        }

        this.showQuizScreen();
        this.displayQuestion();
    }

    showQuizScreen() {
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('quizScreen').classList.remove('hidden');
    }

    hideQuizScreen() {
        document.getElementById('setupScreen').classList.remove('hidden');
        document.getElementById('quizScreen').classList.add('hidden');
    }

    displayQuestion() {
        const question = this.currentQuestions[this.currentIndex];

        // Update progress
        document.getElementById('progressInfo').textContent =
            `문제 ${this.currentIndex + 1} / ${this.currentQuestions.length}`;

        const progressPercent = ((this.currentIndex + 1) / this.currentQuestions.length) * 100;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;

        // Display question
        document.getElementById('questionText').innerHTML = question.question;

        // Clear user answer textarea
        document.getElementById('userAnswerText').value = '';

        // Update star button
        const starBtn = document.getElementById('starBtn');
        if (this.starredQuestions.has(question.id)) {
            starBtn.classList.add('starred');
        } else {
            starBtn.classList.remove('starred');
        }

        // Hide answer initially
        document.getElementById('answerCard').classList.remove('show');
        document.getElementById('answerText').innerHTML = question.answer;

        // Update button states
        document.getElementById('prevBtn').disabled = this.currentIndex === 0;
        document.getElementById('nextBtn').disabled = this.currentIndex === this.currentQuestions.length - 1;

        // Mark as viewed (completed)
        this.completedQuestions.add(question.id);

        // Save current index
        this.saveCurrentIndex();
        this.updateStats();
    }

    showAnswer() {
        document.getElementById('answerCard').classList.add('show');
    }

    nextQuestion() {
        if (this.currentIndex < this.currentQuestions.length - 1) {
            this.currentIndex++;
            this.displayQuestion();
        }
    }

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayQuestion();
        }
    }

    toggleStar() {
        const question = this.currentQuestions[this.currentIndex];
        const starBtn = document.getElementById('starBtn');

        if (this.starredQuestions.has(question.id)) {
            this.starredQuestions.delete(question.id);
            starBtn.classList.remove('starred');
        } else {
            this.starredQuestions.add(question.id);
            starBtn.classList.add('starred');
        }

        this.saveProgress();
        this.updateStats();
    }

    backToSetup() {
        this.hideQuizScreen();
        this.selectedDecks = [];
        document.querySelectorAll('.deck-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    updateStats() {
        // Total questions
        let totalCount = 0;
        Object.values(this.allData).forEach(questions => {
            totalCount += questions.length;
        });
        document.getElementById('totalQuestions').textContent = totalCount;

        // Completed questions
        document.getElementById('completedQuestions').textContent = this.completedQuestions.size;

        // Starred questions
        document.getElementById('starredQuestions').textContent = this.starredQuestions.size;

        // Progress percentage
        const progressPercent = totalCount > 0 ?
            Math.round((this.completedQuestions.size / totalCount) * 100) : 0;
        document.getElementById('progressPercent').textContent = `${progressPercent}%`;
    }

    resetProgress() {
        if (confirm('학습 진도를 초기화하시겠습니까?\n완료한 문제와 별표 표시가 모두 삭제됩니다.')) {
            this.completedQuestions.clear();
            this.starredQuestions.clear();
            localStorage.removeItem('quizProgress');
            this.updateStats();
            alert('학습 진도가 초기화되었습니다.');
        }
    }

    hideLoading() {
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('setupScreen').classList.remove('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
