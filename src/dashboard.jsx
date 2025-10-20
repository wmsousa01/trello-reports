import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList,
  LineChart, Line, Legend
} from "recharts";

/* ======================= Utils ======================= */
function toCSV(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ");
  return [headers.join(","), ...rows.map((r) => headers.map((h) => `"${esc(r[h])}"`).join(","))].join("\n");
}
function download(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (a + b).toUpperCase() || "—";
}
function fmtMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function* daysBack(n) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d); dd.setDate(d.getDate() - i);
    yield dd;
  }
}

/* Paleta para os gráficos */
const PALETTE = [
  "#3B82F6","#22C55E","#F59E0B","#EF4444","#06B6D4",
  "#A855F7","#10B981","#F97316","#E11D48","#84CC16",
  "#14B8A6","#6366F1","#F43F5E","#F472B6","#0EA5E9"
];

/* ======================= Componente ======================= */
export default function Dashboard({ t }) {
  // dados
  const [cards, setCards] = useState([]);
  const [lists, setLists] = useState([]);
  const [members, setMembers] = useState([]);
  const [board, setBoard] = useState(null);

  // estados
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filtros (estado)
  const [selectedLists, setSelectedLists] = useState(new Set());
  const [selectedLabels, setSelectedLabels] = useState(new Set());
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo,   setDueTo]   = useState("");

  // UI mobile
  const [activeTab, setActiveTab] = useState("lists"); // "lists" | "owners"
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)") : null;
    const update = () => setIsMobile(!!mq?.matches);
    update(); mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);

  // Drawer de filtros (estilo Pexels)
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") setShowFilters(false); if (e.key.toLowerCase() === "f") setShowFilters(true); };
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = showFilters ? "hidden" : "";
    return () => { window.removeEventListener("keydown", onEsc); document.body.style.overflow = ""; };
  }, [showFilters]);

  const activeFilterCount = useMemo(() => (
    selectedLists.size + selectedLabels.size + selectedMembers.size + (dueFrom || dueTo ? 1 : 0)
  ), [selectedLists, selectedLabels, selectedMembers, dueFrom, dueTo]);

  // query params
  const qs =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const boardIdFromUrl = qs?.get("boardId") || "";
  const accessFromUrl  = qs?.get("access")  || "";
  const forcePublic    = (qs?.get("mode") || "").toLowerCase() === "public";
  const reportNameFromUrl = qs?.get("reportName") || "";
  const logoUrlFromUrl = qs?.get("logo") || "/logo.png";
  const logoSize = Number(qs?.get("logoSize")) || (isMobile ? 28 : 48);
  const logoMaxW = Number(qs?.get("logoMaxW")) || 220;

  // Trello x público
  const isIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const inTrello =
    !!t && isIframe && typeof t.cards === "function" && typeof t.lists === "function";
  const publicMode = forcePublic || (!inTrello && !!boardIdFromUrl);

  /* ======== Carregamento de dados ======== */
  useEffect(() => {
    (async () => {
      try {
        setError("");

        // 1) Power-Up (dentro do Trello)
        if (inTrello && !forcePublic) {
          const [cs, ls, b] = await Promise.all([
            t.cards("all"),
            t.lists("all"),
            t.board("name"),
          ]);
          setCards(cs || []); setLists(ls || []); setBoard(b || null);
          try {
            const ms = (await t.board("members")) || [];
            setMembers(Array.isArray(ms) ? ms : []);
          } catch { setMembers([]); }
          return;
        }

        // 2) Modo público (API serverless)
        if (publicMode) {
          setLoading(true);
          const url = `/api/board?boardId=${encodeURIComponent(boardIdFromUrl)}${accessFromUrl ? `&access=${encodeURIComponent(accessFromUrl)}` : ""}`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          setBoard(data.board || null);
          setLists(Array.isArray(data.lists) ? data.lists : []);
          setCards(Array.isArray(data.cards) ? data.cards : []);
          setMembers(Array.isArray(data.members) ? data.members : []);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error(e);
        setError("Falha ao carregar dados.");
        setLoading(false);
      }
    })();
  }, [inTrello, forcePublic, publicMode, boardIdFromUrl, accessFromUrl, t]);

  /* ======== Mapas auxiliares ======== */
  const listNameById = useMemo(() => {
    const m = {}; for (const l of lists) m[l.id] = l.name; return m;
  }, [lists]);

  const memberNameById = useMemo(() => {
    const m = {};
    for (const mem of members) {
      m[mem.id] = mem.fullName || mem.username || (mem.initials ? mem.initials : mem.id);
    }
    return m;
  }, [members]);

  const allLabels = useMemo(() => {
    const byId = new Map();
    for (const c of cards) {
      (c.labels || []).forEach((l) => {
        if (!byId.has(l.id)) {
          byId.set(l.id, {
            id: l.id,
            name: l.name || l.color || "Sem nome",
            color: l.color || null,
          });
        }
      });
    }
    return Array.from(byId.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [cards]);

  /* ======== Filtros ======== */
  const dateInside = (iso, fromStr, toStr) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (fromStr) { const f = new Date(fromStr); if (d < f) return false; }
    if (toStr)   { const t = new Date(toStr); t.setHours(23, 59, 59, 999); if (d > t) return false; }
    return true;
  };

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (selectedLists.size && !selectedLists.has(c.idList)) return false;

      if (selectedLabels.size) {
        const ids = new Set((c.labels || []).map((l) => l.id));
        let ok = false; for (const id of selectedLabels) { if (ids.has(id)) { ok = true; break; } }
        if (!ok) return false;
      }

      if (selectedMembers.size) {
        const ms = new Set(c.idMembers || []);
        let ok = false; for (const id of selectedMembers) { if (ms.has(id)) { ok = true; break; } }
        if (!ok) return false;
      }

      if (dueFrom || dueTo) {
        if (!c.due) return false;
        if (!dateInside(c.due, dueFrom, dueTo)) return false;
      }

      return true;
    });
  }, [cards, selectedLists, selectedLabels, selectedMembers, dueFrom, dueTo]);

  /* ======== KPI's ======== */
  const kpis = useMemo(() => {
    const total = cards.length;
    const unassigned = cards.filter(c => !(c.idMembers && c.idMembers.length)).length;
    const listsCount = lists.length;
    const membersCount = members.length;
    return { total, unassigned, listsCount, membersCount };
  }, [cards, lists, members]);

  /* ======== Agregações (gráficos) ======== */
  const listsAgg = useMemo(() => {
    const acc = new Map();
    for (const c of filteredCards) { if (!c.closed) acc.set(c.idList, (acc.get(c.idList) || 0) + 1); }
    const rows = [...acc.entries()].map(([id, count]) => ({ id, name: listNameById[id] || id, count }));
    rows.sort((a, b) => b.count - a.count);
    return { rows, max: rows[0]?.count || 0 };
  }, [filteredCards, listNameById]);

  const ownersAgg = useMemo(() => {
    const NONE = "none";
    const acc = new Map();
    for (const c of filteredCards) {
      const mids = (Array.isArray(c.idMembers) && c.idMembers.length) ? c.idMembers : [NONE];
      for (const m of mids) acc.set(m, (acc.get(m) || 0) + 1);
    }
    const rows = [...acc.entries()].map(([id, count]) => ({
      id, count,
      name: id === NONE ? "Sem responsável" : (memberNameById[id] || "Responsável"),
      initials: id === NONE ? "—" : initialsOf(memberNameById[id] || ""),
    }));
    rows.sort((a, b) => b.count - a.count);
    return { rows, max: rows[0]?.count || 0 };
  }, [filteredCards, memberNameById]);

  const chartByList = useMemo(() => {
    const acc = {};
    for (const c of filteredCards) acc[c.idList] = (acc[c.idList] || 0) + 1;
    return Object.entries(acc).map(([idList, value]) => ({
      name: listNameById[idList] || idList, value,
    }));
  }, [filteredCards, listNameById]);
  const chartByListSorted = useMemo(
    () => [...chartByList].sort((a, b) => b.value - a.value),
    [chartByList]
  );

  // Mensal / Acumulado por mês (usa dateLastActivity)
  const [cumMode, setCumMode] = useState("mensal"); // "mensal" | "acumulado"
  const monthly = useMemo(() => {
    const map = new Map(); // "YYYY-MM" -> count
    for (const c of filteredCards) {
      const d = c.dateLastActivity ? new Date(c.dateLastActivity) : null;
      if (!d) continue;
      const k = fmtMonth(d);
      map.set(k, (map.get(k) || 0) + 1);
    }
    const arr = [...map.entries()]
      .map(([k, v]) => ({ month: k, value: v }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
    if (cumMode === "acumulado") {
      let run = 0;
      return arr.map(r => ({ ...r, value: (run += r.value) }));
    }
    return arr;
  }, [filteredCards, cumMode]);

  // Trend diário por lista (últimos 14 dias; usa dateLastActivity)
  const trend14 = useMemo(() => {
    const days = [...daysBack(14)];
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const listsSet = new Set(filteredCards.map(c => c.idList));
    const listIds = [...listsSet];
    const byDayList = new Map(); // day -> Map(listId -> count)

    for (const d of days) {
      const k = dayKey(d);
      byDayList.set(k, new Map(listIds.map(id => [id, 0])));
    }
    for (const c of filteredCards) {
      if (!c.dateLastActivity) continue;
      const k = new Date(c.dateLastActivity).toISOString().slice(0, 10);
      if (!byDayList.has(k)) continue;
      const m = byDayList.get(k);
      m.set(c.idList, (m.get(c.idList) || 0) + 1);
    }

    // top 3 listas no período
    const totals = new Map(listIds.map(id => [id, 0]));
    for (const [, m] of byDayList) for (const [id, v] of m) totals.set(id, (totals.get(id) || 0) + v);
    const topIds = [...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>id);

    // dataset
    const data = days.map(d => {
      const k = dayKey(d);
      const m = byDayList.get(k);
      const row = { day: k };
      for (const id of topIds) row[listNameById[id] || id] = m.get(id) || 0;
      return row;
    });

    const series = topIds.map((id, i) => ({
      key: listNameById[id] || id,
      color: PALETTE[i % PALETTE.length]
    }));

    return { data, series };
  }, [filteredCards, listNameById]);

  /* ======== Digest Semanal ======== */
  const MANAGER_EMAIL = qs?.get("manager") || "marcelo.roberto@empresa.com";
  const weeklyDigest = useMemo(() => {
    const limit = new Date(); limit.setDate(limit.getDate() - 7);
    const recent = filteredCards.filter(c => c.dateLastActivity && new Date(c.dateLastActivity) >= limit);

    const byList = new Map(); // lista -> membro -> itens
    for (const c of recent) {
      const list = listNameById[c.idList] || "Lista";
      if (!byList.has(list)) byList.set(list, new Map());
      const owners = (c.idMembers && c.idMembers.length) ? c.idMembers : ["(Sem responsável)"];
      for (const m of owners) {
        const who = memberNameById[m] || m;
        if (!byList.get(list).has(who)) byList.get(list).set(who, []);
        byList.get(list).get(who).push(c.name);
      }
    }

    let txt = `Digest semanal – ${reportNameFromUrl || board?.name || "Relatório"}\n\n`;
    txt += `Período: últimos 7 dias\n`;
    txt += `Total de cards com atividade: ${recent.length}\n\n`;
    for (const [list, owners] of byList) {
      txt += `# ${list}\n`;
      for (const [owner, items] of owners) {
        txt += `- ${owner} (${items.length}):\n`;
        for (const it of items) txt += `  • ${it}\n`;
      }
      txt += `\n`;
    }
    return txt.trim();
  }, [filteredCards, memberNameById, listNameById, board?.name, reportNameFromUrl]);

  const copyDigest = async () => {
    try { await navigator.clipboard.writeText(weeklyDigest); alert("Digest copiado!"); }
    catch { /* no-op */ }
  };
  const mailDigest = () => {
    const subject = encodeURIComponent(`Digest Semanal - ${reportNameFromUrl || board?.name || "Relatório"}`);
    const body = encodeURIComponent(weeklyDigest);
    window.location.href = `mailto:${MANAGER_EMAIL}?subject=${subject}&body=${body}`;
  };

  /* ======== Exportações e helpers ======== */
  const handleExportJSON = () => {
    const data = filteredCards.map((c) => ({
      id: c.id, title: c.name, list: listNameById[c.idList] || c.idList,
      labels: (c.labels || []).map((l) => l.name || l.color).join(", "),
      members: (c.idMembers || []).map((m) => memberNameById[m] || m).join(", "),
      due: c.due || "", link: c.shortUrl || "",
    }));
    download(`trello-report-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const handleExportCSV = () => {
    const rows = filteredCards.map((c) => ({
      ID: c.id, Título: c.name, Lista: listNameById[c.idList] || c.idList,
      Labels: (c.labels || []).map((l) => l.name || l.color).join(", "),
      Membros: (c.idMembers || []).map((m) => memberNameById[m] || m).join(", "),
      Vencimento: c.due || "", Link: c.shortUrl || "",
    }));
    download(`trello-report-${Date.now()}.csv`, toCSV(rows), "text/csv;charset=utf-8;");
  };
  const clearFilters = () => {
    setSelectedLists(new Set());
    setSelectedLabels(new Set());
    setSelectedMembers(new Set());
    setDueFrom(""); setDueTo("");
  };
  const toggleSet = (set, value, setter) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  /* ======== Render ======== */

  if (!inTrello && !publicMode) {
    return (
      <div style={{ padding: 20, fontFamily: "Inter, system-ui, Arial" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>📊 Dashboard pública</h1>
        <p>Adicione <code>?boardId=SEU_BOARD_ID</code>. Se estiver com Vite/5173, use também <code>&mode=public</code>.</p>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 20 }}>Carregando…</div>;
  if (error)   return <div style={{ padding: 20, color: "crimson" }}>{error} — verifique <code>boardId</code> e acesso.</div>;

  const titleReport = reportNameFromUrl || board?.name || "Dashboard da Board";

  return (
    <div style={{ padding: 20, fontFamily: "Inter, system-ui, Arial", lineHeight: 1.35 }}>
      {/* header + ações */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logoUrlFromUrl ? (
            <img src={logoUrlFromUrl} alt="Logo"
              style={{ height: logoSize, width: "auto", maxWidth: logoMaxW, objectFit: "contain", display: "block" }}/>
          ) : (
            <div style={{ height: logoSize, width: logoSize, borderRadius: 6, background: "black" }} />
          )}
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{titleReport}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleExportJSON} style={btnStyle}>Exportar JSON</button>
          <button onClick={handleExportCSV}  style={btnStyle}>Exportar CSV</button>
          <button onClick={() => setShowFilters(true)} style={{ ...btnStyle, background: "#f6f6f6" }}>
            {/* ícone simples de filtro */}
            <span style={{ marginRight: 6 }}>⚙️</span> Filtros {activeFilterCount ? `(${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={kpisWrap}>
        <KPI label="Cards" value={kpis.total} />
        <KPI label="Não atribuídos" value={kpis.unassigned} />
        <KPI label="Listas" value={kpis.listsCount} />
        <KPI label="Membros" value={kpis.membersCount} />
      </div>

      <p style={{ margin: "8px 0 16px", opacity: 0.8 }}>
        Cards: <strong>{filteredCards.length}</strong> / {cards.length} • Listas: <strong>{lists.length}</strong> • Membros: <strong>{members.length}</strong>
      </p>

      {/* ===== MOBILE QUICK VIEW ===== */}
      {isMobile && (
        <MobileQuickView
          boardName={titleReport}
          listsAgg={listsAgg}
          ownersAgg={ownersAgg}
          onPickList={(id)=>toggleSet(selectedLists, id, setSelectedLists)}
          onPickOwner={(id)=>id==="none"?null:toggleSet(selectedMembers, id, setSelectedMembers)}
        />
      )}

      {/* ===== Gráficos ===== */}
      
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          {/* Barras horizontais */}
          <Card title="Distribuição por Lista (Barras)">
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={chartByListSorted} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false}/>
                <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 12 }}/>
                <Tooltip />
                <Bar dataKey="value">
                  {chartByListSorted.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                  <LabelList dataKey="value" position="right" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pizza */}
          <Card title="Distribuição por Lista (Pizza)">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie data={chartByListSorted} dataKey="value" nameKey="name" outerRadius="80%" label={({value}) => value}>
                  {chartByListSorted.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Mensal / Acumulado */}
          <Card title={`Atividade por mês (${cumMode})`}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setCumMode("mensal")}     style={{ ...btnSm, ...(cumMode==="mensal" ? btnSmActive : {})}}>Mensal</button>
              <button onClick={() => setCumMode("acumulado")}  style={{ ...btnSm, ...(cumMode==="acumulado" ? btnSmActive : {})}}>Acumulado</button>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthly} margin={{ top: 8, right:16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#3B82F6" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Trend diário por lista */}
          <Card title="Trend diário (últimos 14 dias) — listas top">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={trend14.data} margin={{ top: 8, right:16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {trend14.series.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} dot={{ r: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      

      {/* ===== Digest Semanal ===== */}
      <Card title="Digest semanal (últimos 7 dias)">
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={copyDigest} style={btnStyle}>Copiar</button>
          <button onClick={mailDigest} style={btnStyle}>Abrir e-mail (Gerencial)</button>
        </div>
        <textarea readOnly value={weeklyDigest} style={{ width: "100%", minHeight: 180, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, padding: 12, border: "1px solid #eee", borderRadius: 8 }} />
      </Card>

      {/* ===== Tabela ===== */}
      <Card title="Cards (filtrados)">
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left" }}>
                <th style={th}>Título</th>
                <th style={th}>Lista</th>
                <th style={th}>Labels</th>
                <th style={th}>Membros</th>
                <th style={th}>Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.slice(0, 100).map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.shortUrl ? <a href={c.shortUrl} target="_blank" rel="noreferrer">{c.name}</a> : c.name}</td>
                  <td style={td}>{listNameById[c.idList] || c.idList}</td>
                  <td style={td}>{(c.labels || []).map((l) => l.name || l.color).join(", ") || "—"}</td>
                  <td style={td}>{(c.idMembers || []).map((m) => memberNameById[m] || m).join(", ") || "—"}</td>
                  <td style={td}>{c.due ? new Date(c.due).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCards.length > 100 && (
            <div style={{ padding: 10, fontSize: 12, color: "#666" }}>
              Mostrando 100 de {filteredCards.length} cards
            </div>
          )}
        </div>
      </Card>

      {/* ===== FAB + Drawer de filtros ===== */}
      <Fab onClick={() => setShowFilters(true)} badge={activeFilterCount}/>
      <FilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
      >
        <Filters
          lists={lists}
          allLabels={allLabels}
          members={members}
          selectedLists={selectedLists}
          selectedLabels={selectedLabels}
          selectedMembers={selectedMembers}
          dueFrom={dueFrom}
          dueTo={dueTo}
          onToggleList={(id)=>toggleSet(selectedLists, id, setSelectedLists)}
          onToggleLabel={(id)=>toggleSet(selectedLabels, id, setSelectedLabels)}
          onToggleMember={(id)=>toggleSet(selectedMembers, id, setSelectedMembers)}
          onDateFrom={setDueFrom}
          onDateTo={setDueTo}
        />
        <div style={{ display:"flex", gap:8, marginTop: 12 }}>
          <button onClick={clearFilters} style={{ ...btnStyle, background:"#f6f6f6" }}>Limpar filtros</button>
          <button onClick={() => setShowFilters(false)} style={{ ...btnStyle, background:"black", color:"white" }}>Fechar</button>
        </div>
      </FilterDrawer>
    </div>
  );
}

/* ===== componentes simples ===== */
function Card({ title, children }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
      {children}
    </div>
  );
}
function KPI({ label, value }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/* ===== filtros e mobile ===== */
function Filters({
  lists, allLabels, members,
  selectedLists, selectedLabels, selectedMembers,
  dueFrom, dueTo,
  onToggleList, onToggleLabel, onToggleMember,
  onDateFrom, onDateTo
}) {
  return (
    <div style={filtersWrap}>
      {/* Listas */}
      <div style={filterBox}>
        <div style={filterTitle}>Listas</div>
        <div style={chipsWrap}>
          {lists.map((l) => (
            <label key={l.id} style={chipLabel}>
              <input type="checkbox" checked={selectedLists.has(l.id)} onChange={() => onToggleList(l.id)} />
              <span>{l.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div style={filterBox}>
        <div style={filterTitle}>Labels</div>
        <div style={chipsWrap}>
          {allLabels.map((lab) => (
            <label key={lab.id} style={chipLabel}>
              <input type="checkbox" checked={selectedLabels.has(lab.id)} onChange={() => onToggleLabel(lab.id)} />
              <span>{lab.name}{lab.color ? ` (${lab.color})` : ""}</span>
            </label>
          ))}
          {!allLabels.length && <span style={{ color: "#888" }}>Nenhum label encontrado</span>}
        </div>
      </div>

      {/* Membros */}
      <div style={filterBox}>
        <div style={filterTitle}>Membros</div>
        <div style={chipsWrap}>
          {members.map((m) => (
            <label key={m.id} style={chipLabel}>
              <input type="checkbox" checked={selectedMembers.has(m.id)} onChange={() => onToggleMember(m.id)} />
              <span>{m.fullName || m.username || m.initials || m.id}</span>
            </label>
          ))}
          {!members.length && <span style={{ color: "#888" }}>Membros indisponíveis</span>}
        </div>
      </div>

      {/* Datas */}
      <div style={filterBox}>
        <div style={filterTitle}>Vencimento</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={smallLabel}>De</div>
            <input type="date" value={dueFrom} onChange={(e) => onDateFrom(e.target.value)} style={dateInput} />
          </div>
          <div>
            <div style={smallLabel}>Até</div>
            <input type="date" value={dueTo} onChange={(e) => onDateTo(e.target.value)} style={dateInput} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileQuickView({ boardName, listsAgg, ownersAgg, onPickList, onPickOwner }) {
  const [tab, setTab] = useState("lists");
  const pill = (active) => ({
    padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)",
    background: active ? "black" : "white", color: active ? "white" : "black", cursor: "pointer", fontSize: 13
  });
  const BarRow = ({ label, count, max, onClick }) => {
    const pct = max ? Math.round((count / max) * 100) : 0;
    return (
      <button onClick={onClick} style={{ width:"100%", textAlign:"left", padding:"8px 0", background:"transparent", border:"none", cursor:"pointer" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }}>{label}</span>
          <span style={{ fontVariantNumeric:"tabular-nums", fontWeight:600 }}>{count}</span>
        </div>
        <div style={{ height:8, borderRadius:6, background:"rgba(0,0,0,0.08)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, borderRadius:6, background:"rgba(0,0,0,0.5)" }} />
        </div>
      </button>
    );
  };
  return (
    <div style={{ marginBottom: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <div style={{ position:"sticky", top:0, padding:12, borderBottom:"1px solid #f0f0f0", background:"rgba(255,255,255,0.9)", backdropFilter:"blur(4px)", borderTopLeftRadius:12, borderTopRightRadius:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
          <div>
            <div style={{ fontSize:12, textTransform:"uppercase", color:"#666" }}>Board</div>
            <div style={{ fontWeight:600 }}>{boardName}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <button style={pill(tab==="lists")} onClick={()=>setTab("lists")}>Listas</button>
          <button style={pill(tab==="owners")} onClick={()=>setTab("owners")}>Responsáveis</button>
        </div>
      </div>
      <div style={{ padding:12 }}>
        {tab==="lists" && (
          <>
            {listsAgg.rows.slice(0, 12).map((r, idx, arr) => (
              <BarRow key={r.id} label={r.name} count={r.count} max={arr[0]?.count || 0} onClick={()=>onPickList(r.id)} />
            ))}
            {listsAgg.rows.length>12 && (
              <details style={{ marginTop:6 }}>
                <summary style={{ cursor:"pointer" }}>Ver todas as {listsAgg.rows.length} listas</summary>
                <div style={{ marginTop:6 }}>
                  {listsAgg.rows.slice(12).map(r => (
                    <BarRow key={r.id} label={r.name} count={r.count} max={listsAgg.max} onClick={()=>onPickList(r.id)} />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        {tab==="owners" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {ownersAgg.rows.map(o => (
              <button key={o.id} onClick={()=>onPickOwner(o.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:10, border:"1px solid rgba(0,0,0,0.1)", borderRadius:12, background:"white" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", border:"1px solid rgba(0,0,0,0.1)", background:"rgba(0,0,0,0.05)", display:"grid", placeItems:"center", fontWeight:600 }}>{o.id==="none"?"—":initialsOf(o.name)}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.name}</div>
                  <div style={{ fontSize:12, color:"#666" }}>{o.count} cards</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== FAB e Drawer de Filtros ===== */
function Fab({ onClick, badge = 0 }) {
  return (
    <button onClick={onClick}
      title="Abrir filtros (tecla F)"
      style={{
        position:"fixed", right:20, bottom:20, width:56, height:56, borderRadius:"50%",
        background:"black", color:"white", border:"none", boxShadow:"0 8px 24px rgba(0,0,0,.18)",
        cursor:"pointer", zIndex: 2000, display:"grid", placeItems:"center", fontSize:22
      }}>
      ⛭
      {badge > 0 && (
        <span style={{
          position:"absolute", top:-2, right:-2, background:"#ef4444", color:"#fff",
          borderRadius:999, fontSize:11, lineHeight:"18px", minWidth:18, height:18, padding:"0 5px",
          boxShadow:"0 0 0 2px #fff"
        }}>{badge}</span>
      )}
    </button>
  );
}

function FilterDrawer({ open, onClose, children }) {
  return (
    <>
      {/* backdrop */}
      <div onClick={onClose}
        style={{
          position:"fixed", inset:0, background: open ? "rgba(0,0,0,.35)" : "transparent",
          opacity: open ? 1 : 0, transition:"opacity .2s ease",
          pointerEvents: open ? "auto" : "none", zIndex: 1999
        }}
      />
      {/* panel */}
      <aside
        style={{
          position:"fixed", top:0, right:0, height:"100vh",
          width:"min(92vw, 420px)", background:"#fff", boxShadow:"-12px 0 24px rgba(0,0,0,.12)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition:"transform .28s ease", zIndex: 2001, display:"flex", flexDirection:"column"
        }}
      >
        <div style={{ padding:12, borderBottom:"1px solid #eee", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <strong>Filtros</strong>
          <button onClick={onClose} style={{ ...btnStyle, background:"#f6f6f6" }}>Fechar</button>
        </div>
        <div style={{ padding:12, overflow:"auto" }}>
          {children}
        </div>
      </aside>
    </>
  );
}

/* ======================= estilos inline ======================= */
const btnStyle = { padding:"8px 12px", borderRadius:8, border:"1px solid #ddd", background:"white", cursor:"pointer", fontSize:13 };
const btnSm = { padding:"6px 10px", borderRadius:999, border:"1px solid rgba(0,0,0,0.15)", background:"white", cursor:"pointer", fontSize:12 };
const btnSmActive = { background:"black", color:"white", border:"1px solid black" };

const filtersWrap = { display:"grid", gridTemplateColumns:"1fr", gap:12 };
const filterBox   = { border:"1px solid #eee", borderRadius:12, padding:12, background:"#fff" };
const filterTitle = { fontWeight:600, marginBottom:8 };
const chipsWrap   = { display:"flex", gap:8, flexWrap:"wrap" };
const chipLabel   = { display:"inline-flex", alignItems:"center", gap:6, padding:"6px 10px",
  border:"1px solid #e5e5e5", borderRadius:999, background:"#fff", fontSize:13 };
const dateInput   = { padding:"6px 8px", border:"1px solid #e5e5e5", borderRadius:8 };
const smallLabel  = { fontSize:12, color:"#666", marginBottom:4 };
const th = { padding:10, borderBottom:"1px solid #eee" };
const td = { padding:10, borderBottom:"1px solid #f3f3f3" };
const kpisWrap = { display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:12, margin:"12px 0" };
