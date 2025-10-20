/* src/trello.js */
window.TrelloPowerUp.initialize({
  'board-buttons': function (t, opts) {
    return [
      {
        icon: {
          url: 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png',
          alt: 'Dashboard'
        },
        text: '📊 Abrir Dashboard',
        callback: function () {
          window.open(
            'https://trello-reports.vercel.app/index.html?boardId=CUUp9Mv3&mode=public&access=devtoken',
            '_blank'
          );
          return t.closePopup();
        }
      }
    ];
  }
});
