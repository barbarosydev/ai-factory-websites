const toggle = document.querySelector('#menu-button');
const navList = document.querySelector('#nav-menu');

if (toggle && navList) {
  const closeNav = () => {
    navList.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('active');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  navList.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navList.classList.contains('active')) {
      closeNav();
      toggle.focus();
    }
  });
}
