// 상태 관리
let currentQuestionIndex = 0;
let userProfile = {};
let isConsultationActive = false;

// 질문 데이터
const questions = [
    {
        id: 'name',
        question: '먼저 성함을 알려주시겠어요? 😊',
        field: '이름'
    },
    {
        id: 'age',
        question: '나이를 알려주세요.',
        field: '나이'
    },
    {
        id: 'job',
        question: '현재 직업이나 직종은 무엇인가요?',
        field: '직업'
    },
    {
        id: 'hobby',
        question: '평소 취미나 관심사는 무엇인가요? 여러 개를 말씀해주셔도 좋습니다.',
        field: '취미/관심사'
    },
    {
        id: 'idealType',
        question: '이상형의 성격이나 외모적 특징을 자유롭게 말씀해주세요.',
        field: '이상형'
    },
    {
        id: 'values',
        question: '결혼 생활에서 가장 중요하게 생각하는 가치관은 무엇인가요? (예: 소통, 경제력, 성격, 가족관 등)',
        field: '결혼 가치관'
    },
    {
        id: 'lifestyle',
        question: '선호하는 생활 패턴은 어떤가요? (예: 활동적, 집순이/집돌이, 여행 좋아함 등)',
        field: '생활 패턴'
    },
    {
        id: 'future',
        question: '결혼 후 어떤 가정을 꾸리고 싶으신가요?',
        field: '미래 계획'
    }
];

// DOM 요소
const chatContainer = document.getElementById('chatContainer');
const startBtn = document.getElementById('startBtn');
const answerInput = document.getElementById('answerInput');
const userAnswer = document.getElementById('userAnswer');
const sendBtn = document.getElementById('sendBtn');
const profileSection = document.getElementById('profileSection');
const profileContent = document.getElementById('profileContent');
const restartBtn = document.getElementById('restartBtn');
const matchBtn = document.getElementById('matchBtn');

// 상담 시작
function startConsultation() {
    isConsultationActive = true;
    startBtn.style.display = 'none';
    answerInput.style.display = 'flex';
    
    // 시작 메시지 추가
    addAIMessage('그럼 시작하겠습니다! 편하게 답변해주세요. 💝');
    
    setTimeout(() => {
        askQuestion();
    }, 1000);
}

// AI 메시지 추가
function addAIMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message';
    messageDiv.innerHTML = `
        <div class="ai-avatar">🤖</div>
        <div class="message-content">
            <p><strong>AI 컨설턴트</strong></p>
            <p>${message}</p>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 사용자 메시지 추가
function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-message';
    messageDiv.innerHTML = `
        <div class="user-avatar">😊</div>
        <div class="message-content">
            <p>${message}</p>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 타이핑 인디케이터 표시
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="ai-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    chatContainer.appendChild(typingDiv);
    scrollToBottom();
}

// 타이핑 인디케이터 제거
function removeTypingIndicator() {
    const typingDiv = document.getElementById('typingIndicator');
    if (typingDiv) {
        typingDiv.remove();
    }
}

// 질문하기
function askQuestion() {
    if (currentQuestionIndex >= questions.length) {
        completeConsultation();
        return;
    }

    showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator();
        const currentQuestion = questions[currentQuestionIndex];
        addAIMessage(currentQuestion.question);
        userAnswer.focus();
    }, 1500);
}

// 답변 전송
function sendAnswer() {
    const answer = userAnswer.value.trim();
    
    if (answer === '') {
        alert('답변을 입력해주세요!');
        return;
    }

    // 사용자 답변 저장
    const currentQuestion = questions[currentQuestionIndex];
    userProfile[currentQuestion.field] = answer;
    
    // 메시지 표시
    addUserMessage(answer);
    userAnswer.value = '';
    
    // 다음 질문으로
    currentQuestionIndex++;
    
    setTimeout(() => {
        if (currentQuestionIndex < questions.length) {
            addAIMessage('감사합니다! 😊');
            setTimeout(askQuestion, 1000);
        } else {
            completeConsultation();
        }
    }, 500);
}

// 상담 완료
function completeConsultation() {
    isConsultationActive = false;
    answerInput.style.display = 'none';
    
    addAIMessage('모든 질문이 끝났습니다! 감사합니다. 😊');
    
    setTimeout(() => {
        addAIMessage('지금부터 입력하신 정보를 바탕으로 프로필을 분석하겠습니다...');
        
        setTimeout(() => {
            showProfile();
        }, 2000);
    }, 1000);
}

// 프로필 표시
function showProfile() {
    chatContainer.style.display = 'none';
    profileSection.style.display = 'block';
    
    let profileHTML = '';
    for (const [key, value] of Object.entries(userProfile)) {
        profileHTML += `
            <div class="profile-item">
                <span class="profile-label">${key}</span>
                <div class="profile-value">${value}</div>
            </div>
        `;
    }
    
    profileContent.innerHTML = profileHTML;
}

// 다시 시작
function restart() {
    // 초기화
    currentQuestionIndex = 0;
    userProfile = {};
    isConsultationActive = false;
    
    // UI 초기화
    chatContainer.innerHTML = `
        <div class="welcome-message">
            <div class="ai-avatar">🤖</div>
            <div class="message-content">
                <p><strong>AI 컨설턴트</strong></p>
                <p>안녕하세요! 결정사의 AI 매칭 컨설턴트입니다. 😊</p>
                <p>몇 가지 질문을 통해 당신의 이상형과 결혼관을 파악하여 최적의 매칭을 도와드리겠습니다.</p>
                <p>준비되셨다면 아래 버튼을 눌러주세요!</p>
            </div>
        </div>
    `;
    
    chatContainer.style.display = 'block';
    profileSection.style.display = 'none';
    startBtn.style.display = 'block';
    answerInput.style.display = 'none';
}

// 매칭 시작
function startMatching() {
    alert('매칭 시스템은 곧 오픈될 예정입니다! 💝\n\n입력하신 프로필을 바탕으로 최적의 파트너를 찾아드리겠습니다.');
}

// 스크롤 하단으로
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 이벤트 리스너
startBtn.addEventListener('click', startConsultation);

sendBtn.addEventListener('click', sendAnswer);

userAnswer.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAnswer();
    }
});

restartBtn.addEventListener('click', restart);
matchBtn.addEventListener('click', startMatching);
