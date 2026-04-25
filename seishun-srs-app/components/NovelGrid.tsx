"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export interface NovelGridItem {
  id: number;
  slug: string;
  title: string;
  coverImage: string | null;
  sortOrder: number;
  totalVocab: number;
  learned: number;
  due: number;
}

interface Props {
  initialNovels: NovelGridItem[];
  isAdmin?: boolean;
}

export default function NovelGrid({ initialNovels, isAdmin = false }: Props) {
  const [novels, setNovels]         = useState(initialNovels);
  const [dragSrcId, setDragSrcId]   = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [removing, setRemoving]     = useState<number | null>(null);
  const [confirmId, setConfirmId]   = useState<number | null>(null);
  // Rename state
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editTitle, setEditTitle]   = useState("");
  const [saving, setSaving]         = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const onDragStart = (e: React.DragEvent, id: number) => {
    // Don't start a drag while editing a title
    if (editingId !== null) { e.preventDefault(); return; }
    setDragSrcId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
  };

  const onDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragSrcId) setDragOverId(id);
  };

  const onDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === targetId) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }

    const fromIdx = novels.findIndex((n) => n.id === dragSrcId);
    const toIdx   = novels.findIndex((n) => n.id === targetId);
    const reordered = [...novels];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withOrders = reordered.map((n, i) => ({ ...n, sortOrder: i + 1 }));

    setNovels(withOrders);
    setDragSrcId(null);
    setDragOverId(null);

    await fetch("/api/novels/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withOrders.map((n) => ({ id: n.id, sortOrder: n.sortOrder }))),
    });
  };

  const onDragEnd = () => {
    setDragSrcId(null);
    setDragOverId(null);
  };

  // ── Rename ────────────────────────────────────────────────────────────────

  const startEdit = (id: number, currentTitle: string) => {
    setConfirmId(null); // close trash confirm if open
    setEditingId(id);
    setEditTitle(currentTitle);
    // Focus after the input renders
    requestAnimationFrame(() => {
      editInputRef.current?.select();
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const commitEdit = async (id: number) => {
    const trimmed = editTitle.trim();
    if (!trimmed) { cancelEdit(); return; }

    const original = novels.find((n) => n.id === id)?.title;
    if (trimmed === original) { cancelEdit(); return; }

    setSaving(true);
    const res = await fetch(`/api/novels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (res.ok) {
      setNovels((prev) => prev.map((n) => n.id === id ? { ...n, title: trimmed } : n));
    }
    setSaving(false);
    cancelEdit();
  };

  const onEditKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === "Enter")  { e.preventDefault(); commitEdit(id); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  };

  // ── Remove ────────────────────────────────────────────────────────────────

  const handleRemove = async (id: number) => {
    setRemoving(id);
    setConfirmId(null);

    const res = await fetch(`/api/novels/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNovels((prev) => prev.filter((n) => n.id !== id));
    } else {
      console.error("Failed to remove novel", await res.json());
    }
    setRemoving(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
      {novels.map((novel) => {
        const isDragging   = dragSrcId  === novel.id;
        const isDropTarget = dragOverId === novel.id;
        const isConfirming = confirmId  === novel.id;
        const isRemoving   = removing   === novel.id;
        const isEditing    = editingId  === novel.id;
        const coveragePct  = Math.round((novel.learned / Math.max(novel.totalVocab, 1)) * 100);

        return (
          <div
            key={novel.id}
            draggable={isAdmin}
            onDragStart={(e) => isAdmin && onDragStart(e, novel.id)}
            onDragOver={(e)  => isAdmin && onDragOver(e,  novel.id)}
            onDrop={(e)      => isAdmin && onDrop(e,      novel.id)}
            onDragEnd={() => isAdmin && onDragEnd()}
            className={[
              "group relative bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden shadow transition-all duration-200",
              isDragging    ? "opacity-40 scale-95 border-indigo-300 dark:border-indigo-600"           : "",
              isDropTarget  ? "border-indigo-400 shadow-lg ring-2 ring-indigo-300 dark:ring-indigo-700" : "border-zinc-200 dark:border-zinc-700",
              !isDragging && !isDropTarget ? "hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700" : "",
            ].join(" ")}
          >
            {/* ── Management overlay (drag / rename / trash) — admin only ── */}
            <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto ${!isAdmin ? "hidden" : ""}`}>
              {/* Drag handle */}
              <div
                className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-black/40 text-white backdrop-blur-sm select-none"
                title="Drag to reorder"
              >
                <GripIcon />
              </div>

              {/* Right-side controls */}
              <div className="flex items-center gap-1">
                {isConfirming ? (
                  /* Trash confirmation */
                  <>
                    <button
                      onClick={() => handleRemove(novel.id)}
                      disabled={isRemoving}
                      className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                      {isRemoving ? "Removing…" : "Yes, remove"}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs px-2 py-1 rounded-lg bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  /* Normal buttons */
                  <>
                    <button
                      onClick={() => startEdit(novel.id, novel.title)}
                      className="p-1.5 rounded-lg bg-black/40 text-white backdrop-blur-sm hover:bg-indigo-600 transition-colors"
                      title="Rename novel"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setConfirmId(novel.id)}
                      className="p-1.5 rounded-lg bg-black/40 text-white backdrop-blur-sm hover:bg-red-600 transition-colors"
                      title="Remove novel"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Cover image + navigation link ── */}
            <Link href={`/novel/${novel.id}`} className="block" tabIndex={isEditing ? -1 : 0}>
              <div className="relative w-full aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
                {novel.coverImage ? (
                  <Image
                    src={`/${novel.coverImage}`}
                    alt={novel.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-4xl text-zinc-300">
                    📖
                  </div>
                )}
                {novel.due > 0 && (
                  <div className="absolute bottom-3 right-3 bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                    {novel.due} due
                  </div>
                )}
              </div>
            </Link>

            {/* ── Info / inline rename ── */}
            <div className="p-4">
              {isEditing ? (
                /* Inline rename input */
                <div className="flex gap-1.5 items-center mb-2">
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => onEditKeyDown(e, novel.id)}
                    onBlur={() => commitEdit(novel.id)}
                    disabled={saving}
                    className="flex-1 min-w-0 text-sm font-bold rounded-lg border border-indigo-400 px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); commitEdit(novel.id); }}
                    disabled={saving}
                    className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 shrink-0"
                  >
                    {saving ? "…" : "Save"}
                  </button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                    className="text-xs px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 transition-colors shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-snug mb-2">
                  {novel.title}
                </h2>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {novel.learned} / {novel.totalVocab} learned
                  <span className="ml-1 text-zinc-400">({coveragePct}%)</span>
                </span>
                <div className="w-20 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden ml-2">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add novel tile (admin) / Login prompt (visitor) */}
      {isAdmin ? (
        <Link
          href="/novels/new"
          className="group relative bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600 overflow-hidden transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[280px]"
        >
          <div className="text-4xl text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400 transition-colors">
            +
          </div>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-indigo-500 transition-colors">
            Add novel
          </p>
        </Link>
      ) : (
        <Link
          href="/login"
          className="group relative bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600 overflow-hidden transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[280px]"
        >
          <div className="text-3xl text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400 transition-colors">
            🔒
          </div>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-indigo-500 transition-colors text-center px-4">
            Admin login
          </p>
        </Link>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4"  r="1.5" />
      <circle cx="11" cy="4"  r="1.5" />
      <circle cx="5" cy="8"  r="1.5" />
      <circle cx="11" cy="8"  r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
