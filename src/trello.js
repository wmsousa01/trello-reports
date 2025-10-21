// src/trello.js
const ICON_URL = 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png';
const DASH_URL_TEMPLATE = 'https://trello-reports.vercel.app/index.html?boardId={board.id}&mode=public&access=devtoken';

function urlWithBoardId(t) {
  try {
    const ctx = t.getContext(); // { board, card, member, ... }
    const bid = ctx?.board || 'CUUp9Mv3'; // fallback
    return DASH_URL_TEMPLATE.replace('{board.id}', bid);
  } catch {
    return DASH_URL_TEMPLATE.replace('{board.id}', 'CUUp9Mv3');
  }
}

window.TrelloPowerUp.initialize({
  // 🔘 Botão no topo
  'board-buttons': (t) => ([
    {
      icon: { url: ICON_URL, alt: 'Dashboard' },
      text: '📊 Abrir Dashboard',
      callback: async () => {
        const raw = urlWithBoardId(t);
        const signed = await t.signUrl(raw);
        // abre em modal dentro do Trello (melhor UX e menos bloqueio)
        await t.modal({
          title: '📊 Dashboard',
          url: signed,
          fullscreen: true
        });
        return t.closePopup();
      }
    }
  ]),

  // 📊 Visualização embutida (menu “Visualizações do quadro”)
  'board-views': (t) => ([
    {
      // importante: usar URL assinada
      url: async () => {
        const raw = urlWithBoardId(t);
        return t.signUrl(raw);
      },
      name: '📊 Dashboard',
      // opcional: ícone na aba
      icon: { url: ICON_URL }
    }
  ]),

  // ⚙️ Configurações (abre a mesma dashboard em fullscreen)
  'show-settings': async (t) => {
    const raw = urlWithBoardId(t);
    const signed = await t.signUrl(raw);
    return t.modal({
      title: '📊 Dashboard',
      url: signed,
      fullscreen: true
    });
  }
}, { appName: 'Trello Reports' });
