// src/trello.js
const DASH_URL_TEMPLATE = 'https://trello-reports.vercel.app/index.html?boardId={board.id}&mode=public&access=devtoken';

function urlWithBoardId(t) {
  const ctx = t.getContext(); // { board, card, member, ... }
  return DASH_URL_TEMPLATE.replace('{board.id}', ctx.board);
}

window.TrelloPowerUp.initialize({
  // Botão no topo da board
  'board-buttons': (t) => ([
    {
      icon: { url: 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png', alt: 'Dashboard' },
      text: '📊 Abrir Dashboard',
      callback: () => {
        const url = urlWithBoardId(t);
        window.open(url, '_blank', 'noopener,noreferrer');
        return t.closePopup();
      }
    }
  ]),

  // Aba/visualização embutida no Trello (menu “Visualizações do quadro”)
  'board-views': (t) => ([
    {
      url: urlWithBoardId(t),
      name: '📊 Dashboard'
    }
  ]),

  // (Opcional) o que abre quando clicam em “Configurações” do Power-Up
  'show-settings': (t) => {
    return t.modal({
      title: '📊 Dashboard',
      url: urlWithBoardId(t),
      fullscreen: true
    });
  }
});
