"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import type { Exercise } from "@/lib/exercises";
import { normalizeMuscles, muscleLabel, type MuscleKey } from "@/lib/muscles";

import { BodyMap } from "../ui/body-map";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { Spinner } from "../spinner";
import { saveExerciseAction, type ExerciseFormState } from "./actions";

const CATEGORIES = ["Musculaire", "Endurance", "Course à pied"];
const EQUIPMENT = ["Tapis", "Haltères", "Élastique"];

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

export function ExerciseForm({ exercise }: { exercise?: Exercise }) {
  const [state, action, pending] = useActionState<ExerciseFormState, FormData>(saveExerciseAction, {});
  const [muscles, setMuscles] = useState<MuscleKey[]>(exercise?.muscles ?? []);
  const [image, setImage] = useState<string | null>(exercise?.imageUrl ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const initialEquipment = exercise?.equipment ?? null;
  const [otherEquipment, setOtherEquipment] = useState(
    initialEquipment !== null && !EQUIPMENT.includes(initialEquipment),
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const initialCategory = exercise?.category ?? CATEGORIES[0];
  const categories = CATEGORIES.includes(initialCategory) ? CATEGORIES : [...CATEGORIES, initialCategory];

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
      <p className="subtitle">{exercise ? "なおす" : "あたらしい"} · tout reste modifiable</p>

      <label className="field-label" htmlFor="name">Nom</label>
      <input id="name" name="name" className="input" defaultValue={exercise?.name} required autoComplete="off" />

      <label className="field-label" htmlFor="description">Description</label>
      <textarea id="description" name="description" className="textarea" defaultValue={exercise?.description ?? ""} rows={3} />

      <div className="galet alt" style={{ marginTop: 18, background: "var(--stone)", borderColor: "var(--stone)", display: "flex", alignItems: "center", gap: 16, padding: 14 }}>
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
      <div className="choices" role="radiogroup" aria-label="Catégorie">
        {categories.map((c) => (
          <label key={c} className="choice">
            <input type="radio" name="category" value={c} defaultChecked={c === initialCategory} />
            <span className="chip">{c}</span>
          </label>
        ))}
      </div>

      <span className="field-label">Matériel</span>
      <div className="choices" role="radiogroup" aria-label="Matériel">
        <label className="choice">
          <input type="radio" name="equipment" value="" defaultChecked={initialEquipment === null} onChange={() => setOtherEquipment(false)} />
          <span className="chip">Aucun</span>
        </label>
        {EQUIPMENT.map((e) => (
          <label key={e} className="choice">
            <input type="radio" name="equipment" value={e} defaultChecked={e === initialEquipment} onChange={() => setOtherEquipment(false)} />
            <span className="chip">{e}</span>
          </label>
        ))}
        {otherEquipment ? (
          <input
            name="equipmentOther"
            className="input"
            style={{ height: 34, width: 180, padding: "0 14px", fontSize: 16 }}
            placeholder="Autre matériel"
            defaultValue={initialEquipment !== null && !EQUIPMENT.includes(initialEquipment) ? initialEquipment : ""}
            aria-label="Autre matériel"
            autoFocus={!exercise}
          />
        ) : (
          <button type="button" className="chip dashed" onClick={() => setOtherEquipment(true)}>
            <Icon name="plus" size={14} /> Autre matériel
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="field-label">Muscles sollicités</span>
        <span className="mono muted" style={{ fontSize: 11 }}>touche le schéma</span>
      </div>
      <section className="galet" style={{ borderRadius: 32, position: "relative", padding: "14px 16px 16px" }}>
        <span className="display" aria-hidden="true" style={{ position: "absolute", top: 14, right: 18, fontSize: 14, opacity: 0.25 }}>筋肉</span>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {(["face", "dos"] as const).map((view) => (
            <figure key={view} style={{ margin: 0, display: "grid", justifyItems: "center", gap: 4 }}>
              <BodyMap view={view} highlight={muscles} height={250} onToggle={toggle} label={`Vue de ${view}, touche un muscle pour le sélectionner`} />
              <figcaption className="mono muted" style={{ fontSize: 10, letterSpacing: "0.1em" }}>{view === "face" ? "FACE" : "DOS"}</figcaption>
            </figure>
          ))}
        </div>
        <div className="choices" style={{ marginTop: 12 }}>
          {muscles.length === 0 ? <span className="muted" style={{ fontSize: 13 }}>Aucun muscle sélectionné.</span> : null}
          {muscles.map((m) => (
            <button key={m} type="button" className="chip accent" onClick={() => toggle(m)} aria-label={`Retirer ${muscleLabel(m)}`}>
              {muscleLabel(m)} <Icon name="close" size={14} />
            </button>
          ))}
        </div>
      </section>

      {state.error ? <p className="error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}

      <button type="submit" className="btn wide" style={{ marginTop: 18 }} disabled={pending}>
        {pending ? <Spinner /> : <Icon name="check" size={20} />} {pending ? "Enregistrement…" : "Enregistrer l'exercice"}
      </button>
    </form>
  );
}
