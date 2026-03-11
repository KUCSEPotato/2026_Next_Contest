// Sample projects data
let projects = [
    {
        id: 1,
        title: "AI Study Planner",
        description: "An intelligent study planning application that uses machine learning to optimize learning schedules based on user behavior and performance.",
        tech: ["Python", "FastAPI", "React", "AI"],
        github: "https://github.com/example/studyplanner",
        reason: "Team members became busy during exam period and we couldn't maintain consistent development.",
        lessons: "Building a good scheduling algorithm is harder than expected. Should have started with a simpler MVP.",
        status: "Abandoned"
    },
    {
        id: 2,
        title: "Real-Time Collaboration Whiteboard",
        description: "A collaborative whiteboard with real-time synchronization for remote team meetings and brainstorming sessions.",
        tech: ["React", "Socket.io", "Node.js", "Canvas"],
        github: "https://github.com/example/whiteboard",
        reason: "Underestimated the complexity of real-time synchronization and conflict resolution.",
        lessons: "Real-time systems need careful architecture planning from the start. WebRTC might have been a better choice.",
        status: "Abandoned"
    },
    {
        id: 3,
        title: "Recipe Recommendation Engine",
        description: "A mobile app that recommends recipes based on ingredients you have at home using computer vision.",
        tech: ["React Native", "Python", "TensorFlow", "Mobile"],
        github: "https://github.com/example/recipes",
        reason: "The image recognition accuracy was not good enough for production use.",
        lessons: "Training custom ML models requires more data than we thought. Pre-trained models might work better.",
        status: "Abandoned"
    },
    {
        id: 4,
        title: "Indie Game Platformer",
        description: "A 2D platformer game with procedurally generated levels and unique art style inspired by pixel art classics.",
        tech: ["Unity", "C#", "Game"],
        github: "https://github.com/example/platformer",
        reason: "Game development took much longer than expected, and we lost motivation after 6 months.",
        lessons: "Game development is a marathon, not a sprint. Need better project scoping and milestone planning.",
        status: "Abandoned"
    }
];

let currentFilter = 'all';
let currentSearch = '';

// DOM Elements
const projectsGrid = document.getElementById('projectsGrid');
const addProjectBtn = document.getElementById('addProjectBtn');
const addProjectModal = document.getElementById('addProjectModal');
const projectDetailModal = document.getElementById('projectDetailModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const cancelBtn = document.getElementById('cancelBtn');
const projectForm = document.getElementById('projectForm');
const searchInput = document.getElementById('searchInput');
const techFilters = document.getElementById('techFilters');

// Initialize
renderProjects();

// Event Listeners
addProjectBtn.addEventListener('click', () => {
    addProjectModal.classList.add('show');
});

closeModalBtn.addEventListener('click', () => {
    addProjectModal.classList.remove('show');
});

closeDetailBtn.addEventListener('click', () => {
    projectDetailModal.classList.remove('show');
});

cancelBtn.addEventListener('click', () => {
    addProjectModal.classList.remove('show');
});

// Close modal when clicking outside
addProjectModal.addEventListener('click', (e) => {
    if (e.target === addProjectModal) {
        addProjectModal.classList.remove('show');
    }
});

projectDetailModal.addEventListener('click', (e) => {
    if (e.target === projectDetailModal) {
        projectDetailModal.classList.remove('show');
    }
});

// Form Submit
projectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newProject = {
        id: projects.length + 1,
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value,
        tech: document.getElementById('projectTech').value.split(',').map(t => t.trim()),
        github: document.getElementById('projectGithub').value || '#',
        reason: document.getElementById('projectReason').value,
        lessons: document.getElementById('projectLessons').value,
        status: 'Abandoned'
    };
    
    projects.unshift(newProject);
    renderProjects();
    
    // Reset form and close modal
    projectForm.reset();
    addProjectModal.classList.remove('show');
    
    // Show success message
    alert('✅ Project added successfully! Thank you for sharing your experience.');
});

// Search
searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderProjects();
});

// Tech Filter
techFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tag')) {
        // Remove active class from all tags
        techFilters.querySelectorAll('.filter-tag').forEach(tag => {
            tag.classList.remove('active');
        });
        
        // Add active class to clicked tag
        e.target.classList.add('active');
        
        currentFilter = e.target.dataset.tech;
        renderProjects();
    }
});

// Render Projects
function renderProjects() {
    const filteredProjects = projects.filter(project => {
        // Filter by tech
        const matchesTech = currentFilter === 'all' || 
                          project.tech.some(t => t.toLowerCase().includes(currentFilter.toLowerCase()));
        
        // Filter by search
        const matchesSearch = currentSearch === '' || 
                            project.title.toLowerCase().includes(currentSearch) ||
                            project.description.toLowerCase().includes(currentSearch);
        
        return matchesTech && matchesSearch;
    });
    
    if (filteredProjects.length === 0) {
        projectsGrid.innerHTML = `
            <div class="empty-state">
                <div class="icon">🔍</div>
                <h3>No projects found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }
    
    projectsGrid.innerHTML = filteredProjects.map(project => `
        <div class="project-card" onclick="showProjectDetail(${project.id})">
            <div class="project-header">
                <div>
                    <h3 class="project-title">${project.title}</h3>
                </div>
                <span class="project-status">${project.status}</span>
            </div>
            <p class="project-description">${project.description}</p>
            <div class="project-tech">
                ${project.tech.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
            </div>
            <div class="project-footer">
                <span class="project-reason">💭 ${project.reason.substring(0, 50)}...</span>
            </div>
        </div>
    `).join('');
}

// Show Project Detail
function showProjectDetail(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    document.getElementById('detailTitle').textContent = project.title;
    document.getElementById('detailDescription').textContent = project.description;
    document.getElementById('detailTechStack').innerHTML = project.tech.map(tech => 
        `<span class="tech-tag">${tech}</span>`
    ).join('');
    document.getElementById('detailReason').textContent = project.reason;
    document.getElementById('detailLessons').textContent = project.lessons;
    
    const githubLink = document.getElementById('detailGithub');
    if (project.github && project.github !== '#') {
        githubLink.href = project.github;
        githubLink.style.display = 'inline-block';
    } else {
        githubLink.style.display = 'none';
    }
    
    // Adopt button
    document.getElementById('adoptBtn').onclick = () => {
        alert(`🎉 Great! You're interested in adopting "${project.title}"!\n\nIn a full version, this would:\n- Connect you with the original creator\n- Fork the repository\n- Set up collaboration tools\n\nFor now, check out the GitHub link to get started!`);
    };
    
    projectDetailModal.classList.add('show');
}

// Make function available globally
window.showProjectDetail = showProjectDetail;