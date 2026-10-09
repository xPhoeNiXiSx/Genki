"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import type { CatalogEntry } from "@/lib/catalog";
import type { Exercise } from "@/lib/exercises";
import { normalizeMuscles, muscleLabel, type MuscleKey } from "@/lib/muscles";

import { BodyMap } from "../ui/body-map";
import { CatalogPicker } from "../ui/catalog-picker";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { Spinner } from "../spinner";
import { deleteExerciseAction, saveExerciseAction, setExerciseActiveAction, type ExerciseFormState } from "./actions";

/** Plus grand côté de l'image une fois réduite, en pixels. */
const IMAGE_SIZE = 900;

/** Réduit une photo dans le navigateur et la renvoie en JPEG, en data URL. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function ExerciseForm({
  exercise,
  categories,
  equipment: equipmentList,
  usedIn = [],
}: {
  exercise?: Exercise;
  categories: CatalogEntry[];
  equipment: CatalogEntry[];
  /** Séances qui utilisent l'exercice : il ne peut alors qu'être désactivé. */
  usedIn?: string[];
}) {
  const [state, action, pending] = useActionState<ExerciseFormState, FormData>(saveExerciseAction, {});
  const [muscles, setMuscles] = useState<MuscleKey[]>(exercise?.muscles ?? []);
  const [image, setImage] = useState<string | null>(exercise?.imageUrl ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(exercise?.category ?? categories[0]?.name ?? null);
  const [equipment, setEquipment] = useState<string | null>(exercise?.equipment ?? null);
  const [zoom, setZoom] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const toggle = (key: MuscleKey) =>
    setMuscles((list) => normalizeMuscles(list.includes(key) ? list.filter((m) => m !== key) : [...list, key]));

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImage(await shrink(file));
      setImageError(null);
    } catch {
      setImageError("Impossible de lire cette image.");
    }
  }

  const back = exercise ? `/exercices/${exercise.id}` : "/exercices";

  return (
    <form action={action} className="screen bare">
      <Lanes />
      {exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}
      {image ? <input type="hidden" name="imageUrl" value={image} /> : null}
      {muscles.map((m) => <input key={m} type="hidden" name="muscles" value={m} />)}

      <div className="top-bar">
        <Link href={back} className="round" aria-label="Annuler"><Icon name="close" size={18} /></Link>
        <button type="submit" className="btn volt" style={{ height: 44 }} disabled={pending}>Enregistrer</button>
      </div>

      <h1 className="display" style={{ fontSize: 30, marginTop: 18 }}>{exercise ? "Modifier l'exercice" : "Nouvel exercice"}</h1>

      <label className="field-label" htmlFor="name">Nom</label>
      <input id="name" name="name" className="input" defaultValue={exercise?.name} required autoComplete="off" />

      <label className="field-label" htmlFor="description">Description</label>
      <textarea id="description" name="description" className="textarea" defaultValue={exercise?.description ?? ""} rows={3} />

      <div className="galet" style={{ marginTop: 18, borderRadius: 28, background: "var(--stone)", borderColor: "var(--stone)", display: "flex", alignItems: "center", gap: 16, padding: 14 }}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label={image ? "Changer l'image" : "Ajouter une image"}
          style={{ width: 72, height: 72, flex: "none", borderRadius: 16, border: image ? 0 : "1.5px dashed var(--ink)", background: image ? `center / cover url(${image})` : "var(--white)", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          {image ? null : <Icon name="plus" size={24} />}
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{image ? "Image du mouvement" : "Ajouter une image"}</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            {imageError ?? (image ? "touche l'image pour la changer" : "facultative · photo du mouvement")}
          </p>
        </div>
        {image ? (
          <button type="button" className="round" onClick={() => setImage(null)} aria-label="Retirer l'image"><Icon name="trash" size={18} /></button>
        ) : null}
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />
      </div>

      <span className="field-label">Catégorie</span>
      <CatalogPicker kind="exercise_category" title="Catégories d'exercice" name="category" entries={categories} value={category} onChange={setCategory} />

      <span className="field-label">Matériel</span>
      <CatalogPicker kind="equipment" title="Matériel" name="equipment" entries={equipmentList} value={equipment} onChange={setEquipment} noneLabel="Aucun" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="field-label">Muscles sollicités</span>
        <button type="button" className="chip dashed" style={{ marginTop: 14 }} onClick={() => setZoom(true)}>
          <Icon name="search" size={14} /> Agrandir
        </button>
      </div>
      <section className="galet" style={{ borderRadius: 32, position: "relative", padding: "14px 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {(["face", "dos"] as const).map((view) => (
            <figure key={view} style={{ margin: 0, display: "grid", justifyItems: "center", gap: 4 }}>
              <BodyMap view={view} highlight={muscles} height={250} onToggle={toggle} label={`Vue de ${view}, touche un muscle pour le sélectionner`} />
              <figcaption className="mono muted" style={{ fontSize: 10, letterSpacing: "0.1em" }}>{view === "face" ? "FACE" : "DOS"}</figcaption>
            </figure>
          ))}
        </div>
        <SelectedMuscles muscles={muscles} onRemove={toggle} />
      </section>

      {state.error ? <p className="error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}

      <button type="submit" className="btn wide" style={{ marginTop: 18 }} disabled={pending}>
        {pending ? <Spinner /> : <Icon name="check" size={20} />} {pending ? "Enregistrement…" : "Enregistrer l'exercice"}
      </button>

      {exercise ? (
        <button type="button" className="btn" style={{ background: "transparent", color: "var(--danger)", width: "100%", marginTop: 6 }} onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" size={18} /> Supprimer l&apos;exercice
        </button>
      ) : null}

      {zoom ? (
        <MuscleZoom muscles={muscles} onToggle={toggle} onClose={() => setZoom(false)} />
      ) : null}

      {confirmDelete && exercise ? (
        <div className="sheet-veil" onClick={() => setConfirmDelete(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Supprimer l'exercice">
            {usedIn.length > 0 ? (
              <>
                <h2 className="display" style={{ fontSize: 22 }}>Exercice utilisé</h2>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  Il sert dans {usedIn.length > 1 ? "les séances" : "la séance"} {usedIn.map((n) => `« ${n} »`).join(", ")} : il ne peut pas être supprimé.
                  Désactivé, il y reste mais n&apos;est plus proposé.
                </p>
                {exercise.active ? (
                  <>
                    <input type="hidden" name="active" value="0" />
                    <button type="submit" formAction={setExerciseActiveAction} formNoValidate className="btn wide" style={{ marginTop: 20 }}>
                      Désactiver l&apos;exercice
                    </button>
                  </>
                ) : (
                  <p style={{ margin: "14px 0 0", fontWeight: 700 }}>Il est déjà désactivé.</p>
                )}
              </>
            ) : (
              <>
                <h2 className="display" style={{ fontSize: 22 }}>Supprimer « {exercise.name} » ?</h2>
                <p className="muted" style={{ margin: "8px 0 0" }}>Aucune séance ne l&apos;utilise. La suppression est définitive.</p>
                <button type="submit" formAction={deleteExerciseAction} formNoValidate className="btn wide" style={{ marginTop: 20, background: "var(--danger)", borderColor: "var(--danger)", color: "var(--white)" }}>
                  <Icon name="trash" size={18} /> Supprimer définitivement
                </button>
              </>
            )}
            <button type="button" className="btn" style={{ background: "transparent", color: "var(--ink)", width: "100%", marginTop: 6 }} onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function SelectedMuscles({ muscles, onRemove }: { muscles: MuscleKey[]; onRemove: (key: MuscleKey) => void }) {
  if (muscles.length === 0) {
    return <p className="muted" style={{ margin: "12px 0 0", fontSize: 13, textAlign: "center" }}>Aucun muscle sélectionné.</p>;
  }
  return (
    <div className="choices" style={{ marginTop: 12 }}>
      {muscles.map((m) => (
        <button key={m} type="button" className="chip accent" onClick={() => onRemove(m)} aria-label={`Retirer ${muscleLabel(m)}`}>
          {muscleLabel(m)} <Icon name="close" size={14} />
        </button>
      ))}
    </div>
  );
}

/** Schéma en grand, une vue à la fois, pour viser les petits muscles. */
function MuscleZoom({ muscles, onToggle, onClose }: { muscles: MuscleKey[]; onToggle: (key: MuscleKey) => void; onClose: () => void }) {
  const [view, setView] = useState<"face" | "dos">("face");
  return (
    <div className="sheet-veil" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Muscles sollicités" style={{ height: "92dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="choices" role="radiogroup" aria-label="Vue">
            {(["face", "dos"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? "chip on" : "chip"} onClick={() => setView(v)}>
                {v === "face" ? "Face" : "Dos"}
              </button>
            ))}
          </div>
          <button type="button" className="round" onClick={onClose} aria-label="Fermer"><Icon name="close" size={18} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", margin: "10px 0" }}>
          <BodyMap view={view} highlight={muscles} height={560} onToggle={onToggle} label={`Vue de ${view}, touche un muscle pour le sélectionner`} style={{ height: "100%", width: "auto", maxHeight: 560 }} />
        </div>
        <SelectedMuscles muscles={muscles} onRemove={onToggle} />
        <button type="button" className="btn wide" style={{ marginTop: 16, flex: "none" }} onClick={onClose}>
          <Icon name="check" size={20} /> Valider
        </button>
      </div>
    </div>
  );
}
