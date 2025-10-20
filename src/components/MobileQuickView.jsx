import React, { useMemo, useState } from "react";

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/);
  const [a = "", b = ""] = [parts[0], parts[parts.length - 1]];
  return (a[0] || "").concat(b[0] || "").toUpperCase();
}

function BarRow({ label, count, max }) {
  const pct = max ? Math.round((count / max) * 100) : 0;
  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="truncate pr-2">{label}</span>
        <span className="tabular-nums font-medium">{count}</span>
      </div>
      <div className="h-2 rounded bg-[rgba(0,0,0,0.08)] overflow-hidden">
        <div
          className="h-full rounded bg-[rgba(0,0,0,0.5)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition
        ${active ? "bg-black text-white border-black" : "bg-white text-black border-black/15"}
      `}
    >
      {children}
    </button>
  );
}

export default function MobileQuickView({ board, lists = [], cards = [], members = [] }) {
  const [tab, setTab] = useState("lists"); // 'lists' | 'owners' | 'heatmap'
  const data = useMemo(() => {
    // maps auxiliares
    const openLists = lists.filter(l => !l.closed);
    const listById = Object.fromEntries(openLists.map(l => [l.id, l]));
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));

    // só cards abertos
    const openCards = cards.filter(c => !c.closed);

    // contagens
    const listCounts = new Map(openLists.map(l => [l.id, 0]));
    const memberCounts = new Map(); // id => count
    const matrix = new Map(); // listId => Map(memberId|'none' => count)
    const NONE = "none";

    const bump = (m, k, inc = 1) => m.set(k, (m.get(k) || 0) + inc);

    for (const c of openCards) {
      if (c.idList && listById[c.idList]) bump(listCounts, c.idList);

      const owners = (Array.isArray(c.idMembers) && c.idMembers.length ? c.idMembers : [NONE]);
      for (const mid of owners) {
        bump(memberCounts, mid);
        if (!matrix.has(c.idList)) matrix.set(c.idList, new Map());
        bump(matrix.get(c.idList), mid);
      }
    }

    const listRows = [...listCounts.entries()]
      .map(([id, count]) => ({ id, name: listById[id]?.name || "Lista", count }))
      .sort((a, b) => b.count - a.count);

    const ownerRows = [...memberCounts.entries()]
      .map(([id, count]) => ({
        id,
        name: id === NONE ? "Sem responsável" : (memberById[id]?.fullName || memberById[id]?.username || "Responsável"),
        initials: id === NONE ? "—" : initialsOf(memberById[id]?.fullName || memberById[id]?.username),
      }))
      .sort((a, b) => b.count - a.count);

    // matriz -> arrays ordenadas
    const heatLists = listRows.map(r => r.id);
    const heatOwners = ownerRows.map(r => r.id);
    const heat = heatLists.map(lid => {
      const row = matrix.get(lid) || new Map();
      return heatOwners.map(oid => row.get(oid) || 0);
    });

    const totals = {
      cards: openCards.length,
      lists: openLists.length,
      owners: ownerRows.length,
      maxList: listRows[0]?.count || 0,
      maxOwner: ownerRows[0]?.count || 0,
    };

    return {
      listRows,
      ownerRows,
      heat,
      heatLists,
      heatOwners,
      listById,
      memberById,
      totals,
    };
  }, [lists, cards, members]);

  const { listRows, ownerRows, heat, heatLists, heatOwners, memberById, totals } = data;

  return (
    <section className="max-w-screen-md mx-auto px-3 sm:px-4 md:px-0 my-3">
      {/* Header compacto */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 py-2 backdrop-blur bg-white/80 border-b border-black/5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-black/60">Board</div>
            <div className="font-semibold truncate">{board?.name || "Dashboard"}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-black text-white">{totals.cards} cards</span>
            <span className="text-xs px-2 py-1 rounded-full border border-black/15">{totals.lists} listas</span>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          <Pill active={tab === "lists"} onClick={() => setTab("lists")}>Listas</Pill>
          <Pill active={tab === "owners"} onClick={() => setTab("owners")}>Responsáveis</Pill>
          <Pill active={tab === "heatmap"} onClick={() => setTab("heatmap")}>Heatmap</Pill>
        </div>
      </div>

      {/* Conteúdos */}
      {tab === "lists" && (
        <div className="mt-3">
          {listRows.length === 0 && <div className="text-sm text-black/60">Sem cartões.</div>}
          {listRows.length > 0 && (
            <div>
              {listRows.slice(0, 12).map((r, i, arr) => (
                <BarRow key={r.id} label={r.name} count={r.count} max={arr[0]?.count || 0} />
              ))}
              {listRows.length > 12 && (
                <details className="mt-2">
                  <summary className="text-sm underline cursor-pointer">Ver todas as {listRows.length} listas</summary>
                  <div className="mt-2">
                    {listRows.slice(12).map((r, i) => (
                      <BarRow key={r.id} label={r.name} count={r.count} max={totals.maxList} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "owners" && (
        <div className="mt-3">
          {ownerRows.length === 0 && <div className="text-sm text-black/60">Sem responsáveis.</div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ownerRows.map((o) => (
              <button
                key={o.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-black/10 hover:bg-black/5 active:scale-[0.99] transition"
                title={o.name}
              >
                <div className="shrink-0 w-9 h-9 rounded-full border border-black/10 grid place-items-center text-sm font-semibold bg-black/5">
                  {o.id === "none" ? "—" : (memberById[o.id]?.avatarUrl
                    ? <img src={memberById[o.id].avatarUrl + "/30.png"} alt={o.name} className="w-9 h-9 rounded-full object-cover" />
                    : initialsOf(o.name))}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate">{o.name}</div>
                  <div className="text-xs text-black/60">{o.count} cards</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "heatmap" && (
        <div className="mt-3">
          <div className="w-full overflow-x-auto">
            <table className="text-sm min-w-[600px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left p-2 border-b border-black/10">Lista \\ Resp.</th>
                  {heatOwners.map((oid) => (
                    <th key={oid} className="p-2 border-b border-black/10 text-left whitespace-nowrap">
                      {oid === "none" ? "Sem resp." : (memberById[oid]?.fullName || memberById[oid]?.username || "Resp.")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.map((row, rIdx) => (
                  <tr key={heatLists[rIdx]}>
                    <th className="sticky left-0 bg-white p-2 border-b border-black/5 text-left whitespace-nowrap">
                      {lists.find(l => l.id === heatLists[rIdx])?.name || "Lista"}
                    </th>
                    {row.map((val, cIdx) => (
                      <td key={cIdx} className="p-2 border-b border-black/5">
                        <div
                          className="h-6 rounded grid place-items-center"
                          style={{
                            background: `rgba(0,0,0,${val === 0 ? 0.06 : Math.min(0.06 + val / (totals.maxList || 1) * 0.6, 0.66)})`
                          }}
                          title={`${val} cards`}
                        >
                          {val || ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-black/50 mt-2">Dica: arraste para os lados para ver todas as colunas.</div>
        </div>
      )}
    </section>
  );
}
