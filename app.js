const body = document.querySelector('body');
const toggleButton = document.querySelector('#toggle-theme');

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    body.className = savedTheme;

} else {
    body.className = prefersDark ? 'latex-dark-auto' : 'latex-light-auto';
}

const savedBtnTheme = localStorage.getItem('btn-theme');
if (savedBtnTheme) {
    toggleButton.className = savedBtnTheme;
} else {
    toggleButton.className = prefersDark ? 'btn btn-dark' : 'btn btn-light';
}

toggleButton.addEventListener('click', () => {
    const currentTheme = body.classList.contains('latex-light-auto') ? 'latex-dark-auto' : 'latex-light-auto';
    body.className = currentTheme;
    localStorage.setItem('theme', currentTheme);

    const buttonTheme = toggleButton.classList.contains('btn-light') ? 'btn btn-dark' : 'btn btn-light';
    toggleButton.className = buttonTheme;
    localStorage.setItem('btn-theme', buttonTheme);
});
