// public/client.js
(function () {
  const ICON = { url: 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png', alt: 'Dashboard' };
  const APP_BASE = 'https://trello-reports.vercel.app/index.html'; // sua app React

  function buildUrl(t) {
    const ctx = t.getContext ? t.getContext() : {};
    const bid = ctx && ctx.board ? ctx.board : 'CUUp9Mv3';
    return `${APP_BASE}?boardId=${bid}&mode=public&access=devtoken`;
  }

  function openDashboard(t) {
    const url = buildUrl(t);
    // modal dentro do Trello (troque por window.open se preferir nova aba)
    return t.modal({ title: '📊 Dashboard', url: t.signUrl(url), fullscreen: true });
  }

  window.TrelloPowerUp.initialize(
    {
      // 🔘 botão no topo
      'board-buttons': (t) => [
        { icon: ICON, text: '📊 Abrir Dashboard', condition: 'always', callback: () => openDashboard(t) }
      ],

      // 📊 aba “Visualizações do quadro”
      'board-views': (t) => [
        {
          url: () => t.signUrl(buildUrl(t)), // avalia na hora
          name: '📊 Dashboard',
          icon: ICON
        }
      ],

      // ⚙️ configurações (opcional)
      'show-settings': (t) => openDashboard(t)
    },
    { appName: 'Trello Reports' }
  );
})();
