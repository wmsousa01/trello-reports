export default async function handler(req, res) {
  try {
    const { boardId, access } = req.query || {};

    const required = process.env.PUBLIC_DASHBOARD_TOKEN;
    if (required && access !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (!boardId || typeof boardId !== "string") {
      return res.status(400).json({ error: "missing boardId" });
    }

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    if (!key || !token) {
      return res.status(500).json({ error: "TRELLO_KEY or TRELLO_TOKEN not configured" });
    }

    const base = "https://api.trello.com/1";
    const auth = `key=${key}&token=${token}`;

    const [board, lists, cards, members] = await Promise.all([
      fetch(`${base}/boards/${boardId}?fields=name,url&${auth}`).then(r => r.json()),
      fetch(`${base}/boards/${boardId}/lists?fields=id,name,pos&${auth}`).then(r => r.json()),
      fetch(`${base}/boards/${boardId}/cards?fields=id,name,idList,labels,dateLastActivity,shortUrl,closed,idMembers,due&${auth}`).then(r => r.json()),
      fetch(`${base}/boards/${boardId}/members?fields=id,fullName,username,initials&${auth}`).then(r => r.json()),
    ]);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ board, lists, cards, members });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "internal_error", details: e?.message });
  }
}
