/* Desktop has one page shell. Mobile retains its original DOM and styles. */
(() => {
  const desktop = window.matchMedia('(min-width: 901px)');
  function syncShell() {
    const existing = document.querySelector('.desktop-page-shell');
    if (!desktop.matches) {
      if (existing) existing.replaceWith(...existing.childNodes);
      return;
    }
    if (existing) return;
    const header = document.querySelector('header.site-header');
    const main = document.querySelector('main');
    const footer = document.querySelector('footer.site-footer');
    if (!header || !main || !footer) return;
    const shell = document.createElement('div');
    shell.className = 'desktop-page-shell';
    header.before(shell);
    shell.append(header, main, footer);
    const mobileNav = document.getElementById('mobile-site-navigation');
    if (mobileNav) header.after(mobileNav);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncShell);
  else syncShell();
  desktop.addEventListener('change', syncShell);
})();
