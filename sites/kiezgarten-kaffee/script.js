const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav-menu');

if (toggle && nav) {
  const closeMenu = () => {
    nav.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('active');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('active')) {
      closeMenu();
      toggle.focus();
    }
  });
}
